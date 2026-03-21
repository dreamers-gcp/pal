"""
InsightFace microservice for PAL face attendance.
Endpoints:
  POST /embedding        — receive an image, return 512-dim face embedding
  POST /compare          — receive an image + list of known embeddings, return best match + score
  POST /identify_class   — multi-face image + per-student embeddings; one-to-one greedy matching
  GET  /health           — liveness check
"""

import io
import logging
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis
from PIL import Image

logger = logging.getLogger("face-service")
logging.basicConfig(level=logging.INFO)

face_app: Optional[FaceAnalysis] = None

SIMILARITY_THRESHOLD = 0.35


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global face_app
    logger.info("Loading InsightFace model (buffalo_l)...")
    face_app = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"],
    )
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    logger.info("InsightFace ready.")
    yield
    face_app = None


app = FastAPI(title="PAL Face Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_image(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def extract_single_embedding(img: np.ndarray) -> np.ndarray:
    """
    Extract embedding when exactly one face should be present.
    Used for /embedding (face registration).
    """
    faces = face_app.get(img)
    if len(faces) == 0:
        raise HTTPException(status_code=422, detail="No face detected in the image")
    if len(faces) > 1:
        raise HTTPException(
            status_code=422,
            detail="Multiple faces detected — please ensure only your face is visible",
        )
    assert_faces_live(img, faces)
    return faces[0].normed_embedding


def extract_face_embeddings(img: np.ndarray) -> list[np.ndarray]:
    """
    Extract embeddings for all detected faces.
    Used for /compare (attendance verification) where we allow multi-face images.
    """
    faces = face_app.get(img)
    if len(faces) == 0:
        raise HTTPException(status_code=422, detail="No face detected in the image")
    return [f.normed_embedding for f in faces]


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": face_app is not None}


@app.post("/embedding")
async def get_embedding(file: UploadFile = File(...)):
    data = await file.read()
    img = read_image(data)
    emb = extract_single_embedding(img)
    return {"embedding": emb.tolist()}


@app.post("/compare")
async def compare(
    file: UploadFile = File(...),
    embeddings_json: str = Form(...),
):
    """
    Compare the uploaded face against a list of known embeddings.
    embeddings_json: JSON string of [[id, [512 floats]], ...]
    Returns the best match id + similarity score.
    """
    import json

    data = await file.read()
    img = read_image(data)
    probe_embs = extract_face_embeddings(img)

    try:
        known = json.loads(embeddings_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid embeddings_json")

    if not known:
        raise HTTPException(status_code=400, detail="No known embeddings provided")

    best_id = None
    best_score = -1.0

    # Allow multi-face images: accept if any detected face matches.
    for probe_emb in probe_embs:
        for item in known:
            emb_id = item[0]
            emb_vec = np.array(item[1], dtype=np.float64)
            score = cosine_similarity(probe_emb, emb_vec)
            if score > best_score:
                best_score = score
                best_id = emb_id

    return {
        "match": best_score >= SIMILARITY_THRESHOLD,
        "best_id": best_id,
        "similarity": round(best_score, 4),
        "threshold": SIMILARITY_THRESHOLD,
    }


@app.post("/identify_class")
async def identify_class(
    file: UploadFile = File(...),
    candidates_json: str = Form(...),
):
    """
    Detect all faces in the class photo and match them to enrolled students (one-to-one).

    candidates_json: JSON array of objects:
      [{"student_id": "<uuid>", "embeddings": [[<embedding_row_id>, [512 floats]], ...]}, ...]

    Matching: for each (face, student) pair take max similarity over that student's embeddings;
    collect triples (score, face_index, student_id) where score >= SIMILARITY_THRESHOLD;
    sort by score descending; greedy assign each face and student at most once.
    """
    import json

    data = await file.read()
    img = read_image(data)
    probe_embs = extract_face_embeddings(img)

    try:
        candidates = json.loads(candidates_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid candidates_json")

    if not isinstance(candidates, list):
        raise HTTPException(status_code=400, detail="candidates_json must be a list")

    triples: list[tuple[float, int, str]] = []

    for fi, probe_emb in enumerate(probe_embs):
        probe_emb = np.asarray(probe_emb, dtype=np.float64)
        for cand in candidates:
            if not isinstance(cand, dict):
                continue
            sid = cand.get("student_id")
            embs = cand.get("embeddings")
            if not sid or not isinstance(embs, list):
                continue
            best_for_student = -1.0
            for item in embs:
                if not isinstance(item, (list, tuple)) or len(item) < 2:
                    continue
                emb_vec = np.array(item[1], dtype=np.float64)
                best_for_student = max(
                    best_for_student, cosine_similarity(probe_emb, emb_vec)
                )
            if best_for_student >= SIMILARITY_THRESHOLD:
                triples.append((best_for_student, fi, str(sid)))

    triples.sort(key=lambda t: t[0], reverse=True)

    used_face: set[int] = set()
    used_student: set[str] = set()
    matches: list[dict] = []

    for score, fi, sid in triples:
        if fi in used_face or sid in used_student:
            continue
        used_face.add(fi)
        used_student.add(sid)
        matches.append(
            {
                "student_id": sid,
                "face_index": fi,
                "similarity": round(float(score), 4),
            }
        )

    matched_face_indices = used_face
    unmatched_face_indices = [
        i for i in range(len(probe_embs)) if i not in matched_face_indices
    ]

    return {
        "face_count": len(probe_embs),
        "matches": matches,
        "unmatched_face_indices": unmatched_face_indices,
        "matched_student_ids": list(used_student),
        "threshold": SIMILARITY_THRESHOLD,
    }

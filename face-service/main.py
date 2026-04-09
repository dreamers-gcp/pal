"""
InsightFace microservice for PAL face attendance.
Endpoints:
  POST /embedding — receive an image, return 512-dim face embedding
  POST /compare   — receive an image + list of known embeddings, return best match + score
  GET  /health    — liveness check
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

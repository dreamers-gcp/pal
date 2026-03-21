FROM python:3.11-slim

# These libs are sometimes required by OpenCV builds that rely on GL.
# We use `opencv-python-headless` (and InsightFace/onnxruntime) so they are
# usually not necessary for CPU inference. Making this optional lets Docker
# builds succeed in restricted network environments where `apt-get update`
# fails.
ARG INSTALL_SYSTEM_DEPS=false
RUN if [ "$INSTALL_SYSTEM_DEPS" = "true" ]; then \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      libgl1-mesa-glx libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/* ; \
  fi

WORKDIR /app

# insightface builds Cython extensions from source on some platforms (e.g. linux/arm64);
# python:3.11-slim has no compiler unless we install it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8100
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]

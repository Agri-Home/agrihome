# CPU inference image. For GPU, use nvidia/cuda base and install CUDA torch wheels.
FROM python:3.12-slim-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY train.py serve.py ./

# Build-time: copy artifacts/ into image or mount at run:
#   docker run -v $(pwd)/artifacts:/artifacts -e ... python serve.py --checkpoint /artifacts/best.pt ...
EXPOSE 8765
CMD ["python", "serve.py", "--checkpoint", "/artifacts/best.pt", "--classes", "/artifacts/classes.json", "--host", "0.0.0.0", "--port", "8765"]

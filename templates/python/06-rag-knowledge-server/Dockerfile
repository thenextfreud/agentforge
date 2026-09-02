FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies for optional packages
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src/ ./src/

# Install with local + chroma extras for a self-contained image.
# Omit extras in the base image by changing the line below.
RUN pip install --no-cache-dir ".[local,chroma]"

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /app /app
ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["rag-knowledge-server"]

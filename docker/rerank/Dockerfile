# syntax=docker/dockerfile:1
ARG DEVICE=cpu

# Base images for different devices
FROM rocm/pytorch:rocm6.0_ubuntu22.04_py3.10_pytorch_2.1.2 AS base-rocm
FROM python:3.10-slim AS base-cpu

FROM base-${DEVICE} AS final

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python package management
ENV UV_LINK_MODE=copy
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Create virtual environment if not using base-rocm which already has one
RUN if [ ! -d ".venv" ]; then uv venv .venv; fi

# Copy dependency files
COPY packages/rerank/pyproject.toml /app/packages/rerank/

# Sync dependencies
ARG DEVICE
WORKDIR /app/packages/rerank
RUN uv sync --frozen --no-install-project || uv sync --no-install-project

# Copy source code
COPY packages/rerank/python ./python
COPY packages/rerank/scripts ./scripts
COPY packages/rerank/src ./src
COPY packages/rerank/package.json ./package.json

# Create entrypoint script
RUN echo '#!/bin/bash\n\
if [ -f ".venv/bin/activate" ]; then source .venv/bin/activate; fi\n\
export PYTHONPATH=$PYTHONPATH:$(pwd)\n\
uvicorn python.server:app --host 0.0.0.0 --port 8000 "$@"\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose models directory for persistent storage
VOLUME /app/models

# Environment defaults
ENV PYTHONUNBUFFERED=1
ENV RERANK_DEVICE=${DEVICE}
ENV RERANK_MODEL=Qwen/Qwen3-VL-Reranker-2B

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

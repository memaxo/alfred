# syntax=docker/dockerfile:1
ARG DEVICE=cpu

# Base images
FROM rocm/pytorch:rocm6.0_ubuntu22.04_py3.10_pytorch_2.1.2 AS base-rocm
FROM python:3.10-slim AS base-cpu

FROM base-${DEVICE} AS final

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv
ENV UV_LINK_MODE=copy
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Create virtual environment if not using base-rocm which already has one
RUN if [ ! -d ".venv" ]; then uv venv .venv; fi

# Copy dependency files
COPY packages/voice/pyproject.toml packages/voice/pyproject.rocm.toml* /app/packages/voice/
COPY packages/voice/uv.lock /app/packages/voice/uv.lock

# Sync dependencies
ARG DEVICE
WORKDIR /app/packages/voice
RUN if [ "$DEVICE" = "rocm" ]; then \
      mv pyproject.rocm.toml pyproject.toml && \
      uv lock && \
      uv sync --frozen --no-install-project; \
    else \
      uv sync --frozen --no-install-project; \
    fi

# Copy source code
COPY packages/voice/python ./python
COPY packages/voice/src ./src
COPY packages/voice/scripts ./scripts
COPY packages/voice/package.json ./package.json

# Create entrypoint script
RUN echo '#!/bin/bash\n\
if [ -f ".venv/bin/activate" ]; then source .venv/bin/activate; fi\n\
export PYTHONPATH=$PYTHONPATH:$(pwd)/python\n\
python -m python.tts.server "$@"\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose models directory
VOLUME /app/packages/voice/models

ENV PYTHONUNBUFFERED=1
ENV VOICE_DEVICE=${DEVICE}
ENV MAYA_QUANTIZE_4BIT=true

ENTRYPOINT ["/app/entrypoint.sh"]

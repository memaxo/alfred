# syntax=docker/dockerfile:1
ARG DEVICE=cpu

# Base images
FROM rocm/pytorch:rocm6.0_ubuntu22.04_py3.10_pytorch_2.1.2 AS base-rocm
FROM python:3.10-slim AS base-cpu

FROM base-${DEVICE} AS final

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
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
COPY packages/embed/pyproject.toml packages/embed/pyproject.rocm.toml* /app/packages/embed/
COPY packages/embed/uv.lock /app/packages/embed/uv.lock

# Sync dependencies
ARG DEVICE
WORKDIR /app/packages/embed
RUN if [ "$DEVICE" = "rocm" ]; then \
      mv pyproject.rocm.toml pyproject.toml && \
      uv lock && \
      uv sync --frozen --no-install-project; \
    else \
      uv sync --frozen --no-install-project; \
    fi

# Copy source code
COPY packages/embed/scripts ./scripts
COPY packages/embed/src ./src
COPY packages/embed/package.json ./package.json

# Create entrypoint script
RUN echo '#!/bin/bash\n\
if [ -f ".venv/bin/activate" ]; then source .venv/bin/activate; fi\n\
python scripts/embed_server.py "$@"\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose models directory
VOLUME /app/packages/embed/models

ENV PYTHONUNBUFFERED=1
ENV EMBED_DEVICE=${DEVICE}

ENTRYPOINT ["/app/entrypoint.sh"]

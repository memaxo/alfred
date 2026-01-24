# Production Deployment on Proxmox (AMD GPU + ROCm)

## Overview

This guide details the deployment of ALFRED on a Proxmox host with an AMD RX 7900 XTX GPU.
The architecture runs the core API and Voice services in a privileged LXC container with direct GPU passthrough to enable low-latency inference (Maya1/NeMo) via `Bun.spawn` and ROCm.

### Provisioning note

If you want an idempotent “create or reuse” baseline for Proxmox resources (LXCs + starts), run:

- `bun run scripts/proxmox.ts`

That script provisions **containers only** (no GPU passthrough config, no in-container package install). This document covers the additional **manual** Proxmox/LXC configuration required for AMD GPU passthrough and ROCm.

## Hardware Context

- **Host**: Proxmox VE 8.x
- **GPU**: AMD RX 7900 XTX (24GB VRAM) -> Supports ROCm 6.x
- **CPU**: Intel i9 14900HK
- **RAM**: 96 GB DDR5

## Architecture Topology

1.  **LXC Container (AI + API)**:
    - **OS**: Ubuntu 22.04 / 24.04
    - **Role**: Runs `packages/api` (Bun) and `packages/voice` (Python/ROCm).
    - **Reason**: The `packages/voice` architecture uses `Bun.spawn` to manage Python subprocesses via `stdio`. They must reside in the same container to share the PID namespace and filesystem.
    - **GPU**: Passthrough of `/dev/kfd` and `/dev/dri/renderD128`.

2.  **Docker VM / Container**:
    - **Role**: Postgres (with `pgvector`), Redis.
    - **Reason**: Standard infrastructure, easier to manage via Docker Compose. Can run in a separate lightweight LXC or VM.

3.  **Frontend (Web)**:
    - **Role**: `apps/web` (TanStack Start).
    - **Location**: Can run in the AI LXC (simplest) or separate container.

## Step 1: Proxmox LXC Setup (AI Node)

1.  **Create LXC**: Unprivileged = No (needs device access).
2.  **Passthrough**: Edit `/etc/pve/lxc/CTID.conf`:
    ```bash
    lxc.cgroup2.devices.allow: c 226:* rwm
    lxc.mount.entry: /dev/kfd dev/kfd none bind,optional,create=file
    lxc.mount.entry: /dev/dri dev/dri none bind,optional,create=dir
    ```
3.  **Verify in LXC**:
    ```bash
    ls -l /dev/kfd /dev/dri
    rocminfo # Should list the 7900 XTX (gfx1100)
    ```

## Step 2: Software Stack (In LXC)

1.  **System Deps**:

    ```bash
    apt update && apt install -y curl git ffmpeg build-essential python3-venv
    ```

2.  **Install Bun**:

    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```

3.  **Install UV (Python Manager)**:
    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```

## Step 3: Project Setup & ROCm Dependencies

1.  **Clone & Install JS Deps**:

    ```bash
    git clone <repo> alfred
    cd alfred
    bun install
    ```

2.  **Configure Voice for ROCm**:
    The default `pyproject.toml` defaults to CUDA for Linux. For this specific AMD hardware, switch to the ROCm configuration:

    ```bash
    cd packages/voice
    cp pyproject.toml pyproject.cuda.bak
    cp pyproject.rocm.toml pyproject.toml
    ```

3.  **Install Python Deps**:

    ```bash
    uv sync
    # Verify Torch ROCm
    uv run python -c "import torch; print(torch.cuda.is_available())" # Should return True (ROCm uses cuda api map)
    ```

4.  **Download Models**:
    ```bash
    uv run python scripts/download.py
    ```

## Step 4: Running the Server

1.  **Environment**:
    Create `.env` in `packages/api`:

    ```bash
    DATABASE_URL=postgresql://...
    REDIS_URL=redis://...
    VOICE_PROVIDER=maya1
    WHISPER_DEVICE=rocm # or "cuda" mapped to rocm
    # Maya1 uses HF transformers auto-device map
    ```

2.  **Build & Run**:
    ```bash
    # Root
    bun run build
    cd packages/api
    bun start # Or single executable: bun build ./src/index.ts --compile --outfile alfred-server
    ```

## Troubleshooting

- **"HIP Error"**: Ensure the user running the process belongs to `render` and `video` groups (`usermod -aG render,video root`).
- **HSA_OVERRIDE_GFX_VERSION**: The 7900 XTX (gfx1100) is supported in ROCm 6.0+, but older PyTorch versions might need `export HSA_OVERRIDE_GFX_VERSION=11.0.0`.

# ALFRED Proxmox Deployment Architecture

**Last Updated**: 2025-01-15

## Executive Summary

ALFRED is a Bun-based monorepo that combines a TanStack Start SSR web app with integrated tRPC API routes, background schedulers, and Python subprocesses for voice/embedding processing. This document analyzes the architecture and proposes optimized build strategies for Proxmox deployment (Docker, VM, or LXC).

## Architecture Overview

### Core Components

1. **Web Application** (`apps/web`)
   - TanStack Start SSR framework
   - Integrated API routes (`/api/trpc`, `/api/assistant`, `/api/orchestrator`, `/api/metrics`)
   - Single entry point handles both SSR and API
   - Build output: Static assets + server bundle

2. **API Layer** (`packages/api`)
   - tRPC routers (assistant, orchestrator, workflow, etc.)
   - Integrated into TanStack Start via server routes
   - Background schedulers (reminder, compression) - gated by env flags
   - Metrics endpoint (Prometheus)

3. **Python Subprocesses**
   - **Voice** (`packages/voice`): Faster-Whisper STT + Piper TTS
   - **Embeddings** (`packages/embed`): KaLM-Embedding-Gemma3-12B via sentence-transformers
   - Managed via Bun.spawn() with process pools
   - IPC via JSON lines over stdin/stdout

4. **External Dependencies**
   - PostgreSQL 16 + pgvector (required)
   - Redis (optional, for multi-instance run registry)
   - Python 3.10+ with PyTorch (for local voice/embeddings)

### Current Build Process

```bash
# Development
bun run dev              # Turborepo dev mode (web + API)

# Production build
bun run build            # Builds all packages/apps
# Outputs:
# - apps/web/dist/       # TanStack Start SSR bundle
# - packages/*/dist/     # Compiled TypeScript
```

### Entry Point Analysis

**TanStack Start** (`apps/web/src/router.tsx`):
- Single Bun process handles both SSR and API
- Server routes defined in `apps/web/src/routes/api/`
- Bootstrap code (`apps/web/src/server/bootstrap.ts`) initializes schedulers
- No separate API server process needed

## Deployment Options for Proxmox

### Option 1: Single Bun Executable (Recommended)

**Approach**: Use `bun build --compile` to create a standalone executable containing:
- Bundled web app (SSR + API routes)
- All TypeScript packages
- Bun runtime embedded

**Pros**:
- Single binary deployment (no Node.js/Bun installation needed)
- Fast startup (bytecode compilation available)
- Minimal dependencies
- Easy to deploy and update

**Cons**:
- Python subprocesses still require Python runtime
- Cannot embed PostgreSQL/Redis
- Larger binary size (~50-100MB)

**Build Command**:
```bash
# Build single executable
bun build --compile \
  --minify \
  --sourcemap \
  --target=bun-linux-x64 \
  ./apps/web/src/router.tsx \
  --outfile alfred-server

# Result: ./alfred-server (standalone executable)
```

**Deployment Structure**:
```
/opt/alfred/
├── alfred-server          # Main executable
├── .env                   # Environment config
├── models/                # Voice/embedding models (if local)
│   ├── whisper/
│   └── piper/
└── data/                  # Persistent data (if needed)
```

**Dependencies**:
- PostgreSQL 16 + pgvector (separate container/VM)
- Python 3.10+ (for voice/embeddings if using local models)
- Redis (optional, separate container)

### Option 2: Docker Container

**Approach**: Multi-stage Docker build with Bun runtime

**Dockerfile Structure**:
```dockerfile
# Stage 1: Build
FROM oven/bun:1.2.18 AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Runtime
FROM oven/bun:1.2.18-slim
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/*/dist ./packages/*/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Python for subprocesses (if using local models)
RUN apt-get update && apt-get install -y \
    python3.10 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies
COPY packages/voice/scripts ./packages/voice/scripts
COPY packages/embed/scripts ./packages/embed/scripts

# Entry point
CMD ["bun", "run", "apps/web/dist/server.js"]
```

**Pros**:
- Isolated environment
- Easy to scale horizontally
- Can include Python runtime
- Standard deployment pattern

**Cons**:
- Larger image size (~500MB+)
- Slower startup than executable
- Requires Docker runtime on Proxmox

**Docker Compose**:
```yaml
version: "3.9"
services:
  alfred:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://alfred:alfred@postgres:5432/alfred
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### Option 3: LXC Container

**Approach**: LXC container with Bun installed

**Setup**:
```bash
# Create LXC container (Ubuntu 22.04)
pct create 100 ubuntu-22.04-standard \
  --hostname alfred \
  --memory 2048 \
  --cores 2 \
  --storage local-lvm

# Install Bun
pct exec 100 -- bash -c "curl -fsSL https://bun.sh/install | bash"

# Deploy application
pct push 100 ./alfred-server /opt/alfred/alfred-server
pct push 100 ./.env /opt/alfred/.env
```

**Pros**:
- Lightweight (minimal overhead)
- Direct access to host resources
- Easy to manage via Proxmox UI
- Can share PostgreSQL/Redis with host

**Cons**:
- Manual setup required
- Less isolation than Docker
- Requires Bun installation in container

### Option 4: VM (Full OS)

**Approach**: Full VM with Bun + dependencies

**Pros**:
- Maximum isolation
- Full OS capabilities
- Easy to manage

**Cons**:
- Highest resource overhead
- Slower startup
- More maintenance

## Recommended Architecture: Hybrid Approach

### Primary: Single Executable + Docker for Dependencies

**Components**:

1. **ALFRED Server** (Single Bun Executable)
   - Built with `bun build --compile`
   - Contains web app + API + all packages
   - Deployed as standalone binary

2. **PostgreSQL** (Docker Container)
   - `pgvector/pgvector:pg16` image
   - Persistent volume for data
   - Exposed on internal network

3. **Redis** (Docker Container, Optional)
   - For multi-instance run registry
   - Only needed if scaling horizontally

4. **Python Runtime** (System Package or Container)
   - Required only if using local voice/embeddings
   - Can be installed on Proxmox host or separate container

### Deployment Structure

```
Proxmox Host
├── LXC Container: alfred-server
│   ├── /opt/alfred/
│   │   ├── alfred-server          # Bun executable
│   │   ├── .env                   # Config
│   │   └── models/                 # Voice/embedding models
│   └── Python 3.10+ (if local models)
│
├── Docker: postgres
│   └── pgvector/pgvector:pg16
│
└── Docker: redis (optional)
    └── redis:7-alpine
```

## Build Optimization Strategy

### 1. Pre-build Optimization

**Bundle Strategy**:
- Use `bun build` to bundle all packages into single entry point
- Enable minification (`--minify`)
- Enable sourcemaps for production debugging (`--sourcemap`)
- Use bytecode compilation (`--bytecode`) for faster startup

**Code Splitting**:
- TanStack Start handles code splitting automatically
- API routes are server-only (not bundled for client)
- Client bundles are optimized by Vite

### 2. Executable Build

**Single Entry Point**:
```typescript
// apps/web/src/server.ts (new entry point for executable)
import { initServer } from "./server/bootstrap";
import { getRouter } from "../router";

// Initialize schedulers
initServer();

// Export router for TanStack Start
export { getRouter };
```

**Build Command**:
```bash
# Production executable
bun build --compile \
  --minify \
  --sourcemap \
  --bytecode \
  --target=bun-linux-x64 \
  ./apps/web/src/server.ts \
  --outfile alfred-server

# Cross-compile for different architectures
bun build --compile --target=bun-linux-arm64 ./apps/web/src/server.ts --outfile alfred-server-arm64
```

### 3. Python Dependencies

**Option A: System Python** (Recommended for LXC/VM)
- Install Python 3.10+ on host/container
- Install dependencies via `uv` or `pip`
- Models downloaded to persistent volume

**Option B: Python Container** (For Docker deployment)
- Separate Python container for voice/embeddings
- IPC via HTTP or shared volume
- More complex but better isolation

**Model Storage**:
- Store models in persistent volume (`/opt/alfred/models/`)
- Download during deployment or first run
- Cache models to avoid re-downloading

### 4. Environment Configuration

**Centralized Config**:
```bash
# /opt/alfred/.env
DATABASE_URL=postgresql://alfred:alfred@postgres:5432/alfred
REDIS_URL=redis://redis:6379
BETTER_AUTH_URL=https://alfred.example.com
OPENAI_API_KEY=...
# ... other config
```

**Secrets Management**:
- Use Proxmox secrets or external secret manager
- Never commit secrets to repo
- Use environment variables for sensitive data

## Deployment Workflow

### Build Phase

```bash
# 1. Install dependencies
bun install --frozen-lockfile

# 2. Build all packages
bun run build

# 3. Create executable
bun build --compile \
  --minify \
  --sourcemap \
  --bytecode \
  --target=bun-linux-x64 \
  ./apps/web/src/server.ts \
  --outfile dist/alfred-server

# 4. Package for deployment
tar -czf alfred-server.tar.gz \
  dist/alfred-server \
  config/env.example \
  packages/voice/scripts \
  packages/embed/scripts
```

### Deployment Phase

```bash
# 1. Extract on Proxmox host
tar -xzf alfred-server.tar.gz -C /opt/alfred/

# 2. Configure environment
cp config/env.example /opt/alfred/.env
# Edit .env with production values

# 3. Set permissions
chmod +x /opt/alfred/alfred-server

# 4. Install Python dependencies (if using local models)
cd /opt/alfred
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Download models (if using local models)
python3 packages/voice/scripts/download_models.py
python3 packages/embed/scripts/download_model.py

# 6. Start PostgreSQL (if not already running)
docker-compose -f docker/postgres/docker-compose.yml up -d

# 7. Run migrations
/opt/alfred/alfred-server migrate  # If migration command exists
# Or: bun run db:migrate (if Bun is installed)

# 8. Start ALFRED server
/opt/alfred/alfred-server
```

### Service Management

**Systemd Service** (`/etc/systemd/system/alfred.service`):
```ini
[Unit]
Description=ALFRED AI Assistant
After=network.target postgresql.service

[Service]
Type=simple
User=alfred
WorkingDirectory=/opt/alfred
ExecStart=/opt/alfred/alfred-server
EnvironmentFile=/opt/alfred/.env
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Resource Requirements

### Minimum Requirements

- **CPU**: 2 cores (4 recommended)
- **RAM**: 2GB (4GB recommended)
- **Storage**: 10GB (20GB+ if using local models)
- **Network**: Internal Proxmox network access

### With Local Models

- **CPU**: 4+ cores (for Python subprocesses)
- **RAM**: 8GB+ (for embedding model)
- **Storage**: 50GB+ (models are large)
- **GPU**: Optional (MPS/ROCm/CUDA for acceleration)

## Monitoring & Observability

### Metrics Endpoint

ALFRED exposes Prometheus metrics at `/api/metrics`:
- tRPC request counts/durations
- Workflow execution metrics
- Tool call metrics
- Policy decisions
- System health

### Health Checks

- `/healthz` - Basic liveness probe
- `/healthz/deps` - Postgres/Redis readiness

### Logging

- Structured JSON logs
- Log level controlled via `LOG_LEVEL` env var
- Errors logged with context

## Security Considerations

### Network Isolation

- ALFRED server on internal Proxmox network
- PostgreSQL/Redis not exposed externally
- Reverse proxy (Caddy/Nginx) for external access

### Authentication

- Better Auth with passkey support
- Ed25519 tokens for tool access
- Biometric elevation for high-risk operations

### Secrets

- Never commit secrets to repo
- Use Proxmox secrets or external manager
- Rotate keys regularly

## Scaling Considerations

### Horizontal Scaling

- Use Redis-backed run registry (`RUN_REGISTRY_BACKEND=redis`)
- Multiple ALFRED instances behind load balancer
- Sticky sessions for workflow resumes (or use Redis)

### Vertical Scaling

- Increase CPU/RAM for Python subprocesses
- Use GPU acceleration for embeddings/voice
- Optimize database queries

## Migration Path

### Phase 1: Single Executable (MVP)

1. Build executable with `bun build --compile`
2. Deploy to LXC container
3. Use existing PostgreSQL Docker container
4. Test basic functionality

### Phase 2: Production Hardening

1. Add systemd service
2. Configure monitoring/alerting
3. Set up backups
4. Optimize resource allocation

### Phase 3: Advanced Features

1. Enable local voice/embeddings (if needed)
2. Scale horizontally (if needed)
3. Add GPU acceleration (if available)

## Recommendations

### For Single-User Deployment (Current)

**Recommended**: **Single Bun Executable + LXC Container**

- Minimal overhead
- Easy to manage
- Fast startup
- Sufficient for single-user workload

### For Future Scaling

**Recommended**: **Docker Compose Stack**

- Easy horizontal scaling
- Better isolation
- Standard deployment pattern
- Easier to maintain

## Open Questions

1. **Migration Command**: Does ALFRED need a CLI for migrations, or should migrations run separately?
2. **Model Storage**: Where should voice/embedding models be stored? (Persistent volume vs. container image)
3. **Python Version**: What Python version is required? (3.10+ mentioned, but verify)
4. **GPU Support**: How to expose GPU to containers for MPS/ROCm/CUDA?

## Next Steps

1. Create `apps/web/src/server.ts` entry point for executable
2. Test `bun build --compile` with full application
3. Create deployment scripts for Proxmox
4. Document Python dependency installation
5. Create systemd service file
6. Test deployment in Proxmox environment


# ALFRED Build Architecture Optimization Summary

**Date**: 2025-01-15  
**Purpose**: Optimize ALFRED build architecture for Proxmox deployment

## Key Findings

### Architecture Overview

ALFRED is a **Bun-based monorepo** with:

1. **Single Entry Point**: TanStack Start web app (`apps/web`) handles both SSR and API routes
2. **Integrated API**: tRPC routers served via TanStack Start server routes
3. **Background Workers**: Schedulers (reminder, compression) gated by env flags
4. **Python Subprocesses**: Voice (STT/TTS) and embeddings via Bun.spawn()
5. **External Dependencies**: PostgreSQL + pgvector (required), Redis (optional)

### What Needs to be Packaged

#### Core Application
- ✅ Web app (TanStack Start SSR bundle)
- ✅ API layer (tRPC routers)
- ✅ All TypeScript packages (runtime, agent, cognitive, knowledge, etc.)
- ✅ Bun runtime (embedded in executable)

#### External Dependencies (Cannot be packaged)
- ❌ PostgreSQL 16 + pgvector (separate container/VM)
- ❌ Redis (optional, separate container)
- ❌ Python 3.10+ runtime (for subprocesses)
- ❌ Python packages (faster-whisper, piper-tts, sentence-transformers)
- ❌ Model files (voice/embedding models - large, ~10-50GB)

## Recommended Build Strategy

### Option 1: Single Bun Executable (Recommended)

**Best for**: Single-user deployment, LXC containers, minimal overhead

**Build Command**:
```bash
bun build --compile \
  --minify \
  --sourcemap \
  --bytecode \
  --target=bun-linux-x64 \
  ./apps/web/src/router.tsx \
  --outfile alfred-server
```

**Deployment**:
- Single binary (~50-100MB)
- No Bun installation needed on target
- Fast startup with bytecode
- Python runtime installed separately (if using local models)

**Pros**:
- ✅ Minimal dependencies
- ✅ Fast startup
- ✅ Easy deployment
- ✅ Small footprint

**Cons**:
- ❌ Python subprocesses require separate Python installation
- ❌ Cannot embed PostgreSQL/Redis
- ❌ Larger binary size than source code

### Option 2: Docker Container

**Best for**: Multi-instance scaling, standardized deployment

**Structure**:
- Multi-stage Dockerfile
- Includes Python runtime
- Separate containers for PostgreSQL/Redis

**Pros**:
- ✅ Complete isolation
- ✅ Includes Python runtime
- ✅ Easy to scale horizontally
- ✅ Standard deployment pattern

**Cons**:
- ❌ Larger image size (~500MB+)
- ❌ Slower startup
- ❌ Requires Docker runtime

### Option 3: LXC Container

**Best for**: Lightweight virtualization, direct host access

**Setup**:
- LXC container with Bun installed
- System Python for subprocesses
- Shared PostgreSQL/Redis with host

**Pros**:
- ✅ Minimal overhead
- ✅ Direct resource access
- ✅ Easy Proxmox management

**Cons**:
- ❌ Manual setup required
- ❌ Less isolation than Docker

## Build Optimization Recommendations

### 1. Create Dedicated Server Entry Point

**Current**: `apps/web/src/router.tsx` (mixed client/server)  
**Recommended**: `apps/web/src/server.ts` (server-only entry point)

```typescript
// apps/web/src/server.ts
import { initServer } from "./server/bootstrap";
import { getRouter } from "../router";

// Initialize background schedulers
initServer();

// Export router for TanStack Start
export { getRouter };
```

### 2. Optimize Build Process

**Pre-build**:
- ✅ Use `bun run build` to compile all packages
- ✅ Enable minification (`--minify`)
- ✅ Enable sourcemaps (`--sourcemap`) for debugging
- ✅ Use bytecode compilation (`--bytecode`) for faster startup

**Build**:
- ✅ Single entry point compilation
- ✅ Cross-compile for different architectures
- ✅ Include all dependencies in bundle

### 3. Handle Python Dependencies

**Option A**: System Python (LXC/VM)
- Install Python 3.10+ on container/host
- Install dependencies via `uv` or `pip`
- Models in persistent volume

**Option B**: Python Container (Docker)
- Separate Python container
- IPC via HTTP or shared volume
- Better isolation

### 4. Model Storage Strategy

**Recommended**: Persistent Volume
- Store models in `/opt/alfred/models/`
- Download during deployment or first run
- Cache to avoid re-downloading
- Models are large (~10-50GB), don't include in image

## Deployment Architecture

### Recommended: Hybrid Approach

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

### Deployment Steps

1. **Build executable**:
   ```bash
   bun run build
   bun build --compile --minify --sourcemap --target=bun-linux-x64 \
     ./apps/web/src/server.ts --outfile dist/alfred-server
   ```

2. **Deploy to Proxmox**:
   - Extract executable to LXC container
   - Configure `.env` file
   - Install Python dependencies (if using local models)
   - Download models (if using local models)

3. **Start services**:
   - PostgreSQL (Docker)
   - Redis (optional, Docker)
   - ALFRED server (systemd service)

## Resource Requirements

### Minimum (Cloud Models)
- CPU: 2 cores
- RAM: 2GB
- Storage: 10GB

### With Local Models
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+
- GPU: Optional (MPS/ROCm/CUDA)

## Action Items

### Immediate (Phase 1)

1. ✅ **Create server entry point** (`apps/web/src/server.ts`)
   - Separate server-only entry point
   - Initialize schedulers
   - Export router

2. ✅ **Test executable build**
   - Verify `bun build --compile` works
   - Test with full application
   - Measure binary size and startup time

3. ✅ **Create build script** (`scripts/build-executable.sh`)
   - Automated build process
   - Cross-compilation support
   - Output validation

### Short-term (Phase 2)

4. **Create deployment scripts**
   - Proxmox deployment automation
   - Environment configuration
   - Service management

5. **Document Python setup**
   - Dependency installation
   - Model download process
   - Process pool configuration

6. **Create systemd service**
   - Service file template
   - Health check integration
   - Logging configuration

### Long-term (Phase 3)

7. **Optimize binary size**
   - Tree-shaking analysis
   - Dependency minimization
   - Asset optimization

8. **Add migration CLI**
   - Database migration command
   - Rollback support
   - Version tracking

9. **Monitoring integration**
   - Prometheus scraping
   - Grafana dashboards
   - Alerting rules

## Build Script Usage

```bash
# Build for Linux x64
./scripts/build-executable.sh

# Build for Linux ARM64
TARGET=bun-linux-arm64 ./scripts/build-executable.sh

# Build without bytecode (faster build, slower startup)
BYTECODE=false ./scripts/build-executable.sh

# Custom entry point
ENTRY_POINT=apps/web/src/server.ts ./scripts/build-executable.sh
```

## Testing Checklist

- [ ] Executable builds successfully
- [ ] Executable runs on target system
- [ ] API routes work correctly
- [ ] SSR rendering works
- [ ] Background schedulers start (with env flags)
- [ ] Python subprocesses work (if using local models)
- [ ] Database connections work
- [ ] Health checks respond
- [ ] Metrics endpoint works
- [ ] Logging works correctly

## Related Documents

- [Deployment Architecture](deployment-proxmox.md) - Detailed deployment guide
- [Architecture Overview](overview.md) - System architecture
- [Package Organization](packages.md) - Package structure

## Questions to Resolve

1. **Entry Point**: Should we create `apps/web/src/server.ts` or use existing `router.tsx`?
2. **Migrations**: How should migrations run? CLI command or separate script?
3. **Models**: Where should models be stored? Persistent volume or container image?
4. **Python**: Should Python be in same container or separate?

## Conclusion

**Recommended approach**: **Single Bun Executable + LXC Container**

This provides the best balance of:
- ✅ Minimal overhead
- ✅ Fast startup
- ✅ Easy deployment
- ✅ Sufficient for single-user workload

For future scaling, migrate to Docker Compose stack for better isolation and horizontal scaling.


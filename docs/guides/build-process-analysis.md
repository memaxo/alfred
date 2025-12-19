# ALFRED Build Process & Installation Analysis

**Generated:** 2025-01-27  
**Purpose:** Document build pipeline, identify missing dependencies, and surface quickstart issues

## Build Process Overview

### Complete Build Pipeline

The ALFRED build process follows this sequence:

1. **Prerequisites Installation** (Manual)
   - Bun 1.2+ installation
   - Node.js 20+ (for tooling compatibility)
   - Docker (for PostgreSQL via `db:start`)
   - (Optional) UV for Python dependencies
   - (Optional) Redis for biometric cache
   - (Optional) poof for Linux filesystem isolation

2. **Dependency Installation** (`bun install`)
   - Installs all workspace dependencies via Bun workspaces
   - No automatic setup scripts run during `bun install`
   - Turbo `setup` tasks exist but are not automatically invoked

3. **Environment Configuration** (Manual)
   - Copy `config/env.example` to `.env`
   - Generate `BETTER_AUTH_SECRET` via `bun scripts/gen-keys.ts`
   - Set `OPENAI_API_KEY` (required for AI features)
   - Configure `DATABASE_URL` (default: `postgresql://alfred:alfred@localhost:5432/alfred`)

4. **Database Setup** (`bun run db:start` + `bun run db:migrate`)
   - `db:start` uses Docker Compose to start `pgvector/pgvector:pg16` container
   - Requires Docker/Docker Compose installed
   - `db:migrate` applies SQL migrations from `packages/db/src/migrations`

5. **Development Server** (`bun run dev`)
   - Runs Turbo pipeline: `turbo dev`
   - Starts web app (TanStack Start) + API (tRPC)
   - Web: `http://localhost:3000`
   - API: `http://localhost:3000/api`

### Build Steps by Location

**Root `package.json` scripts:**
- `setup`: `bun install && turbo run setup` (not automatically invoked)
- `dev`: `turbo dev` (starts development servers)
- `build`: `NODE_OPTIONS='--max-old-space-size=16384' turbo build`
- `typecheck`: `tsc -b --pretty false` (solution-style TypeScript)

**Turbo pipeline (`turbo.json`):**
- `build`: Depends on `^build`, outputs to `dist/**`
- `test`: Depends on `^build`
- `dev`: Persistent task (no cache)
- `setup`: Cache disabled, persistent false (only `@alfred/voice` defines this)

**CI/CD (`.github/workflows/ci.yml`):**
- Pre-flight checks: `bun scripts/preflight.ts`
- Build verification: `bun run verify:build`
- Typecheck: `bun run typecheck:workspace`
- Tests: `bunx turbo run test`
- E2E: Playwright tests with browser installation

### Platform-Specific Requirements

**Linux:**
- Docker/Docker Compose for PostgreSQL
- (Optional) poof for filesystem isolation
- (Optional) UV for Python dependencies (voice/embed packages)

**macOS:**
- Docker Desktop or Docker CLI
- (Optional) UV for Python dependencies
- MPS backend for PyTorch (Apple Silicon)

**Windows:**
- Docker Desktop
- WSL2 recommended for Linux compatibility
- (Optional) UV for Python dependencies

## Missing Dependencies

### Critical (Blocking)

1. **Docker/Docker Compose Not Documented**
   - **Issue**: `bun run db:start` requires Docker but it's not listed in prerequisites
   - **Location**: `README.md` line 44-49, `docs/guides/developer-onboarding.md` line 14-18, `apps/web/content/docs/getting-started.mdx` line 14-17
   - **Fix**: Add Docker to prerequisites list:
     ```markdown
     - Docker or Docker Desktop (required for `bun run db:start`)
     ```

2. **BETTER_AUTH_SECRET Generation Not Documented in Quickstart**
   - **Issue**: `config/env.example` shows placeholder, but quickstart doesn't mention generating keys
   - **Location**: `README.md` line 58-63, `apps/web/content/docs/getting-started.mdx` line 34-36
   - **Fix**: Add step after copying `.env`:
     ```markdown
     # Generate auth keys
     bun scripts/gen-keys.ts >> .env
     ```

3. **OPENAI_API_KEY Required But Not Mentioned in Quickstart**
   - **Issue**: AI features require `OPENAI_API_KEY` but quickstart doesn't mention it
   - **Location**: `README.md` line 58-63, `apps/web/content/docs/getting-started.mdx` line 27-36
   - **Fix**: Add to "Minimum required settings" section:
     ```markdown
     - `OPENAI_API_KEY` - Required for AI SDK v6 model access
     ```

4. **UV Not Documented for Voice/Embed Packages**
   - **Issue**: Voice and embed packages require UV but it's not mentioned in prerequisites
   - **Location**: `README.md` line 44-49, `packages/voice/scripts/install.sh` line 15-17, `packages/embed/scripts/install-deps.sh` line 15-17
   - **Fix**: Add to prerequisites (optional but recommended):
     ```markdown
     - (Optional) [UV](https://github.com/astral-sh/uv) for Python dependency management (required for voice/embed packages)
     ```

5. **Python 3.10+ Not Documented**
   - **Issue**: Voice and embed packages require Python but version isn't specified
   - **Location**: `config/env.example` line 87 mentions Python 3.10+ but quickstart doesn't
   - **Fix**: Add to prerequisites:
     ```markdown
     - (Optional) Python 3.10+ for voice/embed packages (installed via UV)
     ```

### Optional

1. **Voice Package Setup Not Documented**
   - **Issue**: Voice features require manual setup (`bun run setup` in `packages/voice`) but not mentioned
   - **Location**: `packages/voice/package.json` line 18
   - **Fix**: Add optional section in quickstart:
     ```markdown
     ### Optional: Voice Features
     If you want to use local voice models:
     ```bash
     cd packages/voice
     bun run setup
     ```
     ```

2. **Embed Package Setup Not Documented**
   - **Issue**: Embed features require manual setup but not mentioned
   - **Location**: `packages/embed/package.json` line 29-30
   - **Fix**: Add optional section:
     ```markdown
     ### Optional: Local Embeddings
     For local embeddings (KaLM model):
     ```bash
     cd packages/embed
     bun run install-deps
     bun run download-model
     ```
     ```

3. **Poof Installation Error Handling**
   - **Issue**: `scripts/install-poof.sh` doesn't verify `sudo` access before attempting installation
   - **Location**: `scripts/install-poof.sh` line 49, 72
   - **Fix**: Add `sudo -v` check before installation commands:
     ```bash
     # Verify sudo access
     if ! sudo -v; then
       echo "Error: sudo access required for poof installation"
       exit 1
     fi
     ```

## Quickstart Issues

### Documentation Gaps

1. **File**: `README.md`, Line: 58-63
   - **Issue**: Environment setup step doesn't mention generating `BETTER_AUTH_SECRET` or setting `OPENAI_API_KEY`
   - **Fix**: Update Step 2:
     ```markdown
     2. **Set up environment:**
        ```bash
        cp config/env.example .env
        # Generate auth keys
        bun scripts/gen-keys.ts >> .env
        # Edit .env and set:
        # - OPENAI_API_KEY (required for AI features)
        # - DATABASE_URL (default: postgresql://alfred:alfred@localhost:5432/alfred)
        ```
     ```

2. **File**: `README.md`, Line: 44-49
   - **Issue**: Docker not listed in prerequisites but required for `db:start`
   - **Fix**: Add Docker to prerequisites:
     ```markdown
     - Docker or Docker Desktop (required for PostgreSQL via `bun run db:start`)
     ```

3. **File**: `apps/web/content/docs/getting-started.mdx`, Line: 27-36
   - **Issue**: Missing `OPENAI_API_KEY` in minimum required settings
   - **Fix**: Add to Step 3:
     ```markdown
     **Minimum required settings:**
     - `DATABASE_URL` - PostgreSQL connection string
     - `BETTER_AUTH_SECRET` - Generate with `bun scripts/gen-keys.ts`
     - `OPENAI_API_KEY` - Required for AI SDK v6 model access
     ```

4. **File**: `docs/guides/developer-onboarding.md`, Line: 29-33
   - **Issue**: Environment setup doesn't mention key generation or API keys
   - **Fix**: Update Step 2:
     ```markdown
     2. **Configure environment:**
        ```bash
        cp config/env.example .env
        # Generate auth keys
        bun scripts/gen-keys.ts >> .env
        # Edit .env and set OPENAI_API_KEY (required for AI features)
        ```
     ```

5. **File**: `apps/web/content/docs/getting-started.mdx`, Line: 14-17
   - **Issue**: Docker not mentioned in prerequisites
   - **Fix**: Add Docker to Step 1:
     ```markdown
     - **Docker** - Required for PostgreSQL (`bun run db:start`)
     ```

### Missing Steps

1. **Key Generation Step**
   - **Issue**: `BETTER_AUTH_SECRET` must be generated but no step exists
   - **Fix**: Add after copying `.env`:
     ```bash
     bun scripts/gen-keys.ts >> .env
     ```

2. **Docker Verification Step**
   - **Issue**: No check if Docker is running before `db:start`
   - **Fix**: Add troubleshooting note:
     ```markdown
     **Note**: Ensure Docker is running before `bun run db:start`. Verify with `docker ps`.
     ```

3. **Database Connection Verification**
   - **Issue**: No step to verify database is accessible before migrations
   - **Fix**: Add after `db:start`:
     ```bash
     # Wait for database to be ready (usually 5-10 seconds)
     sleep 5
     bun run db:migrate
     ```

4. **Optional Features Setup**
   - **Issue**: Voice and embed packages require separate setup but not documented
   - **Fix**: Add optional section after Step 5:
     ```markdown
     ### Optional: Enable Voice & Local Embeddings
     
     **Voice Features:**
     ```bash
     cd packages/voice
     bun run setup
     ```
     
     **Local Embeddings:**
     ```bash
     cd packages/embed
     bun run install-deps
     bun run download-model
     ```
     ```

### Command Verification Issues

1. **`bun run db:start` Fails Silently Without Docker**
   - **Issue**: `packages/db/scripts/compose.ts` throws error but user may not see it
   - **Location**: `packages/db/scripts/compose.ts` line 37
   - **Fix**: Improve error message:
     ```typescript
     } else {
       throw new Error("docker_compose_unavailable: Install Docker or Docker Desktop to use db:start");
     }
     ```

2. **Missing Error Handling in Quickstart**
   - **Issue**: No troubleshooting guidance if `bun run dev` fails
   - **Fix**: Add troubleshooting section:
     ```markdown
     ## Troubleshooting
     
     **Database connection errors:**
     - Verify Docker is running: `docker ps`
     - Check `DATABASE_URL` in `.env` matches container settings
     
     **Missing API keys:**
     - Ensure `OPENAI_API_KEY` is set in `.env`
     - Generate `BETTER_AUTH_SECRET` with `bun scripts/gen-keys.ts`
     ```

## Recommendations

### Priority 1: Critical Fixes (Blocking New Users)

1. **Add Docker to Prerequisites**
   - Update `README.md` line 44-49
   - Update `docs/guides/developer-onboarding.md` line 14-18
   - Update `apps/web/content/docs/getting-started.mdx` line 14-17

2. **Document Key Generation**
   - Add `bun scripts/gen-keys.ts >> .env` step to all quickstart guides
   - Update `README.md` line 58-63
   - Update `apps/web/content/docs/getting-started.mdx` line 27-36

3. **Document OPENAI_API_KEY Requirement**
   - Add to minimum required settings in all quickstart guides
   - Make it clear AI features won't work without it

4. **Improve Docker Error Messages**
   - Update `packages/db/scripts/compose.ts` to show helpful error message
   - Add Docker verification step in quickstart

### Priority 2: Important Improvements (Better UX)

1. **Document Optional Dependencies**
   - Add UV to prerequisites (optional)
   - Add Python 3.10+ to prerequisites (optional)
   - Document voice/embed setup in optional section

2. **Add Troubleshooting Section**
   - Common errors and fixes
   - Docker verification steps
   - Database connection issues

3. **Improve Installation Scripts**
   - Add `sudo -v` check to `scripts/install-poof.sh`
   - Better error messages for missing dependencies

### Priority 3: Nice-to-Have (Polish)

1. **Add Setup Verification Script**
   - Create `scripts/verify-setup.ts` to check all prerequisites
   - Verify Docker, Bun, Node.js, Python, UV availability

2. **Document Platform-Specific Requirements**
   - Linux: Docker, poof (optional)
   - macOS: Docker Desktop, MPS backend
   - Windows: Docker Desktop, WSL2

3. **Add Health Check After Setup**
   - Verify database connection
   - Verify API keys are set
   - Verify optional features if configured

## Implementation Checklist

- [ ] Add Docker to prerequisites in all quickstart docs
- [ ] Add key generation step to all quickstart guides
- [ ] Document `OPENAI_API_KEY` requirement
- [ ] Add optional voice/embed setup sections
- [ ] Improve Docker error messages
- [ ] Add troubleshooting section to quickstart
- [ ] Add `sudo -v` check to `install-poof.sh`
- [ ] Create `scripts/verify-setup.ts` for prerequisite checking
- [ ] Update `config/env.example` comments to reference quickstart
- [ ] Add platform-specific requirements section

## Related Files

- `README.md` - Main project README
- `docs/guides/developer-onboarding.md` - Developer guide
- `apps/web/content/docs/getting-started.mdx` - Web app quickstart
- `config/env.example` - Environment template
- `scripts/install-poof.sh` - Poof installation script
- `packages/db/scripts/compose.ts` - Docker Compose wrapper
- `packages/voice/scripts/install.sh` - Voice dependencies installer
- `packages/embed/scripts/install-deps.sh` - Embed dependencies installer
- `scripts/gen-keys.ts` - Auth key generator

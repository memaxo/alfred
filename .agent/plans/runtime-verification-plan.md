# Comprehensive Runtime Verification Plan

## Purpose
To establish a suite of "Level 4" verification scripts and tests that exercise the system in a real-world configuration, catching boundary defects (binary ABI mismatches, process crashes, network timeouts, DB locking) that unit and logic tests miss.

## Strategy
We will create a set of standalone scripts in `scripts/` that:
1.  **Run in the actual runtime environment** (not a mock test runner).
2.  **Spawn real child processes** (Python, Docker, Codex CLI).
3.  **Connect to real infrastructure** (Postgres, OpenAI, Local Network).
4.  **Verify side effects** (File creation, Audio playback, DB rows).

These scripts are intended to be run:
- Locally by developers before major merges.
- In CI/CD on runners with appropriate hardware/credentials.
- In "Smoke Test" mode during deployment.

## 1. Voice Verification (`scripts/verify-voice-runtime.ts`)
**Goal**: Verify the entire audio I/O pipeline with real binaries.

### Scope
- **STT**: Spawn `faster-whisper` (Python), feed a real WAV file, assert text output.
- **TTS**: Spawn `piper` (WASM/Python), feed text, assert valid PCM/WAV output.
- **Codec**: Use `ffmpeg` and `opus` to transcode the output.
- **Latency**: Measure and assert P95 latency requirements.

### Requirements
- `VOICE_PROVIDER=local`
- `PIPER_MODEL_PATH` populated
- `ffmpeg` installed
- Python environment (`uv`) ready

## 2. Orchestrator Verification (`scripts/verify-orchestrator-runtime.ts`)
**Goal**: Verify the agent can modify the filesystem and execute code.

### Scope
- **Codex CLI**: Execute a prompt "create a file named `verification-[timestamp].txt` with content `success`".
- **Sandboxing**: Verify the agent CANNOT write outside the allowed directory.
- **Docker**: (If available) Spin up a container, execute code inside, verify output.
- **Timeout**: Verify that long-running tasks are killed.

### Requirements
- `OPENAI_API_KEY`
- `CODEX_BIN` (optional, defaults to local CLI)
- Docker (optional)

## 3. Knowledge Graph Verification (`scripts/verify-graph-runtime.ts`)
**Goal**: Verify vector database operations and RAG pipeline.

### Scope
- **Embeddings**: Generate embeddings for a sample document (using local or remote model).
- **Ingest**: Insert document into Postgres (pgvector).
- **Retrieval**: Query using HNSW index and verify semantic relevance.
- **Performance**: Measure insertion and query time.

### Requirements
- `DATABASE_URL` (Postgres with `pgvector`)
- Embedding Model (Ollama or OpenAI)

## 4. Full Loop "Smoke Test" (`scripts/smoke-full-loop.ts`)
**Goal**: A single command to run all verification scripts in sequence.

### Logic
1. Check environment variables and binaries.
2. Run Graph verification (base layer).
3. Run Voice verification (input/output layer).
4. Run Orchestrator verification (action layer).
5. Report consolidated pass/fail status.

## Implementation Plan

### Phase 1: Voice Hardening
- [ ] Create `scripts/verify-voice-runtime.ts` (based on `test-tts.ts` but adding STT).
- [ ] Add sample audio fixture (`fixtures/hello.wav`).
- [ ] Add "strict" mode to fail on latency violations.

### Phase 2: Orchestrator Proving
- [ ] Create `scripts/verify-orchestrator-runtime.ts`.
- [ ] Implement `ToolWriter` that logs to stdout for visibility.
- [ ] Test both `auto="read"` and `auto="medium"` modes.

### Phase 3: Data Integrity
- [ ] Refine `scripts/smoke-hypergraph.ts` into `scripts/verify-graph-runtime.ts`.
- [ ] Add vector index consistency check.

### Phase 4: Automation
- [ ] Create `scripts/verify-all.ts`.
- [ ] Add `package.json` script: `bun run verify`.

## Next Steps
1.  Approve this plan.
2.  I will implement `scripts/verify-voice-runtime.ts` first as it's the most critical new surface area.

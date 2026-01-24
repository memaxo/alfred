# Voice: Maya1 Migration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

Replace the current speech generation system (Piper/OpenAI) entirely with **Maya1** (maya-research/maya1). Maya1 provides expressive, emotional voice generation (laugh, cry, whisper) and runs locally on a single GPU.

This migration involves:

1.  Adding Python dependencies (`transformers`, `snac`, `soundfile`) to `packages/voice`.
2.  Implementing a new Python inference script (`maya_tts.py`) that handles the Maya1 model loop and IPC.
3.  Creating a new TypeScript process wrapper (`MayaTTSProcess`) in `packages/voice`.
4.  Replacing `PiperTTSManager`/`TTSPool` usage with `MayaTTSProcess`.

## Progress

- [x] Phase 1: Dependencies & Environment
  - [x] Update `packages/voice/pyproject.toml` with new dependencies.
  - [x] Verify Python environment and GPU availability (Maya1 requires GPU for real-time).
- [x] Phase 2: Maya1 Implementation
  - [x] Create `packages/voice/scripts/maya_tts.py` (Python inference loop).
  - [x] Create `packages/voice/src/process/maya.ts` (TypeScript wrapper).
- [x] Phase 3: Integration & Replacement
  - [x] Update `packages/voice/src/process/tts.ts` to use `MayaTTSProcess`.
  - [x] Update `packages/voice/src/process/base.ts` config if needed.
  - [x] Test integration with `scripts/test-tts.ts`.
- [x] Phase 4: Cleanup
  - [x] Remove Piper dependencies and code if no longer needed.
- [x] Phase 5: Setup Automation
  - [x] Update `install-deps.sh` and `download_models.py`.
  - [x] Add `setup` script to `package.json` and `turbo.json`.
  - [x] Update documentation.

## Outcomes & Retrospective

Successfully migrated TTS from Piper (WASM) to Maya1 (3B Python/PyTorch model).

- **Quality**: Significantly improved with emotional range (laugh, cry, whisper) and natural prosody.
- **Latency**: Higher startup latency (~1s) compared to Piper, but acceptable for quality trade-off. Streaming implementation minimizes perceived latency.
- **Infrastructure**: Moved to a robust Python subprocess architecture managed by `uv`. This also enabled upgrading STT to NVIDIA NeMo Parakeet (120M) for better accuracy than Faster-Whisper.
- **Setup**: Fully automated via `bun run setup`.

**Surprises & Discoveries:**

- Maya1 requires significant VRAM (~6GB). Default TTS pool size set to 1 to prevent OOM on consumer GPUs.
- `uv sync` is much faster and more reliable than manual pip management.
- `ml_dtypes` version conflicts required pinning in `pyproject.toml`.

The current system uses `packages/voice/src/process/piper_tts.ts` (WASM-based) and `packages/voice/src/process/tts.ts` (Pool management). Maya1 is a 3B parameter model that must run in a Python subprocess to access GPU resources via PyTorch.

Maya1 inputs: Text with optional `<description="...">` and emotion tags (e.g., `<laugh>`, `<cry>`).
Maya1 outputs: SNAC tokens -> Decoded to 24kHz Audio.

## Plan of Work

### Phase 1: Dependencies & Environment

Add the following to `packages/voice/pyproject.toml`:

- `transformers`
- `snac`
- `soundfile`
- `accelerate` (likely needed for efficient loading)

Run `uv sync` to install.

### Phase 2: Maya1 Implementation

1.  **`packages/voice/scripts/maya_tts.py`**:
    - Load `AutoModelForCausalLM` and `AutoTokenizer` from `maya-research/maya1`.
    - Load `SNAC` decoder.
    - Implement the IPC loop reading from stdin (JSONL) and writing to stdout (JSONL).
    - Handle `synthesize` requests:
      - Parse `text`, `voice` (description), and `streaming` flags.
      - Run generation loop.
      - If streaming: emit chunks of audio.
      - If not streaming: emit full audio.
    - Optimizations: Keep model loaded. Use `torch.compile` if possible.

2.  **`packages/voice/src/process/maya.ts`**:
    - Extend `ModelProcess`.
    - Implement `synthesize` method matching `TTSRequest` interface.
    - Handle default voice description if none provided.

### Phase 3: Integration & Replacement

1.  **Update `packages/voice/src/process/tts.ts`**:
    - Replace `PiperTTSManager` with `MayaTTSProcess`.
    - Update `TTSPool` to manage `MayaTTSProcess` instances.
    - Since `MayaTTSProcess` is a subprocess (unlike `PiperTTSManager` which was in-process WASM), the pool logic might need to adapt to `ModelProcess` pool pattern (which `packages/voice/src/process/base.ts` supports).
    - _Note_: `TTSPool` currently wraps `PiperTTSManager`. It should be updated to wrap `MayaTTSProcess`.

### Phase 4: Cleanup

- Remove `packages/voice/src/process/piper_tts.ts`.
- Remove `piper-tts` from `pyproject.toml`.

## Interfaces and Dependencies

- **Input**: `TTSRequest { text: string, voice?: string }`.
  - `voice` field will now be interpreted as a Maya1 voice description string (or map a preset name to a description).
- **Output**: `TTSChunk { audioBase64: string, sampleRate: 24000 }`.

## Performance Considerations

- Maya1 is 3B parameters. It requires significant VRAM (approx 6-8GB in fp16/bf16).
- Inference latency needs to be monitored.
- Streaming is critical for perceived latency.

## Surprises & Discoveries

- (To be filled)

## Decision Log

- **Decision**: Use `ModelProcess` (Python subprocess) instead of WASM.
  - **Reason**: Maya1 is too large for WASM and requires GPU.

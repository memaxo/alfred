# Dual-Backend TTS Architecture - Implementation Summary

## Deliverables

### 1. Comprehensive Analysis & Planning

**Document:** `docs/execplans/dual-backend-tts-architecture.md`

Complete technical analysis including:

- Current IPC contract documentation
- Performance bottleneck analysis
- ROCm vs vLLM decision rationale
- MLX porting strategy
- Implementation phases with detailed steps

### 2. Core Implementation Files

#### Factory Pattern (`packages/voice/python/tts/server_factory.py`)

- Automatic backend detection (MLX → ROCm → MPS → CPU)
- Environment variable override support
- Graceful fallback handling
- Unified entry point for all backends

#### Abstract Base Class (`packages/voice/python/tts/base.py`)

- Shared IPC contract implementation
- Common caching logic
- Prompt building utilities
- Event loop handler

#### ROCm Backend (`packages/voice/python/tts/backend_rocm.py`)

- PyTorch + ROCm optimization
- 4-bit/8-bit quantization support (bitsandbytes)
- `torch.compile()` integration
- SNAC streaming implementation

#### MLX Backend (`packages/voice/python/tts/backend_mlx.py`)

- MLX framework integration
- Native Apple Silicon optimization
- SNAC streaming skeleton (decoder port pending)
- Weight conversion workflow

### 3. Conversion Tools

**Script:** `packages/voice/scripts/convert_maya1_to_mlx.py`

Converts HuggingFace Maya1 model to MLX format:

- Extracts weights from PyTorch model
- Converts to MLX arrays
- Optional quantization (4-bit/8-bit)
- Saves tokenizer and config

### 4. Dependency Management

**Updated:** `packages/voice/pyproject.toml`

Platform-specific dependencies:

- `bitsandbytes` (Linux only)
- `mlx` + `mlx-lm` (macOS only)
- ROCm PyTorch index configuration
- Automatic platform detection

### 5. Documentation

- **ExecPlan:** Full technical specification
- **Quick Start:** Usage guide and troubleshooting
- **Summary:** This document

## Architecture Decisions

### Why Raw PyTorch over vLLM?

1. **Latency:** vLLM's HTTP endpoint adds overhead (not suitable for <500ms TTFB)
2. **Custom Architecture:** Maya1 requires custom model loading (vLLM registry limitations)
3. **Direct Control:** Fine-tuned SNAC streaming optimization requires low-level access
4. **Deployment:** Simpler deployment (single process vs. HTTP server)

### Why Full MLX Port (Model + SNAC)?

1. **Performance:** MLX provides 3-5x speedup over MPS
2. **Unified Memory:** Eliminates CPU↔GPU transfers
3. **Latency:** Native Apple Silicon optimization critical for <500ms target
4. **Simplicity:** Mixing MLX + PyTorch requires tensor conversions (overhead)

### Factory Pattern Benefits

1. **Zero Node.js Changes:** Maintains IPC contract compatibility
2. **Easy Testing:** Can test backends independently
3. **Graceful Degradation:** Automatic fallback to available backend
4. **Future-Proof:** Easy to add new backends (e.g., CUDA, OpenVINO)

## Implementation Status

### ✅ Phase 1: Foundation (Complete)

- Factory pattern and base classes
- Backend skeletons
- Dependency management
- Conversion scripts

### ⏳ Phase 2: Backend Completion (In Progress)

- MLX SNAC decoder port (critical for MLX backend)
- ROCm backend optimization and testing
- MLX backend optimization and testing

### 📋 Phase 3: Deployment (Pending)

- Docker container for ROCm
- Performance benchmarking
- Integration testing
- Documentation updates

## Next Steps

### Immediate (Critical Path)

1. **MLX SNAC Decoder Port**
   - Port `snac` decoder to MLX arrays
   - Maintain sliding window logic
   - Test audio quality matches PyTorch version

2. **ROCm Backend Testing**
   - Test quantization (4-bit/8-bit)
   - Benchmark `torch.compile()` impact
   - Validate SNAC streaming performance

3. **MLX Backend Testing**
   - Test weight conversion script
   - Benchmark generation latency
   - Validate audio quality

### Short-term (1-2 weeks)

4. **Docker Containerization**
   - Create `Dockerfile.rocm`
   - Test in Proxmox environment
   - Document deployment process

5. **Performance Benchmarking**
   - Compare all backends (MLX, ROCm, MPS, CPU)
   - Measure TTFB and total generation time
   - Document memory usage

### Long-term (1+ month)

6. **Production Deployment**
   - Deploy ROCm backend to Proxmox
   - Monitor performance metrics
   - Optimize based on real-world usage

## Key Files Reference

| File                      | Purpose                        | Status               |
| ------------------------- | ------------------------------ | -------------------- |
| `server_factory.py`       | Entry point, backend detection | ✅ Complete          |
| `base.py`                 | Abstract base class            | ✅ Complete          |
| `backend_rocm.py`         | ROCm backend                   | ✅ Skeleton          |
| `backend_mlx.py`          | MLX backend                    | ⏳ SNAC port pending |
| `convert_maya1_to_mlx.py` | Weight conversion              | ✅ Complete          |
| `pyproject.toml`          | Dependencies                   | ✅ Updated           |

## Testing Checklist

- [ ] Factory detects correct backend on macOS
- [ ] Factory detects correct backend on Linux
- [ ] ROCm backend loads model successfully
- [ ] ROCm backend generates audio
- [ ] MLX backend loads converted model
- [ ] MLX backend generates audio (after SNAC port)
- [ ] IPC contract compatibility (Node.js integration)
- [ ] Performance targets met (TTFB, total time)
- [ ] Memory usage within limits

## Performance Targets

| Backend       | TTFB   | Total (short) | Memory |
| ------------- | ------ | ------------- | ------ |
| MLX           | <500ms | <2s           | ~6GB   |
| ROCm (4-bit)  | <1s    | <5s           | <8GB   |
| ROCm (8-bit)  | <1s    | <4s           | ~10GB  |
| MPS (current) | ~24s   | ~24s          | ~12GB  |

## Known Limitations

1. **MLX SNAC Decoder:** Not yet implemented (placeholder in code)
2. **ROCm Quantization:** Requires specific PyTorch builds (may need AutoGPTQ fallback)
3. **Weight Conversion:** One-time process (not automated in deployment)
4. **Docker:** ROCm container not yet created

## Questions & Answers

**Q: Can I use the factory launcher with existing Node.js code?**  
A: Yes, just update the script path in `TTSPool` to point to `server_factory.py`.

**Q: Do I need to convert models for ROCm backend?**  
A: No, ROCm backend uses HuggingFace models directly. Only MLX requires conversion.

**Q: What if MLX conversion fails?**  
A: Factory will fall back to MPS backend (current implementation).

**Q: Can I force a specific backend?**  
A: Yes, set `MAYA_BACKEND` environment variable (mlx, rocm, mps, cpu).

**Q: How do I test the ROCm backend locally?**  
A: Requires Linux with AMD GPU and ROCm drivers. Use Docker for isolation.

## Contact & Support

For questions or issues:

1. Check `docs/execplans/dual-backend-tts-architecture-quickstart.md`
2. Review implementation files for inline comments
3. Check ExecPlan for detailed technical decisions

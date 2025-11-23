"""
TTS server package for Maya1.

Backends:
- MLX: macOS/Apple Silicon (optimized for latency)
- ROCm: Linux/AMD GPUs (optimized for throughput)
- MPS: macOS fallback (current implementation)
- CPU: Universal fallback
"""

__version__ = "0.1.0"

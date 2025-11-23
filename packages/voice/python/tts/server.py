import os
import sys
import importlib
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger("TTSFactory")

def main():
    # Detect environment
    import platform
    system = platform.system()
    
    backend_class = None
    
    # Check for macOS with MPS
    if system == "Darwin":
        try:
            import torch
            if torch.backends.mps.is_available():
                logger.info("Detected macOS with MPS support. Attempting to load MLX backend.")
                # Try MLX first, fallback to generic MPS (which is what the old server.py was)
                try:
                    import mlx.core
                    from .backend_mlx import TTSServerMLX
                    backend_class = TTSServerMLX
                except ImportError:
                    logger.warning("MLX not found. Falling back to PyTorch MPS.")
                    from .backend_rocm import TTSServerROCm # We can reuse the PyTorch backend for MPS too
                    backend_class = TTSServerROCm
        except ImportError:
            pass

    # Check for Linux/ROCm
    elif system == "Linux":
        # Assume ROCm or CUDA
        logger.info("Detected Linux. Loading PyTorch backend (ROCm/CUDA).")
        try:
            from .backend_rocm import TTSServerROCm
            backend_class = TTSServerROCm
        except ImportError as e:
            logger.error(f"Failed to load ROCm backend: {e}")

    # Fallback
    if not backend_class:
        logger.warning("No optimized backend found. Loading generic PyTorch backend.")
        from .backend_rocm import TTSServerROCm
        backend_class = TTSServerROCm

    # Instantiate and run
    try:
        server = backend_class()
        server.run()
    except Exception as e:
        logger.critical(f"Fatal error starting server: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

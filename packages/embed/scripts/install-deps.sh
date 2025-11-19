#!/usr/bin/env bash
# Install embedding model dependencies with UV
# Creates virtual environment and installs dependencies using UV sync

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMBED_DIR="$(dirname "$SCRIPT_DIR")"

cd "$EMBED_DIR"

echo "Installing embedding model dependencies with UV..."

# Check if UV is available
if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Use UV sync with automatic PyTorch backend detection
echo "Creating virtual environment and installing dependencies..."
uv sync

echo "✓ Dependencies installed successfully in virtual environment (.venv)"

# Verify installation using UV run (uses virtual environment)
echo ""
echo "Verifying installation..."
uv run python -c "
try:
    from sentence_transformers import SentenceTransformer
    from huggingface_hub import snapshot_download
    import numpy as np
    print('✓ All core dependencies available')
except ImportError as e:
    print(f'✗ Missing dependency: {e}')
    exit(1)
"

# Check PyTorch backend
echo ""
echo "Checking PyTorch backend..."
uv run python -c "
import torch
print(f'PyTorch version: {torch.__version__}')

if torch.cuda.is_available():
    if hasattr(torch.version, 'hip'):
        print('✓ ROCm backend available (AMD GPU)')
    else:
        print('✓ CUDA backend available (NVIDIA GPU)')
elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('✓ MPS (Metal) backend available (Apple Silicon)')
else:
    print('ℹ CPU-only backend (no GPU acceleration)')
"

echo ""
echo "Installation complete!"
echo "Run 'bun run download-model' to download the embedding model"


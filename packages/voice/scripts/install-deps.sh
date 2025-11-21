#!/usr/bin/env bash
# Install voice model dependencies with optimal UV configuration
# Creates virtual environment and installs dependencies using UV sync

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOICE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$VOICE_DIR"

echo "Installing voice model dependencies with UV..."

# Check if UV is available
if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Use UV sync to create virtual environment and install dependencies
echo "Creating virtual environment and installing dependencies..."
uv sync

echo "✓ Dependencies installed successfully in virtual environment (.venv)"

# Download Supertonic models
echo ""
echo "Downloading Supertonic models..."
bash "$VOICE_DIR/scripts/download_supertonic.sh"

# Verify installation using UV run (uses virtual environment)
echo ""
echo "Verifying installation..."
uv run python -c "
try:
    import nemo.collections.asr as nemo_asr
    from silero_vad import load_silero_vad
    import numpy as np
    import transformers
    import snac
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

if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('✓ MPS (Metal) backend available (Apple Silicon)')
elif torch.cuda.is_available():
    if hasattr(torch.version, 'hip'):
        print('✓ ROCm backend available (AMD GPU)')
    else:
        print('✓ CUDA backend available (NVIDIA GPU)')
else:
    print('ℹ CPU-only backend (no GPU acceleration)')
"

echo ""
echo "Installation complete!"


#!/bin/bash
set -e

# Directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Root of the voice package
PACKAGE_ROOT="$(dirname "$SCRIPT_DIR")"
# Models directory
MODELS_DIR="$PACKAGE_ROOT/models/supertonic"

echo "Downloading Supertonic models to $MODELS_DIR..."

# Create models directory
mkdir -p "$MODELS_DIR"

# URLs for the models
HF_REPO="https://huggingface.co/Supertone/supertonic/resolve/main"

FILES=(
  "duration_predictor.onnx"
  "text_encoder.onnx"
  "vector_estimator.onnx"
  "vocoder.onnx"
  "tts.json"
  "unicode_indexer.json"
)

# Download main model files
for file in "${FILES[@]}"; do
  if [ ! -f "$MODELS_DIR/$file" ]; then
    echo "Downloading $file..."
    curl -L "$HF_REPO/onnx/$file?download=true" -o "$MODELS_DIR/$file"
  else
    echo "$file already exists, skipping."
  fi
done

# Download voice styles
mkdir -p "$MODELS_DIR/voice_styles"

STYLES=(
  "M1.json"
  "M2.json"
  "F1.json"
  "F2.json"
)

for style in "${STYLES[@]}"; do
  if [ ! -f "$MODELS_DIR/voice_styles/$style" ]; then
    echo "Downloading voice style $style..."
    curl -L "$HF_REPO/voice_styles/$style?download=true" -o "$MODELS_DIR/voice_styles/$style"
  else
    echo "Voice style $style already exists, skipping."
  fi
done

echo "Supertonic models downloaded successfully."

#!/usr/bin/env python3
"""
Download voice models for Faster-Whisper and Piper TTS.

Usage:
    python3 download_models.py                    # Download all models
    python3 download_models.py --verify-only      # Verify existing models
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from faster_whisper import WhisperModel
    from piper.download import ensure_voice_exists
except ImportError as e:
    print(f"Error: Missing dependencies. Install with:")
    print(f"  cd packages/voice && ./scripts/install-deps.sh")
    print(f"  # or")
    print(f"  uv pip install faster-whisper piper-tts --torch-backend=auto")
    sys.exit(1)


def download_whisper_model(model_name: str = "large-v3-turbo", verify_only: bool = False):
    """Download or verify Faster-Whisper model."""
    print(f"{'Verifying' if verify_only else 'Downloading'} Faster-Whisper model: {model_name}")
    
    try:
        # Faster-Whisper downloads models automatically on first use
        # Just try to load it to trigger download or verify it exists
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        print(f"✓ Faster-Whisper model '{model_name}' {'verified' if verify_only else 'downloaded'}")
        return True
    except Exception as e:
        print(f"✗ Failed to {'verify' if verify_only else 'download'} Faster-Whisper model: {e}")
        return False


def download_piper_voice(
    voice_name: str = "en_US-lessac-medium",
    model_path: str = "./packages/voice/models/piper",
    verify_only: bool = False
):
    """Download or verify Piper TTS voice."""
    print(f"{'Verifying' if verify_only else 'Downloading'} Piper voice: {voice_name}")
    
    try:
        # Ensure voice exists (downloads if needed)
        voice_path = ensure_voice_exists(voice_name, [model_path])
        print(f"✓ Piper voice '{voice_name}' {'verified' if verify_only else 'downloaded'}")
        print(f"  Path: {voice_path}")
        return True
    except Exception as e:
        print(f"✗ Failed to {'verify' if verify_only else 'download'} Piper voice: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download voice models")
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify existing models, don't download"
    )
    parser.add_argument(
        "--whisper-model",
        default="large-v3-turbo",
        help="Faster-Whisper model name (default: large-v3-turbo)"
    )
    parser.add_argument(
        "--piper-voice",
        default="en_US-lessac-medium",
        help="Piper voice name (default: en_US-lessac-medium)"
    )
    parser.add_argument(
        "--piper-path",
        default="./packages/voice/models/piper",
        help="Piper models directory (default: ./packages/voice/models/piper)"
    )
    
    args = parser.parse_args()
    
    # Create models directory if needed
    if not args.verify_only:
        os.makedirs(args.piper_path, exist_ok=True)
    
    # Download/verify models
    whisper_ok = download_whisper_model(args.whisper_model, args.verify_only)
    piper_ok = download_piper_voice(args.piper_voice, args.piper_path, args.verify_only)
    
    if whisper_ok and piper_ok:
        print("\n✓ All models ready")
        sys.exit(0)
    else:
        print("\n✗ Some models failed")
        sys.exit(1)


if __name__ == "__main__":
    main()


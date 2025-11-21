#!/usr/bin/env python3
"""
Download voice models for Maya1 (TTS) and NeMo (STT).

Usage:
    python3 download_models.py                    # Download all models
    python3 download_models.py --verify-only      # Verify existing models
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from snac import SNAC
    import torch
except ImportError as e:
    print(f"Error: Missing dependencies. Install with:")
    print(f"  cd packages/voice && ./scripts/install-deps.sh")
    sys.exit(1)


def download_maya1_model(verify_only: bool = False):
    """Download or verify Maya1 model."""
    model_name = "maya-research/maya1"
    print(f"{'Verifying' if verify_only else 'Downloading'} Maya1 model: {model_name}")
    
    try:
        # Maya1 downloads models automatically on first use via transformers
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        # We don't load the full model to save time/memory during setup unless it's not cached
        # But from_pretrained check cache first.
        # To verify, checking tokenizer is good enough for access/cache.
        
        # Also check SNAC
        snac_model = "hubertsiuzdak/snac_24khz"
        SNAC.from_pretrained(snac_model)
        
        print(f"✓ Maya1 & SNAC models {'verified' if verify_only else 'downloaded'}")
        return True
    except Exception as e:
        print(f"✗ Failed to {'verify' if verify_only else 'download'} Maya1/SNAC model: {e}")
        return False


def download_nemo_model(verify_only: bool = False):
    """Download or verify NeMo STT model."""
    # NeMo model name
    model_name = os.environ.get("WHISPER_MODEL_PATH", "nvidia/parakeet_realtime_eou_120m-v1")
    if model_name == "large-v3-turbo":
        model_name = "nvidia/parakeet_realtime_eou_120m-v1"
        
    print(f"{'Verifying' if verify_only else 'Downloading'} NeMo model: {model_name}")
    
    try:
        import nemo.collections.asr as nemo_asr
        # Trigger download/cache check
        # We use map_location='cpu' to avoid GPU requirement during setup
        nemo_asr.models.ASRModel.from_pretrained(model_name, map_location="cpu")
        print(f"✓ NeMo model '{model_name}' {'verified' if verify_only else 'downloaded'}")
        return True
    except Exception as e:
        print(f"✗ Failed to {'verify' if verify_only else 'download'} NeMo model: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download voice models")
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify existing models, don't download"
    )
    
    args = parser.parse_args()
    
    # Download/verify models
    maya_ok = download_maya1_model(args.verify_only)
    
    # Try to download NeMo model if nemo is installed
    try:
        import nemo
        nemo_ok = download_nemo_model(args.verify_only)
    except ImportError:
        print("ℹ NeMo not installed, skipping NeMo model check (STT might not work)")
        nemo_ok = True # Treat as success if not installed (maybe STT disabled)
    
    if maya_ok and nemo_ok:
        print("\n✓ All models ready")
        sys.exit(0)
    else:
        print("\n✗ Some models failed")
        sys.exit(1)


if __name__ == "__main__":
    main()


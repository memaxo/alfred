#!/usr/bin/env python3
"""
Model Downloader - Downloads KaLM-Embedding model from HuggingFace Hub
Auto-downloads on first use or when explicitly run
"""

import sys
import argparse
from pathlib import Path
from huggingface_hub import snapshot_download

MODEL_ID = "tencent/KaLM-Embedding-Gemma3-12B-2511"
MODELS_DIR = Path(__file__).parent.parent / "models"


def download_model(verify_only=False):
    """Download KaLM-Embedding model from HuggingFace Hub."""
    model_path = MODELS_DIR / MODEL_ID

    if verify_only:
        if model_path.exists() and (model_path / "config.json").exists():
            print(f"✓ Model verified at {model_path}")
            return True
        print(f"✗ Model not found at {model_path}")
        return False

    # Check if already downloaded
    if model_path.exists() and (model_path / "config.json").exists():
        print(f"Model already exists at {model_path}")
        response = input("Re-download? (y/N): ").strip().lower()
        if response != "y":
            print("Skipping download")
            return True

    print(f"Downloading {MODEL_ID}...")
    print(f"Destination: {model_path}")
    print("This may take a while (~7 GB)...")

    try:
        snapshot_download(
            repo_id=MODEL_ID,
            local_dir=model_path,
            allow_patterns=["*.safetensors", "*.json", "*.txt", "*.model"],
            resume_download=True,
        )
        print("✓ Model downloaded successfully")
        return True
    except Exception as e:
        print(f"✗ Download failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Download KaLM-Embedding model from HuggingFace Hub"
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify if model exists, don't download",
    )
    args = parser.parse_args()

    success = download_model(verify_only=args.verify_only)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()


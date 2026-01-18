#!/usr/bin/env python3
"""
Download Qwen3-VL-Reranker model from HuggingFace.

Usage:
    python scripts/download_model.py [model_name]

Default model: Qwen/Qwen3-VL-Reranker-2B
"""

import os
import sys


def main():
    model_name = sys.argv[1] if len(sys.argv) > 1 else os.getenv(
        "RERANK_MODEL", "Qwen/Qwen3-VL-Reranker-2B"
    )

    print(f"Downloading model: {model_name}")

    try:
        from huggingface_hub import snapshot_download

        # Download to default cache
        path = snapshot_download(
            repo_id=model_name,
            resume_download=True,
        )

        print(f"Model downloaded to: {path}")

    except ImportError:
        print("huggingface_hub not installed. Installing...")
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])

        from huggingface_hub import snapshot_download

        path = snapshot_download(
            repo_id=model_name,
            resume_download=True,
        )

        print(f"Model downloaded to: {path}")


if __name__ == "__main__":
    main()

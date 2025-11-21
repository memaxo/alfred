#!/usr/bin/env python3
"""
Download a specific Piper TTS voice.
Usage: python download_voice.py --voice en_US-lessac-medium
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from piper.download import ensure_voice_exists, get_voices
except ImportError:
    print(json.dumps({"status": "error", "message": "piper-tts not installed"}), file=sys.stderr)
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", required=True, help="Voice key (e.g. en_US-lessac-medium)")
    parser.add_argument("--model-dir", default="./packages/voice/models/piper", help="Directory to save models")
    args = parser.parse_args()

    model_dir = Path(args.model_dir).absolute()
    model_dir.mkdir(parents=True, exist_ok=True)

    print(json.dumps({
        "status": "info", 
        "message": f"Downloading {args.voice} to {model_dir}..."
    }))

    try:
        # Check if voice exists in registry first to avoid confusing errors
        # ensure_voice_exists will download it
        # It returns the path to the onnx file
        
        # Note: ensure_voice_exists might download to a cache dir by default if data_dir is not passed correctly.
        # Looking at piper implementation: ensure_voice_exists(name, data_dir, download_dir, update_voices)
        # The second arg is actually a list of data directories to SEARCH.
        # The third arg is where to DOWNLOAD.
        
        # We want to force download to our target dir if not found.
        
        path = ensure_voice_exists(
            args.voice, 
            [str(model_dir)], 
            str(model_dir)
        )
        
        print(json.dumps({
            "status": "success", 
            "message": f"Downloaded {args.voice}",
            "path": str(path)
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error", 
            "message": str(e)
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

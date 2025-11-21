#!/usr/bin/env python3
"""
List available Piper TTS voices.
Usage: python list_available_voices.py
"""

import json
import sys

try:
    from piper.download import get_voices
except ImportError:
    # If piper-tts is not installed/found, output empty list
    print(json.dumps([]))
    sys.exit(0)

def main():
    try:
        # get_voices returns a dict where keys are voice names (e.g. "en_US-lessac-medium")
        # and values are metadata
        voices_map = get_voices(None) # None = download fresh list if needed
        
        results = []
        for key, info in voices_map.items():
            results.append({
                "id": key,
                "name": info.get("name", key),
                "language": info.get("language", {}).get("code", "unknown"),
                "quality": info.get("quality", "unknown"),
                "num_speakers": info.get("num_speakers", 1)
            })
            
        # Sort by language then name
        results.sort(key=lambda x: (x["language"], x["id"]))
        
        print(json.dumps(results))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

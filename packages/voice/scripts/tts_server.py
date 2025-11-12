#!/usr/bin/env python3
"""
Piper TTS Server

Communicates via JSON lines over stdin/stdout.
Supports sentence-level streaming for low latency.
"""

import json
import os
import sys
from typing import Optional

try:
    from piper import PiperVoice
    from piper.download import ensure_voice_exists
    import numpy as np
except ImportError as e:
    print(json.dumps({
        "id": "error",
        "type": "error",
        "payload": {"message": f"Missing dependencies. Install with: cd packages/voice && ./scripts/install-deps.sh"}
    }), file=sys.stderr, flush=True)
    sys.exit(1)


class TTSServer:
    def __init__(self, model_path: str, voice: str = "en_US-lessac-medium"):
        """Initialize Piper TTS model."""
        self.model_path = model_path
        self.voice = voice
        
        print(json.dumps({
            "id": "init",
            "type": "status",
            "payload": {"message": f"Loading Piper voice {voice}..."}
        }), flush=True)
        
        try:
            # Ensure voice exists
            voice_path = ensure_voice_exists(voice, [model_path])
            
            self.voice_model = PiperVoice.load(voice_path)
        except Exception as e:
            print(json.dumps({
                "id": "error",
                "type": "error",
                "payload": {"message": f"Failed to load voice: {e}"}
            }), file=sys.stderr, flush=True)
            sys.exit(1)
        
        print(json.dumps({
            "id": "ready",
            "type": "status",
            "payload": {"message": "TTS server ready"}
        }), flush=True)
    
    def synthesize(self, text: str, streaming: bool = False) -> dict:
        """Synthesize text to speech."""
        import base64
        
        # Split into sentences for streaming
        sentences = self._split_sentences(text)
        
        if streaming:
            # Stream sentence by sentence
            audio_chunks = []
            for sentence in sentences:
                if not sentence.strip():
                    continue
                
                audio_data = self.voice_model.synthesize(sentence)
                audio_chunks.append(audio_data)
            
            # Combine chunks
            if audio_chunks:
                audio_array = np.concatenate(audio_chunks)
            else:
                audio_array = np.array([], dtype=np.int16)
        else:
            # Single synthesis
            audio_array = self.voice_model.synthesize(text)
        
        # Convert to base64
        audio_bytes = audio_array.astype(np.int16).tobytes()
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        
        return {
            "audioBase64": audio_base64,
            "mimeType": "audio/pcm",
            "sampleRate": self.voice_model.config.sample_rate,
        }
    
    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        import re
        # Simple sentence splitting on punctuation
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def run(self):
        """Main event loop."""
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                
                request = json.loads(line.strip())
                request_id = request.get("id", "unknown")
                request_type = request.get("type", "")
                payload = request.get("payload", {})
                
                if request_type == "ping":
                    print(json.dumps({
                        "id": request_id,
                        "type": "status",
                        "payload": {"message": "pong"}
                    }), flush=True)
                
                elif request_type == "synthesize":
                    text = payload.get("text", "")
                    streaming = payload.get("streaming", False)
                    
                    result = self.synthesize(text, streaming)
                    
                    print(json.dumps({
                        "id": request_id,
                        "type": "audio",
                        "payload": result
                    }), flush=True)
                
                elif request_type == "shutdown":
                    break
                
            except json.JSONDecodeError:
                print(json.dumps({
                    "id": "error",
                    "type": "error",
                    "payload": {"message": "Invalid JSON"}
                }), file=sys.stderr, flush=True)
            except Exception as e:
                print(json.dumps({
                    "id": request_id if 'request_id' in locals() else "error",
                    "type": "error",
                    "payload": {"message": str(e)}
                }), file=sys.stderr, flush=True)


def main():
    """Entry point."""
    model_path = os.getenv("PIPER_MODEL_PATH", "./packages/voice/models/piper")
    voice = os.getenv("PIPER_VOICE", "en_US-lessac-medium")
    
    server = TTSServer(model_path, voice)
    server.run()


if __name__ == "__main__":
    main()


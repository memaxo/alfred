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
    import numpy as np
except ImportError as e:
    print(json.dumps({
        "id": "error",
        "type": "error",
        "payload": {
            "message": f"Missing dependencies: {str(e)}",
            "error_type": type(e).__name__
        }
    }), file=sys.stderr, flush=True)
    sys.exit(1)


class TTSServer:
    def __init__(self, model_path: str, default_voice: str = "en_US-lessac-medium"):
        """Initialize Piper TTS server."""
        self.model_path = model_path
        self.default_voice = default_voice
        self.models = {}
        
        print(json.dumps({
            "id": "init",
            "type": "status",
            "payload": {"message": f"Initializing TTS server with default voice {default_voice}..."}
        }), flush=True)
        
        # Pre-load default voice
        self._load_voice(default_voice)
        
        print(json.dumps({
            "id": "ready",
            "type": "status",
            "payload": {"message": "TTS server ready"}
        }), flush=True)

    def _load_voice(self, voice: str):
        """Load a voice model if not already loaded."""
        if voice in self.models:
            return self.models[voice]
            
        try:
            # Voice format: en_US-lessac-medium -> en_US-lessac-medium.onnx
            voice_path = os.path.join(self.model_path, f"{voice}.onnx")
            config_path = os.path.join(self.model_path, f"{voice}.onnx.json")
            
            # Check if files exist
            if not os.path.exists(voice_path):
                raise FileNotFoundError(f"Voice model not found: {voice_path}")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Voice config not found: {config_path}")
            
            print(json.dumps({
                "id": "load",
                "type": "status",
                "payload": {"message": f"Loading voice {voice}..."}
            }), file=sys.stderr, flush=True)
            
            model = PiperVoice.load(voice_path, config_path)
            self.models[voice] = model
            return model
        except Exception as e:
            print(json.dumps({
                "id": "error",
                "type": "error",
                "payload": {"message": f"Failed to load voice {voice}: {e}"}
            }), file=sys.stderr, flush=True)
            raise

    def synthesize(self, text: str, voice: Optional[str] = None, streaming: bool = False) -> dict:
        """Synthesize text to speech."""
        import base64
        import time
        
        target_voice = voice if voice else self.default_voice
        
        try:
            model = self._load_voice(target_voice)
        except Exception as e:
            # Fallback to default voice if specific voice fails
            if target_voice != self.default_voice:
                 print(json.dumps({
                    "id": "warning",
                    "type": "status",
                    "payload": {"message": f"Voice {target_voice} failed, falling back to default"}
                }), file=sys.stderr, flush=True)
                 model = self._load_voice(self.default_voice)
            else:
                raise
        
        start_time = time.time()
        
        # Split into sentences for streaming
        sentences = self._split_sentences(text)
        
        # Collect all audio chunks from the generator
        audio_arrays = []
        
        if streaming:
            # Stream sentence by sentence
            for sentence in sentences:
                if not sentence.strip():
                    continue
                
                for audio_chunk in model.synthesize(sentence):
                    if hasattr(audio_chunk, "audio_int16_array"):
                        audio_arrays.append(audio_chunk.audio_int16_array)
                    elif hasattr(audio_chunk, "audio"):
                        audio_arrays.append(audio_chunk.audio)
                    else:
                        raise ValueError(f"Unexpected AudioChunk structure: {type(audio_chunk)!r}")
        else:
            # Single synthesis - collect all chunks
            for audio_chunk in model.synthesize(text):
                if hasattr(audio_chunk, "audio_int16_array"):
                    audio_arrays.append(audio_chunk.audio_int16_array)
                elif hasattr(audio_chunk, "audio"):
                    audio_arrays.append(audio_chunk.audio)
                else:
                    raise ValueError(f"Unexpected AudioChunk structure: {type(audio_chunk)!r}")
        
        # Combine all audio chunks
        if audio_arrays:
            audio_array = np.concatenate(audio_arrays)
        else:
            audio_array = np.array([], dtype=np.int16)
        
        # Convert to base64
        audio_bytes = audio_array.astype(np.int16).tobytes()
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        
        duration = time.time() - start_time
        
        # Log performance metrics
        print(json.dumps({
            "id": "perf",
            "type": "status",
            "payload": {
                "synthesis_duration_ms": duration * 1000,
                "sample_count": len(audio_array),
                "text_length": len(text),
                "voice": target_voice
            }
        }), file=sys.stderr, flush=True)
        
        return {
            "audioBase64": audio_base64,
            "mimeType": "audio/pcm",
            "sampleRate": model.config.sample_rate,
        }
    
    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        import re
        # Improved sentence splitting that keeps punctuation
        # Splits on whitespace following punctuation (.?!)
        # This preserves the punctuation mark with the preceding sentence
        sentences = re.split(r'(?<=[.!?])\s+', text)
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
                    voice = payload.get("voice")
                    streaming = payload.get("streaming", False)
                    
                    result = self.synthesize(text, voice, streaming)
                    
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

#!/usr/bin/env python3
"""
Faster-Whisper STT Server

Communicates via JSON lines over stdin/stdout.
Supports VAD (Voice Activity Detection) for streaming transcription.
"""

import json
import os
import sys
from typing import Optional

try:
    from faster_whisper import WhisperModel
    from silero_vad import load_silero_vad_model, get_speech_timestamps
    import numpy as np
except ImportError as e:
    print(json.dumps({
        "id": "error",
        "type": "error",
        "payload": {"message": f"Missing dependencies. Install with: cd packages/voice && ./scripts/install-deps.sh"}
    }), file=sys.stderr, flush=True)
    sys.exit(1)


class STTServer:
    def __init__(self, model_path: str, device: Optional[str] = None, compute_type: str = "int8"):
        """Initialize Faster-Whisper model with VAD."""
        self.model_path = model_path
        
        # Auto-detect device if not specified
        if device is None:
            if self._has_mps():
                device = "mps"
            elif self._has_rocm():
                device = "rocm"
            elif self._has_cuda():
                device = "cuda"
            else:
                device = "cpu"
        
        # Determine actual device based on availability (priority: mps > rocm > cuda > cpu)
        if device == "mps" and self._has_mps():
            self.device = "mps"
            self.compute_type = compute_type
        elif device == "rocm" and self._has_rocm():
            self.device = "cuda"  # Faster-Whisper uses "cuda" for both CUDA and ROCm
            self.compute_type = compute_type
        elif device == "cuda" and self._has_cuda():
            self.device = "cuda"
            self.compute_type = compute_type
        else:
            self.device = "cpu"
            self.compute_type = "int8"
        
        # Load model
        print(json.dumps({
            "id": "init",
            "type": "status",
            "payload": {"message": f"Loading model from {model_path}..."}
        }), flush=True)
        
        try:
            self.model = WhisperModel(
                model_path,
                device=self.device,
                compute_type=self.compute_type,
                num_workers=4
            )
        except Exception as e:
            print(json.dumps({
                "id": "error",
                "type": "error",
                "payload": {"message": f"Failed to load model: {e}"}
            }), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # Load VAD model
        try:
            self.vad_model, self.vad_utils = load_silero_vad_model()
        except Exception as e:
            print(json.dumps({
                "id": "warning",
                "type": "status",
                "payload": {"message": f"VAD model not available: {e}"}
            }), flush=True)
            self.vad_model = None
        
        print(json.dumps({
            "id": "ready",
            "type": "status",
            "payload": {"message": "STT server ready"}
        }), flush=True)
    
    def _has_mps(self) -> bool:
        """Check if Metal Performance Shaders (Apple Silicon) is available."""
        try:
            import torch
            return torch.backends.mps.is_available()
        except (ImportError, AttributeError):
            return False
    
    def _has_rocm(self) -> bool:
        """Check if ROCm (AMD GPU) is available."""
        try:
            import torch
            return torch.cuda.is_available() and hasattr(torch.version, "hip")
        except (ImportError, AttributeError):
            return False
    
    def _has_cuda(self) -> bool:
        """Check if CUDA (NVIDIA GPU) is available."""
        try:
            import torch
            return torch.cuda.is_available() and not hasattr(torch.version, "hip")
        except (ImportError, AttributeError):
            return False
    
    def transcribe(self, audio_base64: str, language: Optional[str] = None, prompt: Optional[str] = None) -> dict:
        """Transcribe audio from base64 string."""
        import base64
        
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        
        # Convert to numpy array (assuming 16kHz mono PCM)
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        
        # Apply VAD if available
        if self.vad_model:
            try:
                speech_timestamps = get_speech_timestamps(
                    audio_array,
                    self.vad_model,
                    sampling_rate=16000,
                    **self.vad_utils
                )
                if not speech_timestamps:
                    return {
                        "text": "",
                        "language": language,
                        "isPartial": False,
                        "isEmpty": True,
                    }
            except Exception:
                # VAD failed, continue without it
                pass
        
        # Transcribe
        segments, info = self.model.transcribe(
            audio_array,
            language=language,
            initial_prompt=prompt,
            beam_size=5,
        )
        
        # Collect text
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)
        
        text = " ".join(text_parts).strip()
        
        return {
            "text": text,
            "language": info.language,
            "isPartial": False,
            "isEmpty": len(text) == 0,
            "model": self.model_path,
        }
    
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
                
                elif request_type == "transcribe":
                    audio_base64 = payload.get("audioBase64", "")
                    language = payload.get("language")
                    prompt = payload.get("prompt")
                    
                    result = self.transcribe(audio_base64, language, prompt)
                    
                    print(json.dumps({
                        "id": request_id,
                        "type": "transcript",
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
    model_path = os.getenv("WHISPER_MODEL_PATH", "large-v3-turbo")
    device = os.getenv("WHISPER_DEVICE")  # None triggers auto-detection
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    
    server = STTServer(model_path, device, compute_type)
    server.run()


if __name__ == "__main__":
    main()


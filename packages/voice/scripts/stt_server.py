#!/usr/bin/env python3
"""
NeMo Parakeet STT Server

Communicates via JSON lines over stdin/stdout.
Uses NVIDIA Parakeet-Realtime-EOU-120m-v1 model.
"""

import json
import os
import sys
import tempfile
import base64
import logging
from typing import Optional

# Configure logging to stderr to avoid corrupting stdout JSON stream
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("NeMoSTT")

try:
    import torch
    import nemo.collections.asr as nemo_asr
    from silero_vad import load_silero_vad, get_speech_timestamps
    import numpy as np
    import soundfile as sf
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


class STTServer:
    def __init__(self, model_name: str, device: Optional[str] = None):
        """Initialize NeMo Parakeet model with VAD."""
        self.model_name = model_name
        
        # Device detection logic
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                # Check if MPS is actually usable (some ops might fall back)
                try:
                    x = torch.ones(1, device="mps")
                    self.device = "mps"
                except:
                    self.device = "cpu"
            else:
                self.device = "cpu"
        else:
            self.device = device

        logger.info(f"Initializing STT Server on device: {self.device}")
        
        print(json.dumps({
            "id": "init",
            "type": "status",
            "payload": {"message": f"Loading NeMo model {model_name} on {self.device}..."}
        }), flush=True)
        
        try:
            # NeMo loads models to CUDA by default if available, map_location helps for CPU/MPS
            map_location = torch.device(self.device)
            
            # For Parakeet, we use the ASRModel.from_pretrained interface
            # Note: NeMo might try to move to CUDA inside from_pretrained if not careful
            self.model = nemo_asr.models.ASRModel.from_pretrained(
                model_name=model_name,
                map_location=map_location
            )
            
            # Ensure model is in eval mode
            self.model.freeze()
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            # Fallback to CPU if MPS/CUDA failed
            if self.device != "cpu":
                logger.info("Falling back to CPU...")
                try:
                    self.device = "cpu"
                    self.model = nemo_asr.models.ASRModel.from_pretrained(
                        model_name=model_name,
                        map_location=torch.device("cpu")
                    )
                    self.model.freeze()
                except Exception as e_cpu:
                    print(json.dumps({
                        "id": "error",
                        "type": "error",
                        "payload": {"message": f"Failed to load model on CPU fallback: {e_cpu}"}
                    }), file=sys.stderr, flush=True)
                    sys.exit(1)
            else:
                print(json.dumps({
                    "id": "error",
                    "type": "error",
                    "payload": {"message": f"Failed to load model: {e}"}
                }), file=sys.stderr, flush=True)
                sys.exit(1)
        
        # Load VAD model (Silero)
        try:
            self.vad_model = load_silero_vad()
        except Exception as e:
            logger.warning(f"VAD model not available: {e}")
            self.vad_model = None
        
        print(json.dumps({
            "id": "ready",
            "type": "status",
            "payload": {"message": "STT server ready"}
        }), flush=True)
    
    def transcribe(
        self,
        audio_base64: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        vad_threshold: Optional[float] = None,
        session_id: Optional[str] = None,
    ) -> dict:
        """Transcribe audio from base64 string."""
        
        # Decode audio
        try:
            audio_data = base64.b64decode(audio_base64)
        except Exception as e:
            raise ValueError(f"Invalid base64 audio: {e}")

        # VAD Processing (using numpy buffer)
        # Convert to numpy array (assuming 16kHz mono PCM 16-bit)
        # Note: NeMo usually expects wav files or specific input. Silero expects float32 numpy.
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        total_samples = len(audio_array)
        duration_seconds = float(total_samples) / 16000.0 if total_samples > 0 else 0.0
        
        vad_confidence = 0.0
        end_of_utterance_silero = False
        
        if self.vad_model:
            try:
                vad_kwargs = {}
                if vad_threshold is not None:
                    vad_kwargs["threshold"] = float(vad_threshold)
                
                # Silero expects float32 tensor/array
                speech_timestamps = get_speech_timestamps(
                    audio_array,
                    self.vad_model,
                    sampling_rate=16000,
                    **vad_kwargs
                )
                
                speech_samples = 0
                for ts in speech_timestamps:
                    start = int(ts.get("start", 0))
                    end = int(ts.get("end", 0))
                    if end > start:
                        speech_samples += end - start
                
                if total_samples > 0:
                    vad_confidence = min(1.0, max(0.0, speech_samples / float(total_samples)))
                
                end_of_utterance_silero = (speech_samples == 0)
                
                # If strictly no speech detected by VAD, we could return empty early.
                # But sometimes VAD misses faint speech that ASR catches, so we proceed unless empty.
                if total_samples == 0:
                     return {
                        "text": "",
                        "language": "en",
                        "isPartial": False,
                        "isEmpty": True,
                        "model": self.model_name,
                        "durationSeconds": duration_seconds,
                        "vadConfidence": 0.0,
                        "endOfUtterance": True,
                    }
                    
            except Exception as e:
                logger.warning(f"VAD processing failed: {e}")
        
        # Transcription with NeMo
        # NeMo transcribe() takes a list of paths
        text = ""
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp_wav:
            # Write PCM16 buffer to WAV file for NeMo
            sf.write(tmp_wav.name, audio_array, 16000, subtype='PCM_16', format='WAV')
            tmp_wav.flush()
            
            try:
                # transcribe() returns a list of strings
                # verbose=False to avoid stdout pollution
                transcriptions = self.model.transcribe(paths2audio_files=[tmp_wav.name], verbose=False)
                if transcriptions and len(transcriptions) > 0:
                    text = transcriptions[0]
            except Exception as e:
                logger.error(f"NeMo transcription failed: {e}")
                raise e

        # Post-process text
        # Parakeet outputs raw lowercase.
        # Check for <EOU> token
        has_eou_token = "<EOU>" in text
        text = text.replace("<EOU>", "").strip()
        
        end_of_utterance = has_eou_token or end_of_utterance_silero
        
        return {
            "text": text,
            "language": "en", # Parakeet is English only
            "isPartial": False,
            "isEmpty": len(text) == 0,
            "model": self.model_name,
            "durationSeconds": duration_seconds,
            "vadConfidence": vad_confidence,
            "endOfUtterance": end_of_utterance,
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
                    vad_threshold = payload.get("vadThreshold")
                    session_id = payload.get("sessionId")
                    
                    try:
                        result = self.transcribe(
                            audio_base64,
                            language,
                            prompt,
                            vad_threshold,
                            session_id,
                        )
                        
                        print(json.dumps({
                            "id": request_id,
                            "type": "transcript",
                            "payload": result
                        }), flush=True)
                    except Exception as e:
                        logger.error(f"Transcription error: {e}")
                        print(json.dumps({
                            "id": request_id,
                            "type": "error",
                            "payload": {"message": str(e)}
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
    # Default to Parakeet EOU 120m if not specified
    model_name = os.getenv("WHISPER_MODEL_PATH", "nvidia/parakeet_realtime_eou_120m-v1")
    if model_name == "large-v3-turbo": # Override old default
        model_name = "nvidia/parakeet_realtime_eou_120m-v1"
        
    device = os.getenv("WHISPER_DEVICE")  # None triggers auto-detection
    
    server = STTServer(model_name, device)
    server.run()


if __name__ == "__main__":
    main()

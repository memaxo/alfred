"""
Core STT Server implementation
"""

import json
import os
import sys
import time
import traceback
import base64
import tempfile
import logging
import numpy as np
import soundfile as sf
from typing import Optional

logger = logging.getLogger("NeMoSTT")

class STTServer:
    def __init__(self, model_name: str, device: Optional[str] = None):
        """Initialize NeMo Parakeet model with VAD."""
        import torch
        import nemo.collections.asr as nemo_asr
        from silero_vad import load_silero_vad
        
        self.model_name = model_name
        self.start_time = time.time()
        
        # Device detection logic
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                try:
                    # Test MPS capability
                    x = torch.ones(1, device="mps")
                    self.device = "mps"
                except Exception as e:
                    logger.warning(f"MPS available but failed test: {e}. Fallback to CPU.")
                    self.device = "cpu"
            else:
                self.device = "cpu"
        else:
            self.device = device

        logger.info(f"Initializing STT Server on device: {self.device}")
        
        # Signal initialization start
        print(json.dumps({
            "id": "init",
            "type": "status",
            "payload": {"message": f"Loading NeMo model {model_name} on {self.device}..."}
        }), flush=True)
        
        try:
            load_start = time.time()
            
            # NeMo loads models to CUDA by default if available, map_location helps for CPU/MPS
            map_location = torch.device(self.device)
            
            self.model = nemo_asr.models.ASRModel.from_pretrained(
                model_name=model_name,
                map_location=map_location
            )
            
            # Move to device explicitly (required for MPS/CUDA sometimes after load)
            if self.device != "cpu":
                self.model.to(self.device)
                
            # Ensure model is in eval mode
            self.model.freeze()
            
            load_duration = time.time() - load_start
            logger.info(f"Model loaded in {load_duration:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            # Detailed error reporting
            print(json.dumps({
                "id": "init_error",
                "type": "error",
                "payload": {
                    "message": f"Failed to load model: {str(e)}",
                    "traceback": traceback.format_exc()
                }
            }), file=sys.stdout, flush=True)
            sys.exit(1)
        
        # Load VAD model (Silero)
        try:
            self.vad_model = load_silero_vad()
            logger.info("VAD model loaded successfully")
        except Exception as e:
            logger.warning(f"VAD model not available: {e}")
            self.vad_model = None
        
        # Ready signal
        print(json.dumps({
            "id": "ready",
            "type": "status",
            "payload": {
                "message": "STT server ready",
                "device": self.device,
                "model": self.model_name,
                "startup_time": time.time() - self.start_time
            }
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
        from silero_vad import get_speech_timestamps
        
        start_ts = time.time()
        
        # Decode audio
        try:
            audio_data = base64.b64decode(audio_base64)
        except Exception as e:
            raise ValueError(f"Invalid base64 audio: {e}")

        # VAD Processing (using numpy buffer)
        # Convert to numpy array (assuming 16kHz mono PCM 16-bit)
        try:
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        except Exception as e:
             raise ValueError(f"Invalid audio data format (expected PCM16): {e}")
             
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
        text = ""
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp_wav:
            # Write PCM16 buffer to WAV file for NeMo
            sf.write(tmp_wav.name, audio_array, 16000, subtype='PCM_16', format='WAV')
            tmp_wav.flush()
            
            try:
                # transcribe() returns a list of strings
                # verbose=False to avoid stdout pollution
                # batch_size=1 for single request
                transcriptions = self.model.transcribe(paths2audio_files=[tmp_wav.name], batch_size=1, verbose=False)
                if transcriptions and len(transcriptions) > 0:
                    text = transcriptions[0]
            except Exception as e:
                logger.error(f"NeMo transcription failed: {e}")
                raise e

        # Post-process text
        # Check for <EOU> token
        has_eou_token = "<EOU>" in text
        text = text.replace("<EOU>", "").strip()
        
        end_of_utterance = has_eou_token or end_of_utterance_silero
        
        processing_time = time.time() - start_ts
        logger.info(f"Transcribed {duration_seconds:.2f}s audio in {processing_time:.2f}s (RTF: {processing_time/duration_seconds:.2f})")
        
        return {
            "text": text,
            "language": "en", # Parakeet is English only
            "isPartial": False,
            "isEmpty": len(text) == 0,
            "model": self.model_name,
            "durationSeconds": duration_seconds,
            "vadConfidence": vad_confidence,
            "endOfUtterance": end_of_utterance,
            "processingTime": processing_time
        }

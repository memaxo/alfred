"""
Core STT Server implementation with Nemotron Speech ASR.

Supports cache-aware streaming for efficient, high-accuracy transcription.
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
from dataclasses import dataclass

logger = logging.getLogger("NemotronSTT")

# Chunk size configurations: [left_context, right_context] in 80ms frames
CHUNK_CONFIGS = {
    "fast": [70, 0],      # 80ms chunks - lowest latency
    "low": [70, 1],       # 160ms chunks
    "medium": [70, 6],    # 560ms chunks - balanced
    "accurate": [70, 13], # 1.12s chunks - highest accuracy
}

DEFAULT_CHUNK_SIZE = "medium"


@dataclass
class SessionCache:
    """Cache state for a streaming session."""
    cache_last_channel: Optional[object] = None
    cache_last_time: Optional[object] = None
    cache_last_channel_len: int = 0
    previous_hypotheses: list = None
    pred_out_stream: list = None
    step_num: int = 0
    
    def __post_init__(self):
        if self.previous_hypotheses is None:
            self.previous_hypotheses = []
        if self.pred_out_stream is None:
            self.pred_out_stream = []


class STTServer:
    def __init__(
        self,
        model_name: str,
        device: Optional[str] = None,
        chunk_size: str = DEFAULT_CHUNK_SIZE
    ):
        """Initialize Nemotron Speech ASR model with cache-aware streaming."""
        import torch
        import nemo.collections.asr as nemo_asr
        from silero_vad import load_silero_vad
        
        self.model_name = model_name
        self.chunk_size = chunk_size
        self.start_time = time.time()
        
        # Session caches for stateful streaming
        self.session_caches: dict[str, SessionCache] = {}
        
        # Device detection logic
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                try:
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
            "payload": {"message": f"Loading Nemotron model {model_name} on {self.device}..."}
        }), flush=True)
        
        try:
            load_start = time.time()
            
            map_location = torch.device(self.device)
            
            self.model = nemo_asr.models.ASRModel.from_pretrained(
                model_name=model_name,
                map_location=map_location
            )
            
            if self.device != "cpu":
                self.model.to(self.device)
                
            self.model.freeze()
            
            # Configure cache-aware streaming
            self._configure_streaming()
            
            load_duration = time.time() - load_start
            logger.info(f"Model loaded in {load_duration:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
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
                "chunk_size": self.chunk_size,
                "streaming_enabled": self.streaming_enabled,
                "startup_time": time.time() - self.start_time
            }
        }), flush=True)
    
    def _configure_streaming(self):
        """Configure cache-aware streaming for the model."""
        self.streaming_enabled = False
        
        # Check if model supports cache-aware streaming
        if not hasattr(self.model, 'encoder') or not hasattr(self.model.encoder, 'streaming_cfg'):
            logger.info("Model does not support cache-aware streaming, using batch mode")
            return
        
        # IMPORTANT: Do NOT call change_attention_model() here!
        # Nemotron's transcribe() method handles streaming configuration internally.
        # Calling change_attention_model() breaks batch transcription.
        # We only enable streaming_enabled flag to allow cache-aware streaming
        # when explicitly requested via the streaming=True parameter.
        
        logger.info("Streaming support available, but NOT reconfiguring attention model for batch compatibility")
        self.streaming_enabled = True
    
    def _get_or_create_session_cache(self, session_id: str) -> SessionCache:
        """Get existing session cache or create new one."""
        if session_id not in self.session_caches:
            self.session_caches[session_id] = SessionCache()
        return self.session_caches[session_id]
    
    def clear_session_cache(self, session_id: str) -> bool:
        """Clear cache for a specific session."""
        if session_id in self.session_caches:
            del self.session_caches[session_id]
            logger.info(f"Cleared cache for session {session_id}")
            return True
        return False
    
    def _process_vad(self, audio_array: np.ndarray, vad_threshold: Optional[float] = None) -> tuple[float, bool]:
        """Process VAD on audio array. Returns (confidence, end_of_utterance)."""
        from silero_vad import get_speech_timestamps
        
        vad_confidence = 0.0
        end_of_utterance = False
        total_samples = len(audio_array)
        
        if self.vad_model and total_samples > 0:
            try:
                vad_kwargs = {}
                if vad_threshold is not None:
                    vad_kwargs["threshold"] = float(vad_threshold)
                
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
                
                vad_confidence = min(1.0, max(0.0, speech_samples / float(total_samples)))
                end_of_utterance = (speech_samples == 0)
                
            except Exception as e:
                logger.warning(f"VAD processing failed: {e}")
        
        return vad_confidence, end_of_utterance
    
    def transcribe(
        self,
        audio_base64: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        vad_threshold: Optional[float] = None,
        session_id: Optional[str] = None,
        streaming: bool = False,
        chunk_size: Optional[str] = None,
        clear_cache: bool = False,
    ) -> dict:
        """
        Transcribe audio from base64 string.
        
        For streaming mode with session_id, maintains cache state between calls
        for cache-aware transcription (Nemotron's key feature).
        """
        start_ts = time.time()
        
        # Handle cache clear request
        if clear_cache and session_id:
            self.clear_session_cache(session_id)
        
        # Decode audio
        try:
            audio_data = base64.b64decode(audio_base64)
        except Exception as e:
            raise ValueError(f"Invalid base64 audio: {e}")

        # Convert to numpy array (assuming 16kHz mono PCM 16-bit)
        try:
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        except Exception as e:
            raise ValueError(f"Invalid audio data format (expected PCM16): {e}")
             
        total_samples = len(audio_array)
        duration_seconds = float(total_samples) / 16000.0 if total_samples > 0 else 0.0
        
        # Empty audio check
        if total_samples == 0:
            return {
                "text": "",
                "language": "en",
                "isPartial": False,
                "isEmpty": True,
                "model": self.model_name,
                "durationSeconds": 0.0,
                "vadConfidence": 0.0,
                "endOfUtterance": True,
            }
        
        # VAD Processing
        vad_confidence, end_of_utterance_vad = self._process_vad(audio_array, vad_threshold)
        
        # Transcription
        text = ""
        is_partial = streaming and not end_of_utterance_vad
        
        # Use cache-aware streaming if available and session_id provided
        if self.streaming_enabled and session_id and streaming:
            text = self._transcribe_streaming(audio_array, session_id)
        else:
            text = self._transcribe_batch(audio_array)
        
        # Post-process text - check for end-of-utterance token
        has_eou_token = "<EOU>" in text
        text = text.replace("<EOU>", "").strip()
        
        end_of_utterance = has_eou_token or end_of_utterance_vad
        
        processing_time = time.time() - start_ts
        rtf = processing_time / duration_seconds if duration_seconds > 0 else 0
        logger.info(f"Transcribed {duration_seconds:.2f}s audio in {processing_time:.2f}s (RTF: {rtf:.2f})")
        
        return {
            "text": text,
            "language": "en",
            "isPartial": is_partial and not end_of_utterance,
            "isEmpty": len(text) == 0,
            "model": self.model_name,
            "durationSeconds": duration_seconds,
            "vadConfidence": vad_confidence,
            "endOfUtterance": end_of_utterance,
            "processingTime": processing_time,
            "streamingEnabled": self.streaming_enabled,
        }
    
    def _transcribe_batch(self, audio_array: np.ndarray) -> str:
        """Batch transcription (non-streaming, stateless)."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp_wav:
            sf.write(tmp_wav.name, audio_array, 16000, subtype='PCM_16', format='WAV')
            tmp_wav.flush()
            
            try:
                transcriptions = self.model.transcribe(audio=[tmp_wav.name], batch_size=1, verbose=False)
                
                if transcriptions and len(transcriptions) > 0:
                    result = transcriptions[0]
                    
                    if isinstance(result, str):
                        return result
                    elif hasattr(result, 'text'):
                        return result.text
                    else:
                        logger.warning(f"Unexpected transcription result type: {type(result)}")
                        # Try to access common attributes
                        for attr in ['text', 'transcription', 'hypothesis', 'pred_text']:
                            if hasattr(result, attr):
                                val = getattr(result, attr)
                                if val:
                                    return str(val)
                        return str(result)
                else:
                    logger.warning(f"Empty transcription result: {transcriptions}")
            except Exception as e:
                logger.error(f"Batch transcription failed: {e}")
                raise e
        
        return ""
    
    def _transcribe_streaming(self, audio_array: np.ndarray, session_id: str) -> str:
        """
        Cache-aware streaming transcription.
        
        Maintains encoder state between chunks for efficient processing.
        This is Nemotron's key advantage - no redundant computation.
        """
        import torch
        
        cache = self._get_or_create_session_cache(session_id)
        
        try:
            # Convert to tensor
            audio_tensor = torch.tensor(audio_array, dtype=torch.float32)
            if self.device != "cpu":
                audio_tensor = audio_tensor.to(self.device)
            
            # Add batch dimension if needed
            if audio_tensor.dim() == 1:
                audio_tensor = audio_tensor.unsqueeze(0)
            
            # Create length tensor
            audio_length = torch.tensor([audio_tensor.shape[1]], dtype=torch.long)
            if self.device != "cpu":
                audio_length = audio_length.to(self.device)
            
            # Try cache-aware transcription methods
            text = ""
            
            # Method 1: transcribe_step (for RNNT models like Nemotron)
            if hasattr(self.model, 'transcribe_step'):
                try:
                    # Prepare cache state
                    cache_state = None
                    if cache.cache_last_channel is not None:
                        cache_state = {
                            'cache_last_channel': cache.cache_last_channel,
                            'cache_last_time': cache.cache_last_time,
                            'cache_last_channel_len': cache.cache_last_channel_len,
                        }
                    
                    result = self.model.transcribe_step(
                        audio_tensor,
                        audio_length,
                        cache_state=cache_state,
                    )
                    
                    # Extract text and update cache
                    if isinstance(result, tuple):
                        text_result, new_cache = result
                        if isinstance(text_result, list) and len(text_result) > 0:
                            text = text_result[0] if isinstance(text_result[0], str) else str(text_result[0])
                        elif isinstance(text_result, str):
                            text = text_result
                        
                        # Update session cache
                        if new_cache:
                            cache.cache_last_channel = new_cache.get('cache_last_channel')
                            cache.cache_last_time = new_cache.get('cache_last_time')
                            cache.cache_last_channel_len = new_cache.get('cache_last_channel_len', 0)
                    elif isinstance(result, str):
                        text = result
                    elif isinstance(result, list) and len(result) > 0:
                        text = result[0] if isinstance(result[0], str) else str(result[0])
                    
                    cache.step_num += 1
                    return text
                    
                except Exception as e:
                    logger.warning(f"transcribe_step failed, falling back to batch: {e}")
            
            # Method 2: conformer_stream_step (alternative streaming API)
            if hasattr(self.model, 'conformer_stream_step'):
                try:
                    result, new_cache = self.model.conformer_stream_step(
                        audio_tensor,
                        cache_last_channel=cache.cache_last_channel,
                        cache_last_time=cache.cache_last_time,
                    )
                    
                    if new_cache:
                        cache.cache_last_channel = new_cache.get('cache_last_channel')
                        cache.cache_last_time = new_cache.get('cache_last_time')
                    
                    if isinstance(result, str):
                        return result
                    elif hasattr(result, 'text'):
                        return result.text
                    
                except Exception as e:
                    logger.warning(f"conformer_stream_step failed: {e}")
            
            # Fallback to batch transcription
            logger.debug("Using batch transcription fallback")
            return self._transcribe_batch(audio_array)
            
        except Exception as e:
            logger.error(f"Streaming transcription failed: {e}")
            # Fall back to batch mode
            return self._transcribe_batch(audio_array)
    
    def get_session_info(self, session_id: str) -> dict:
        """Get information about a session's cache state."""
        if session_id in self.session_caches:
            cache = self.session_caches[session_id]
            return {
                "exists": True,
                "step_num": cache.step_num,
                "has_cache": cache.cache_last_channel is not None,
            }
        return {"exists": False}
    
    def cleanup_idle_sessions(self, max_idle_seconds: float = 300.0):
        """Clean up sessions that have been idle for too long."""
        # Note: This is a simple implementation. In production, you'd track
        # last access time per session.
        current_count = len(self.session_caches)
        if current_count > 100:  # Only cleanup if we have many sessions
            # Remove oldest sessions (simple FIFO)
            sessions_to_remove = list(self.session_caches.keys())[:-50]
            for sid in sessions_to_remove:
                del self.session_caches[sid]
            logger.info(f"Cleaned up {len(sessions_to_remove)} idle sessions")

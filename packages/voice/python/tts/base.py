import abc
import json
import sys
import time
import logging
import traceback
from typing import Optional, Dict, Any

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("TTSBase")

class TTSServerBase(abc.ABC):
    def __init__(self, device_name: str):
        self.device_name = device_name
        self.start_time = time.time()
        self.cache: Dict[tuple, bytes] = {}
        self.cache_order: list = []
        self.MAX_CACHE_SIZE = 50
        
        # Emit init status
        self.emit_status(f"Initializing TTS Server on {self.device_name}...")

    def emit_json(self, data: Dict[str, Any]):
        print(json.dumps(data), file=sys.stdout, flush=True)

    def emit_status(self, message: str, request_id: Optional[str] = None):
        payload = {"message": message}
        if message == "TTS server ready":
             payload.update({
                 "device": self.device_name,
                 "startup_time": time.time() - self.start_time
             })
        
        self.emit_json({
            "id": request_id or "init",
            "type": "status",
            "payload": payload
        })

    def emit_error(self, message: str, request_id: Optional[str] = None, traceback_str: Optional[str] = None):
        payload = {"message": message}
        if traceback_str:
            payload["traceback"] = traceback_str
            
        self.emit_json({
            "id": request_id or "error",
            "type": "error",
            "payload": payload
        })

    def emit_audio(self, audio_bytes: bytes, sample_rate: int, is_final: bool, request_id: str):
        import base64
        encoded = base64.b64encode(audio_bytes).decode('utf-8')
        self.emit_json({
            "id": request_id,
            "type": "audio",
            "payload": {
                "audioBase64": encoded,
                "sampleRate": sample_rate,
                "isFinal": is_final
            }
        })

    # --- Cache Methods ---
    def get_cached_audio(self, text: str, voice_description: str) -> Optional[bytes]:
        key = (text, voice_description)
        if key in self.cache:
            if key in self.cache_order:
                self.cache_order.remove(key)
            self.cache_order.append(key)
            return self.cache[key]
        return None

    def cache_audio(self, text: str, voice_description: str, audio_bytes: bytes):
        if not audio_bytes: return
        key = (text, voice_description)
        if key in self.cache:
            if key in self.cache_order: self.cache_order.remove(key)
        elif len(self.cache) >= self.MAX_CACHE_SIZE:
            if self.cache_order:
                oldest = self.cache_order.pop(0)
                if oldest in self.cache: del self.cache[oldest]
        self.cache[key] = audio_bytes
        self.cache_order.append(key)

    # --- Abstract Methods ---
    @abc.abstractmethod
    def synthesize(self, text: str, voice_description: str, streaming: bool, request_id: str) -> bytes:
        pass

    # --- Main Loop ---
    def run(self):
        self.emit_status("TTS server ready")
        
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
                    self.emit_status("pong", request_id)
                
                elif request_type == "synthesize":
                    text = payload.get("text")
                    voice = payload.get("voice")
                    streaming = payload.get("streaming", False)
                    
                    if not voice:
                        voice = "Realistic male voice in the 30s age with american accent. Normal pitch, warm timbre, conversational pacing."

                    # Check cache
                    cached = self.get_cached_audio(text, voice)
                    if cached:
                        logger.info(f"Cache hit for '{text[:30]}...'")
                        # For streaming requests with cache hit, send whole audio as one final chunk
                        self.emit_audio(cached, 24000, True, request_id)
                        continue

                    try:
                        full_audio = self.synthesize(text, voice, streaming, request_id)
                        if not streaming:
                            self.emit_audio(full_audio, 24000, True, request_id)
                        else:
                            # Emit final empty chunk for streaming
                            self.emit_audio(b"", 24000, True, request_id)
                            
                        # If streaming, chunks were already emitted, but we need to cache the full result
                        self.cache_audio(text, voice, full_audio)
                            
                    except Exception as e:
                        logger.error(f"Synthesis error: {e}")
                        self.emit_error(str(e), request_id, traceback.format_exc())
                
                elif request_type == "shutdown":
                    break

            except json.JSONDecodeError:
                logger.error("Invalid JSON received")
            except Exception as e:
                logger.error(f"Loop error: {e}")
                traceback.print_exc(file=sys.stderr)

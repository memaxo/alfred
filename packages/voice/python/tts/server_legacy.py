"""
Maya1 TTS Server (Modular)

Communicates via JSON lines over stdin/stdout.
Uses maya-research/maya1 model with SNAC decoding.
"""

import sys
import json
import logging
import traceback
import base64
import time
from typing import Optional
import torch
import numpy as np

# Monkeypatch json.dumps to handle numpy/torch types that transformers might log
_original_dumps = json.dumps

def _extended_dumps(obj, **kwargs):
    def default(o):
        if isinstance(o, (np.dtype, torch.dtype)):
            return str(o)
        if isinstance(o, (np.float32, np.float64)):
            return float(o)
        if isinstance(o, (np.int32, np.int64)):
            return int(o)
        try:
            return str(o)
        except:
            return "<non-serializable>"
    
    if "default" not in kwargs:
        kwargs["default"] = default
    return _original_dumps(obj, **kwargs)

json.dumps = _extended_dumps

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("MayaTTS")

# Suppress transformers logging
try:
    from transformers import logging as transformers_logging
    transformers_logging.set_verbosity_error()
except ImportError:
    pass

# Global error handler
def handle_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    
    logger.critical("Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))
    print(json.dumps({
        "id": "fatal_error",
        "type": "error",
        "payload": {
            "message": f"Uncaught exception: {exc_value}",
            "traceback": "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        }
    }), file=sys.stdout, flush=True)

sys.excepthook = handle_exception

def check_dependencies():
    missing = []
    try:
        import torch
    except ImportError:
        missing.append("torch")
    try:
        import transformers
    except ImportError:
        missing.append("transformers")
    try:
        import snac
    except ImportError:
        missing.append("snac")
    try:
        import numpy
    except ImportError:
        missing.append("numpy")
        
    if missing:
        error_msg = f"Missing dependencies: {', '.join(missing)}"
        logger.error(error_msg)
        print(json.dumps({
            "id": "startup_error",
            "type": "error",
            "payload": {
                "message": error_msg,
                "error_type": "ImportError"
            }
        }), file=sys.stdout, flush=True)
        sys.exit(1)

check_dependencies()

import torch
import numpy as np
from transformers import AutoModelForCausalLM, AutoTokenizer
from transformers.generation.streamers import BaseStreamer
from snac import SNAC

# Constants
CODE_START_TOKEN_ID = 128257
CODE_END_TOKEN_ID = 128258
CODE_TOKEN_OFFSET = 128266
SNAC_MIN_ID = 128266
SNAC_MAX_ID = 156937
SNAC_TOKENS_PER_FRAME = 7

SOH_ID = 128259
EOH_ID = 128260
SOA_ID = 128261
BOS_ID = 128000
TEXT_EOT_ID = 128009

class SNACStreamer(BaseStreamer):
    def __init__(self, snac_decoder, callback, device="cpu"):
        self.snac_decoder = snac_decoder
        self.callback = callback
        self.device = device
        self.token_buffer = []
        self.generated_tokens = []
        
    def put(self, value):
        if value.dim() > 1:
            tokens = value[0].tolist()
        else:
            tokens = value.tolist()
            
        for token in tokens:
            self.generated_tokens.append(token)
            if SNAC_MIN_ID <= token <= SNAC_MAX_ID:
                self.token_buffer.append(token)
                self.process_buffer()

    def end(self):
        pass

    def process_buffer(self):
        if len(self.token_buffer) % 7 == 0 and len(self.token_buffer) > 27:
            window_tokens = self.token_buffer[-28:]
            self.decode_and_emit(window_tokens)

    def decode_and_emit(self, tokens):
        try:
            audio_bytes = self.decode_to_bytes(tokens, use_sliding_window=True)
            if audio_bytes:
                self.callback(audio_bytes)
        except Exception as e:
            logger.error(f"Error decoding chunk: {e}")

    def unpack_snac_from_7(self, snac_tokens):
        if snac_tokens and snac_tokens[-1] == CODE_END_TOKEN_ID:
            snac_tokens = snac_tokens[:-1]

        frames = len(snac_tokens) // SNAC_TOKENS_PER_FRAME
        snac_tokens = snac_tokens[:frames * SNAC_TOKENS_PER_FRAME]

        if frames == 0:
            return [[], [], []]

        l1, l2, l3 = [], [], []

        for i in range(frames):
            slots = snac_tokens[i*7:(i+1)*7]
            l1.append((slots[0] - CODE_TOKEN_OFFSET) % 4096)
            l2.extend([
                (slots[1] - CODE_TOKEN_OFFSET) % 4096,
                (slots[4] - CODE_TOKEN_OFFSET) % 4096,
            ])
            l3.extend([
                (slots[2] - CODE_TOKEN_OFFSET) % 4096,
                (slots[3] - CODE_TOKEN_OFFSET) % 4096,
                (slots[5] - CODE_TOKEN_OFFSET) % 4096,
                (slots[6] - CODE_TOKEN_OFFSET) % 4096,
            ])

        return [l1, l2, l3]

    def decode_to_bytes(self, snac_tokens, use_sliding_window=False):
        levels = self.unpack_snac_from_7(snac_tokens)
        if not levels[0]:
            return None

        codes = [
            torch.tensor(level, dtype=torch.long, device=self.device).unsqueeze(0)
            for level in levels
        ]

        with torch.inference_mode():
            z_q = self.snac_decoder.quantizer.from_codes(codes)
            audio = self.snac_decoder.decoder(z_q)[0, 0].cpu().numpy()

        if use_sliding_window and len(audio) >= 4096:
            audio = audio[2048:4096]
        
        audio_int16 = (audio * 32767).astype(np.int16)
        return audio_int16.tobytes()

class TTSServer:
    def __init__(self):
        self.start_time = time.time()
        self.cache = {}
        self.cache_order = []
        self.MAX_CACHE_SIZE = 50
        
        if torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"

        logger.info(f"Initializing TTS Server on {self.device}")
        
        print(json.dumps({
            "id": "init",
            "type": "status",
            "payload": {"message": f"Loading Maya1 on {self.device}..."}
        }), flush=True)

        try:
            self.tokenizer = AutoTokenizer.from_pretrained("maya-research/maya1", trust_remote_code=True)
            self.model = AutoModelForCausalLM.from_pretrained(
                "maya-research/maya1",
                dtype=torch.bfloat16 if self.device != "cpu" else torch.float32,
                device_map="auto" if self.device == "cuda" else None,
                trust_remote_code=True
            )
            if self.device == "mps":
                self.model = self.model.to("mps")
            
            self.snac_model = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval().to(self.device)
            
            # Warmup
            logger.info("Warming up model...")
            # Optional: Run a tiny generation to pre-compile graphs/load weights fully
            
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

        print(json.dumps({
            "id": "ready",
            "type": "status",
            "payload": {
                "message": "TTS server ready",
                "device": self.device,
                "startup_time": time.time() - self.start_time
            }
        }), flush=True)

    def get_cached_audio(self, text, voice_description):
        key = (text, voice_description)
        if key in self.cache:
            # Move to end (most recently used)
            if key in self.cache_order:
                self.cache_order.remove(key)
            self.cache_order.append(key)
            return self.cache[key]
        return None

    def cache_audio(self, text, voice_description, audio_bytes):
        if not audio_bytes:
            return
            
        key = (text, voice_description)
        if key in self.cache:
            if key in self.cache_order:
                self.cache_order.remove(key)
        elif len(self.cache) >= self.MAX_CACHE_SIZE:
            # Remove oldest
            if self.cache_order:
                oldest = self.cache_order.pop(0)
                if oldest in self.cache:
                    del self.cache[oldest]
            
        self.cache[key] = audio_bytes
        self.cache_order.append(key)

    def build_prompt(self, description: str, text: str) -> str:
        soh_token = self.tokenizer.decode([SOH_ID])
        eoh_token = self.tokenizer.decode([EOH_ID])
        soa_token = self.tokenizer.decode([SOA_ID])
        sos_token = self.tokenizer.decode([CODE_START_TOKEN_ID])
        eot_token = self.tokenizer.decode([TEXT_EOT_ID])
        bos_token = self.tokenizer.bos_token

        formatted_text = f'<description="{description}"> {text}'

        prompt = (
            soh_token + bos_token + formatted_text + eot_token +
            eoh_token + soa_token + sos_token
        )
        return prompt

    def synthesize(self, text, voice_description, streaming=False, request_id=None):
        # Check cache first
        cached = self.get_cached_audio(text, voice_description)
        if cached:
            logger.info(f"Cache hit for '{text[:30]}...'")
            if streaming and request_id:
                # For streaming requests with cache hit, send the whole audio as one "final" chunk
                encoded = base64.b64encode(cached).decode('utf-8')
                print(json.dumps({
                    "id": request_id,
                    "type": "audio",
                    "payload": {
                        "audioBase64": encoded,
                        "sampleRate": 24000,
                        "isFinal": True
                    }
                }), flush=True)
            return cached

        t0 = time.time()
        prompt = self.build_prompt(voice_description, text)
        t1 = time.time()
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        t2 = time.time()

        audio_chunks = []
        
        def handle_audio_chunk(chunk_bytes):
            encoded = base64.b64encode(chunk_bytes).decode('utf-8')
            if streaming and request_id:
                print(json.dumps({
                    "id": request_id,
                    "type": "audio",
                    "payload": {
                        "audioBase64": encoded,
                        "sampleRate": 24000,
                        "isFinal": False
                    }
                }), flush=True)
            audio_chunks.append(chunk_bytes)

        streamer = SNACStreamer(self.snac_model, handle_audio_chunk, device=self.device)
        
        t3 = time.time()
        with torch.inference_mode():
            self.model.generate(
                **inputs,
                max_new_tokens=2048,
                min_new_tokens=28,
                temperature=0.4,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                eos_token_id=CODE_END_TOKEN_ID,
                pad_token_id=self.tokenizer.pad_token_id,
                streamer=streamer
            )
        t4 = time.time()
        
        logger.info(f"Synthesis timing [id={request_id}]: prompt={t1-t0:.4f}s, tokenization={t2-t1:.4f}s, setup={t3-t2:.4f}s, generation={t4-t3:.4f}s, total={t4-t0:.4f}s")
        
        full_audio = b"".join(audio_chunks)
        self.cache_audio(text, voice_description, full_audio)

        return full_audio

    def run(self):
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
                    text = payload.get("text")
                    voice = payload.get("voice")
                    streaming = payload.get("streaming", False)
                    
                    if not voice:
                        voice = "Realistic male voice in the 30s age with american accent. Normal pitch, warm timbre, conversational pacing."

                    try:
                        full_audio = self.synthesize(text, voice, streaming, request_id)
                        
                        if not streaming:
                            encoded = base64.b64encode(full_audio).decode('utf-8')
                            print(json.dumps({
                                "id": request_id,
                                "type": "audio",
                                "payload": {
                                    "audioBase64": encoded,
                                    "sampleRate": 24000,
                                    "isFinal": True
                                }
                            }), flush=True)
                        else:
                             print(json.dumps({
                                "id": request_id,
                                "type": "audio",
                                "payload": {
                                    "audioBase64": "",
                                    "sampleRate": 24000,
                                    "isFinal": True
                                }
                            }), flush=True)
                            
                    except Exception as e:
                        logger.error(f"Synthesis error: {e}")
                        print(json.dumps({
                            "id": request_id,
                            "type": "error",
                            "payload": {"message": str(e)}
                        }), flush=True)
                
                elif request_type == "shutdown":
                    break

            except json.JSONDecodeError:
                logger.error("Invalid JSON received")
            except Exception as e:
                logger.error(f"Loop error: {e}")

def main():
    server = TTSServer()
    server.run()

if __name__ == "__main__":
    main()

import time
import torch
import numpy as np
import base64
import logging
from transformers import AutoModelForCausalLM, AutoTokenizer
from transformers.generation.streamers import BaseStreamer
from snac import SNAC
from .base import TTSServerBase

logger = logging.getLogger("TTS-ROCm")

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

class SNACStreamerROCm(BaseStreamer):
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

class TTSServerROCm(TTSServerBase):
    def __init__(self):
        if torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
            
        super().__init__(self.device)
        
        try:
            # Optimization: Use quantization if bitsandbytes is available
            load_kwargs = {
                "trust_remote_code": True,
                "device_map": "auto" if self.device == "cuda" else None
            }
            
            # Check for quantization env var
            if os.environ.get("MAYA_QUANTIZE_4BIT") == "true":
                logger.info("Attempting 4-bit quantization...")
                try:
                    from transformers import BitsAndBytesConfig
                    bnb_config = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype=torch.bfloat16,
                        bnb_4bit_quant_type="nf4"
                    )
                    load_kwargs["quantization_config"] = bnb_config
                except ImportError:
                    logger.warning("bitsandbytes not found, skipping quantization")

            self.tokenizer = AutoTokenizer.from_pretrained("maya-research/maya1", trust_remote_code=True)
            
            self.model = AutoModelForCausalLM.from_pretrained(
                "maya-research/maya1",
                dtype=torch.bfloat16 if self.device != "cpu" else torch.float32,
                **load_kwargs
            )
            
            if self.device == "mps" and "quantization_config" not in load_kwargs:
                self.model = self.model.to("mps")
            
            # Optimize with torch.compile if on Linux/CUDA
            if self.device == "cuda" and hasattr(torch, "compile"):
                logger.info("Compiling model with torch.compile()...")
                self.model = torch.compile(self.model, mode="reduce-overhead")

            self.snac_model = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval().to(self.device)
            
            # Warmup
            logger.info("Warming up model...")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            import traceback
            self.emit_error(f"Failed to load model: {e}", "init", traceback.format_exc())
            sys.exit(1)

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

    def synthesize(self, text: str, voice_description: str, streaming: bool, request_id: str) -> bytes:
        t0 = time.time()
        prompt = self.build_prompt(voice_description, text)
        t1 = time.time()
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        t2 = time.time()

        audio_chunks = []
        
        def handle_audio_chunk(chunk_bytes):
            if streaming:
                self.emit_audio(chunk_bytes, 24000, False, request_id)
            audio_chunks.append(chunk_bytes)

        streamer = SNACStreamerROCm(self.snac_model, handle_audio_chunk, device=self.device)
        
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

        # Note: Base class handles isFinal logic for streaming
        return b"".join(audio_chunks)

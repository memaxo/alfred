import time
import logging
import base64
import numpy as np
import os
try:
    import mlx.core as mx
    import mlx.nn as nn
    from mlx_lm import load, generate
    # from mlx_lm.utils import generate_step # Removed as it's missing
except ImportError:
    pass # Will be handled by factory

from .base import TTSServerBase

logger = logging.getLogger("TTS-MLX")

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

def generate_step(prompt, model, temp=0.0):
    """
    Generator that produces tokens from the model.
    """
    def sample(logits):
        if temp == 0:
            return mx.argmax(logits, axis=-1)
        return mx.random.categorical(logits * (1 / temp))

    y = prompt
    cache = None
    logger.info(f"Starting generation. Prompt shape: {y.shape}")
    while True:
        # forward
        out = model(y[None], cache=cache)
        if isinstance(out, tuple):
            logits, cache = out
        else:
            logits = out
            # logger.warning("Model did not return cache!") 
            
        logits = logits[:, -1, :]
        y = sample(logits)
        yield y, None # yield token and optional metadata

class SNACStreamerMLX:
    def __init__(self, snac_decoder, callback):
        self.snac_decoder = snac_decoder
        self.callback = callback
        self.token_buffer = []
        
    def process(self, token: int):
        if SNAC_MIN_ID <= token <= SNAC_MAX_ID:
            self.token_buffer.append(token)
            self.process_buffer()

    def process_buffer(self):
        if len(self.token_buffer) % 7 == 0 and len(self.token_buffer) > 27:
            window_tokens = self.token_buffer[-28:]
            self.decode_and_emit(window_tokens)

    def flush(self):
        if len(self.token_buffer) >= 7:
             # Emit whatever we have, even if short
             self.decode_and_emit(self.token_buffer)

    def decode_and_emit(self, tokens):
        try:
            audio_bytes = self.decode_to_bytes(tokens, use_sliding_window=True)
            if audio_bytes:
                self.callback(audio_bytes)
        except Exception as e:
            logger.error(f"Error decoding chunk: {e}")

    def unpack_snac_from_7(self, snac_tokens):
        # Re-use the logic from the original SNAC decoder (it's pure python list manipulation)
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
        # Hybrid approach: MLX for LLM, PyTorch for SNAC Decoder
        # This avoids needing to port SNAC weights to MLX immediately
        import torch
        import numpy as np
        
        levels = self.unpack_snac_from_7(snac_tokens)
        if not levels[0]:
            return None

        # SNAC decoder expects PyTorch tensors
        # We run this on CPU or MPS (if torch is available)
        device = "cpu" # Keep decoder on CPU to avoid fighting MLX for GPU memory if tight
        
        codes = [
            torch.tensor(level, dtype=torch.long, device=device).unsqueeze(0)
            for level in levels
        ]

        with torch.inference_mode():
            z_q = self.snac_decoder.quantizer.from_codes(codes)
            audio = self.snac_decoder.decoder(z_q)[0, 0].cpu().numpy()

        if use_sliding_window and len(audio) >= 4096:
            audio = audio[2048:4096]
        
        audio_int16 = (audio * 32767).astype(np.int16)
        return audio_int16.tobytes()

class TTSServerMLX(TTSServerBase):
    def __init__(self):
        super().__init__("mlx")
        
        try:
            import torch
            from snac import SNAC
            
            # Load converted Maya1 model
            model_path = "models/maya1-mlx"
            if not os.path.exists(model_path):
                 # Fallback to checking if we should convert on the fly? No, too slow.
                 # Raise explicit error instructions
                 raise FileNotFoundError(f"MLX model not found at {model_path}. Run: python packages/voice/scripts/convert_maya1_to_mlx.py --quantize")

            self.model, self.tokenizer = load(model_path)
            
            # Load SNAC decoder (PyTorch version)
            # We keep it on CPU to allow MLX to use the GPU fully
            logger.info("Loading SNAC decoder (PyTorch)...")
            self.snac_decoder = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval().to("cpu")
            
            logger.info(f"MLX Backend initialized. Model type: {type(self.model)}")
            
        except Exception as e:
            logger.error(f"Failed to load MLX backend: {e}")
            import sys
            # Re-raise to let factory handle fallback if we want, but factory catches generic Exception
            raise e

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
        
        audio_chunks = []
        
        def handle_audio_chunk(chunk_bytes):
            if streaming:
                self.emit_audio(chunk_bytes, 24000, False, request_id)
            audio_chunks.append(chunk_bytes)
            
        streamer = SNACStreamerMLX(self.snac_decoder, handle_audio_chunk)
        
        t1 = time.time()
        
        # Generate using mlx_lm
        # We need to iterate token by token to feed the SNAC streamer
        # mlx_lm.generate returns a string, but we need tokens for SNAC
        # So we use lower-level generate_step or just iterate
        
        prompt_tokens = mx.array(self.tokenizer.encode(prompt, add_special_tokens=False))
        
        max_tokens = 2048
        tokens = []
        
        for (token, prob), i in zip(
            generate_step(prompt_tokens, self.model, temp=0.8),
            range(max_tokens)
        ):
            token_val = token.item()
            if token_val == CODE_END_TOKEN_ID:
                break 
                
            streamer.process(token_val)
            tokens.append(token_val)
            
        streamer.flush()
            
        t4 = time.time()
        logger.info(f"Synthesis timing [id={request_id}]: total={t4-t0:.4f}s")
        
        return b"".join(audio_chunks)

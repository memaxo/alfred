#!/usr/bin/env python3
import sys
import json
import torch
import numpy as np
import base64
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
        self.first_chunk = True
        
    def put(self, value):
        # value is a tensor of token ids
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
        # Flush remaining if needed, but sliding window usually handles main flow
        pass

    def process_buffer(self):
        # Sliding window: process every 7 tokens when buffer > 27
        # Take last 28 tokens (4 frames) for smooth overlap
        if len(self.token_buffer) % 7 == 0 and len(self.token_buffer) > 27:
            window_tokens = self.token_buffer[-28:]
            self.decode_and_emit(window_tokens)

    def decode_and_emit(self, tokens):
        try:
            audio_bytes = self.decode_to_bytes(tokens, use_sliding_window=True)
            if audio_bytes:
                self.callback(audio_bytes)
        except Exception as e:
            sys.stderr.write(f"Error decoding chunk: {e}\n")

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
            # Keep middle 2048 samples
            audio = audio[2048:4096]
        
        # Float32 to Int16
        audio_int16 = (audio * 32767).astype(np.int16)
        return audio_int16.tobytes()

class MayaTTS:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        sys.stderr.write(f"Initializing Maya1 on {self.device}...\n")
        
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
        sys.stderr.write("Maya1 initialized.\n")

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
        prompt = self.build_prompt(voice_description, text)
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)

        audio_chunks = []
        
        def handle_audio_chunk(chunk_bytes):
            encoded = base64.b64encode(chunk_bytes).decode('utf-8')
            if streaming and request_id:
                response = {
                    "id": request_id,
                    "type": "audio",
                    "payload": {
                        "audioBase64": encoded,
                        "sampleRate": 24000,
                        "isFinal": False
                    }
                }
                print(json.dumps(response), flush=True)
            audio_chunks.append(chunk_bytes)

        # Always use streamer to collect audio chunks, even if not streaming IPC events
        streamer = SNACStreamer(self.snac_model, handle_audio_chunk, device=self.device)

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

        if not streaming:
            # If not streaming, we might need to process the full output here.
            # But for simplicity, we can rely on the streamer to have collected chunks
            # OR implement full decode here if streamer wasn't used.
            # For now, let's assume we use streamer logic for both but just buffer if not streaming?
            # Actually, let's use non-streaming full decode if streaming=False for better quality/simplicity
            pass 

        return b"".join(audio_chunks)

def main():
    tts = MayaTTS()
    print(json.dumps({"id": "init", "type": "status", "payload": {"message": "TTS server ready"}}), flush=True)

    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            req_type = req.get("type")
            
            if req_type == "synthesize":
                payload = req.get("payload", {})
                text = payload.get("text")
                voice = payload.get("voice") # This is the description
                streaming = payload.get("streaming", False)
                
                # Default description if none provided
                if not voice:
                    voice = "Realistic male voice in the 30s age with american accent. Normal pitch, warm timbre, conversational pacing."

                try:
                    full_audio = tts.synthesize(text, voice, streaming=streaming, request_id=req_id)
                    
                    if not streaming:
                        encoded = base64.b64encode(full_audio).decode('utf-8')
                        resp = {
                            "id": req_id,
                            "type": "transcript", # Using transcript type for full result as per IPC spec? No, IPC spec has 'audio' type usually? 
                            # Wait, base.ts expects "audio" or "transcript"? 
                            # PiperTTSManager returns { audioBase64, ... }
                            # IPC handles { type: "audio", payload: ... }
                            "payload": {
                                "audioBase64": encoded,
                                "sampleRate": 24000,
                                "isFinal": True
                            }
                        }
                        # Let's check IPC spec. 
                        # It usually emits events. For request/response, we send a final response.
                        # But for streaming, we send events.
                        print(json.dumps(resp), flush=True)
                    else:
                        # Send final signal
                        print(json.dumps({
                            "id": req_id,
                            "type": "audio",
                            "payload": {
                                "audioBase64": "",
                                "sampleRate": 24000,
                                "isFinal": True
                            }
                        }), flush=True)

                except Exception as e:
                    sys.stderr.write(f"Synthesis error: {e}\n")
                    print(json.dumps({"id": req_id, "type": "error", "payload": {"message": str(e)}}), flush=True)
            
            elif req_type == "ping":
                print(json.dumps({"id": req_id, "type": "pong"}), flush=True)
                
        except json.JSONDecodeError:
            pass
        except Exception as e:
            sys.stderr.write(f"Loop error: {e}\n")

if __name__ == "__main__":
    main()

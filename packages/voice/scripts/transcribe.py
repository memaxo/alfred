#!/usr/bin/env python3
"""
STT Transcribe Script (Python version)
Transcribes audio files using the local Faster-Whisper STT server.

Usage:
  python stt_transcribe.py audio.wav
  python stt_transcribe.py audio.wav --language en
  python stt_transcribe.py audio.wav --model large-v3-turbo
"""

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Transcribe audio files using local Faster-Whisper STT server")
    parser.add_argument("audio_file", help="Audio file to transcribe")
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL_PATH", "large-v3-turbo"),
                        help="Whisper model to use (default: large-v3-turbo)")
    parser.add_argument("--device", default=os.environ.get("WHISPER_DEVICE"),
                        help="Device to use: cpu, cuda, mps, rocm (default: auto)")
    parser.add_argument("--compute-type", default=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
                        help="Compute type: int8, fp16, fp32 (default: int8)")
    parser.add_argument("--language", help="Language code (e.g., en, es, fr)")
    parser.add_argument("--prompt", help="Initial prompt to guide transcription")
    parser.add_argument("--vad-threshold", type=float, help="VAD threshold (0.0-1.0)")
    
    args = parser.parse_args()
    
    script_dir = Path(__file__).parent.absolute()
    voice_dir = script_dir.parent
    
    # Resolve audio file
    audio_path = Path(args.audio_file)
    if not audio_path.exists():
        # Try relative to cwd
        cwd_path = Path.cwd() / args.audio_file
        if cwd_path.exists():
            audio_path = cwd_path
        else:
            print(f"Error: Audio file not found: {args.audio_file}", file=sys.stderr)
            sys.exit(1)
            
    audio_path = audio_path.absolute()
    
    # Read audio file
    try:
        with open(audio_path, "rb") as f:
            audio_data = f.read()
            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
    except Exception as e:
        print(f"Error reading audio file '{audio_path}': {e}", file=sys.stderr)
        sys.exit(1)
        
    # Prepare request
    request_id = f"transcribe-{int(time.time())}"
    payload = {
        "audioBase64": audio_b64
    }
    
    if args.language:
        payload["language"] = args.language
    if args.prompt:
        payload["prompt"] = args.prompt
    if args.vad_threshold is not None:
        payload["vadThreshold"] = args.vad_threshold
        
    request = {
        "id": request_id,
        "type": "transcribe",
        "payload": payload
    }
    
    request_json = json.dumps(request)
    
    # Run STT server
    server_script = script_dir / "stt_server.py"
    env = os.environ.copy()
    env["WHISPER_MODEL_PATH"] = args.model
    if args.device:
        env["WHISPER_DEVICE"] = args.device
    env["WHISPER_COMPUTE_TYPE"] = args.compute_type
    
    try:
        print("Transcribing audio...", file=sys.stderr)
        
        # Use 'uv run' if available, otherwise direct python execution
        if shutil.which("uv"):
            cmd = ["uv", "run", "python", str(server_script)]
        else:
            cmd = [sys.executable, str(server_script)]
            
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            env=env,
            cwd=voice_dir,
            text=True
        )
        
        stdout, _ = process.communicate(input=request_json)
        
        if process.returncode != 0:
            print("Error: STT server failed", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"Error running STT server: {e}", file=sys.stderr)
        sys.exit(1)
        
    # Extract transcript
    transcript_found = False
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            if msg.get("type") == "transcript":
                payload = msg["payload"]
                text = payload.get("text", "")
                language = payload.get("language", "")
                is_empty = payload.get("isEmpty", False)
                duration = payload.get("durationSeconds", 0)
                vad_confidence = payload.get("vadConfidence")
                
                if is_empty:
                    print("(no speech detected)", file=sys.stderr)
                else:
                    print(text)
                    if language:
                        print(f"[Language: {language}]", file=sys.stderr)
                    if duration > 0:
                        print(f"[Duration: {duration:.2f}s]", file=sys.stderr)
                    if vad_confidence is not None:
                        print(f"[VAD confidence: {vad_confidence:.2%}]", file=sys.stderr)
                
                transcript_found = True
                break
        except json.JSONDecodeError:
            continue
        except Exception as e:
            print(f"Error processing transcript: {e}", file=sys.stderr)
            sys.exit(1)
            
    if not transcript_found:
        print("✗ No transcript found in output", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

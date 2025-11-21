#!/usr/bin/env python3
"""
TTS Say Script (Python version)
Synthesizes text to speech and plays it using the local Piper TTS server.

Usage:
  python tts_say.py "Hello, this is Alfred speaking."
  python tts_say.py "Hello world" --voice en_US-lessac-medium
  python tts_say.py "Test" --save output.wav
"""

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Synthesize text to speech using local Piper TTS server")
    parser.add_argument("text", help="Text to synthesize")
    parser.add_argument("--voice", default=os.environ.get("PIPER_VOICE", "en_US-lessac-medium"),
                        help="Voice model to use (default: en_US-lessac-medium)")
    parser.add_argument("--streaming", action="store_true",
                        help="Enable sentence-level streaming")
    parser.add_argument("--save", metavar="FILE", help="Save audio to WAV file instead of playing")
    parser.add_argument("--no-play", action="store_true", help="Don't play audio (useful with --save)")
    
    args = parser.parse_args()
    
    script_dir = Path(__file__).parent.absolute()
    voice_dir = script_dir.parent
    model_dir = voice_dir / "models" / "piper"
    
    # Check if model directory exists
    if not model_dir.exists():
        print(f"Error: Model directory not found: {model_dir}", file=sys.stderr)
        print("Download models first with: python scripts/download_models.py", file=sys.stderr)
        sys.exit(1)
        
    # Check if voice model files exist
    voice_path = model_dir / f"{args.voice}.onnx"
    config_path = model_dir / f"{args.voice}.onnx.json"
    
    if not voice_path.exists() or not config_path.exists():
        print(f"Error: Voice model not found: {args.voice}", file=sys.stderr)
        print("Expected files:", file=sys.stderr)
        print(f"  {voice_path}", file=sys.stderr)
        print(f"  {config_path}", file=sys.stderr)
        sys.exit(1)

    # Prepare request
    request_id = f"say-{int(time.time())}"
    request = {
        "id": request_id,
        "type": "synthesize",
        "payload": {
            "text": args.text,
            "voice": args.voice,
            "streaming": args.streaming
        }
    }
    
    request_json = json.dumps(request)
    
    # Run TTS server
    server_script = script_dir / "tts_server.py"
    env = os.environ.copy()
    env["PIPER_MODEL_PATH"] = str(model_dir)
    
    try:
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
            print("Error: TTS server failed", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"Error running TTS server: {e}", file=sys.stderr)
        sys.exit(1)
        
    # Extract audio
    audio_bytes = None
    sample_rate = 22050 # Default fallback
    
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            if msg.get("type") == "audio":
                payload = msg["payload"]
                audio_b64 = payload["audioBase64"]
                sample_rate = payload.get("sampleRate", 22050)
                audio_bytes = base64.b64decode(audio_b64)
                print(f"✓ Generated: {len(audio_bytes)} bytes at {sample_rate} Hz")
                break
        except json.JSONDecodeError:
            continue
        except Exception as e:
            print(f"Error processing audio: {e}", file=sys.stderr)
            sys.exit(1)
            
    if audio_bytes is None:
        print("✗ No audio message found in output", file=sys.stderr)
        sys.exit(1)
        
    # Save audio file
    if args.save:
        output_path = Path(args.save).absolute()
    else:
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_file.close()
        output_path = Path(temp_file.name)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    import wave
    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_bytes)
        
    # Play audio
    play_audio = not args.no_play
    if args.save and not args.no_play:
        # If --save is used, we default to not playing unless implicit?
        # The original script says: --save ... PLAY_AUDIO=false.
        # But args.no_play defaults to False.
        # So if --save is present, we should default play to False, unless user logic differs.
        # Actually original script:
        # --save) SAVE_FILE="$2"; PLAY_AUDIO=false
        # So if save is used, play is false by default.
        play_audio = False
        
    if args.no_play:
        play_audio = False
        
    if play_audio:
        players = ["afplay", "aplay", "paplay"]
        player_cmd = None
        for p in players:
            if shutil.which(p):
                player_cmd = p
                break
        
        if player_cmd:
            print("Playing audio...")
            subprocess.run([player_cmd, str(output_path)])
            print("✓ Playback complete")
        else:
            print("Warning: No audio player found (afplay/aplay/paplay)", file=sys.stderr)
            print(f"Audio saved to: {output_path}", file=sys.stderr)
            # Don't exit with error here, just warn
            
    if args.save:
        print(f"✓ Audio saved to: {output_path}")
    elif not play_audio:
        print(f"✓ Audio saved to: {output_path}")
        # Clean up temp file if not saving? 
        # The original script says "Audio saved to: $AUDIO_FILE" even if it was temp.
        # But typically we might want to clean up temp files if we just played them.
        # The original script leaves it in /tmp (mktemp)
        pass

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Voice Test Script (Python version)
Tests both TTS and STT functionality.

Usage:
  python test_voice.py
  python test_voice.py --text "Custom test text"
"""

import argparse
import os
import shutil
import string
import subprocess
import sys
import tempfile
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Test Alfred's voice capabilities (TTS and STT)")
    parser.add_argument("--text", default="Hello, this is a test of Alfred's voice capabilities.",
                        help="Text to synthesize and transcribe")
    
    args = parser.parse_args()
    
    script_dir = Path(__file__).parent.absolute()
    voice_dir = script_dir.parent
    
    # Use temporary directory for audio
    with tempfile.TemporaryDirectory() as temp_dir:
        audio_file = Path(temp_dir) / "test_output.wav"
        
        print("=== Voice System Test ===")
        print("")
        
        # Test 1: TTS Synthesis
        print("Test 1: TTS Synthesis")
        print(f"  Text: \"{args.text}\"")
        print("  Generating audio...")
        
        tts_script = script_dir / "tts_say.py"
        
        # Call tts_say.py
        # We use sys.executable to run the python script
        cmd_tts = [sys.executable, str(tts_script), args.text, "--save", str(audio_file), "--no-play"]
        
        try:
            subprocess.run(cmd_tts, check=True, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            print("✗ TTS test failed", file=sys.stderr)
            sys.exit(1)
            
        if not audio_file.exists():
            print("✗ Audio file not created", file=sys.stderr)
            sys.exit(1)
            
        audio_size = audio_file.stat().st_size
        print(f"  ✓ Audio generated: {audio_size} bytes")
        print("")
        
        # Test 2: STT Transcription
        print("Test 2: STT Transcription")
        print("  Transcribing generated audio...")
        
        stt_script = script_dir / "stt_transcribe.py"
        cmd_stt = [sys.executable, str(stt_script), str(audio_file)]
        
        try:
            result = subprocess.run(cmd_stt, check=True, capture_output=True, text=True)
            transcript = result.stdout.strip()
        except subprocess.CalledProcessError as e:
            print("✗ STT test failed", file=sys.stderr)
            print(e.stderr, file=sys.stderr)
            sys.exit(1)
            
        print(f"  Transcript: \"{transcript}\"")
        print("")
        
        # Test 3: Round-trip comparison
        print("Test 3: Round-trip Comparison")
        
        def normalize(s):
            return s.lower().translate(str.maketrans('', '', string.punctuation))
            
        original_lower = normalize(args.text)
        transcript_lower = normalize(transcript)
        
        if original_lower in transcript_lower or transcript_lower in original_lower:
            print("  ✓ Round-trip successful (texts match)")
        else:
            print("  ⚠ Round-trip mismatch (expected for complex text)")
            print(f"    Original:  \"{original_lower}\"")
            print(f"    Transcript: \"{transcript_lower}\"")
        print("")
        
        # Test 4: Playback (optional)
        players = ["afplay", "aplay", "paplay"]
        player_cmd = None
        for p in players:
            if shutil.which(p):
                player_cmd = p
                break
                
        if player_cmd:
            print("Test 4: Audio Playback")
            try:
                # Don't block implementation on interactive input, just check if interactive
                if sys.stdin.isatty():
                    response = input("  Play generated audio? [y/N] ").strip().lower()
                    if response in ("y", "yes"):
                        subprocess.run([player_cmd, str(audio_file)])
                        print("  ✓ Playback complete")
                else:
                    print("  (Skipping interactive playback check)")
            except Exception:
                pass
            print("")
            
        print("=== All Tests Complete ===")
        print("")
        # Note: Audio file is deleted when temp_dir context exits, so we can't say "Audio file saved to..."
        # unless we copy it out. But for a test script, temporary is fine.
        
if __name__ == "__main__":
    main()

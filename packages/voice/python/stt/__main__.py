"""
Entry point for STT Server
"""
import os
import sys
import json
import traceback
import logging

# Add parent directory to python path to allow module imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging to stderr to avoid corrupting stdout JSON stream
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("NeMoSTT")

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
    """Verify all dependencies are available."""
    missing = []
    try:
        import torch
    except ImportError:
        missing.append("torch")
        
    try:
        import nemo.collections.asr as nemo_asr
    except ImportError:
        missing.append("nemo_toolkit[asr]")
        
    try:
        import silero_vad
    except ImportError:
        missing.append("silero-vad")
        
    try:
        import numpy
    except ImportError:
        missing.append("numpy")
        
    try:
        import soundfile
    except ImportError:
        missing.append("soundfile")
        
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

def main():
    """Entry point."""
    check_dependencies()
    
    # Import server after check
    try:
        from stt.server import STTServer
    except ImportError as e:
        logger.error(f"Failed to import STTServer: {e}")
        sys.exit(1)

    # Default to Nemotron Speech Streaming for maximum accuracy
    # Fallback chain: VOICE_STT_MODEL -> WHISPER_MODEL_PATH (legacy) -> default
    model_name = os.getenv("VOICE_STT_MODEL") or os.getenv("WHISPER_MODEL_PATH", "nvidia/nemotron-speech-streaming-en-0.6b")
    
    # Override legacy model names
    legacy_models = {"large-v3-turbo", "faster-whisper-large-v3-turbo", "nvidia/parakeet_realtime_eou_120m-v1"}
    if model_name in legacy_models:
        logger.info(f"Upgrading from legacy model {model_name} to Nemotron")
        model_name = "nvidia/nemotron-speech-streaming-en-0.6b"
        
    # Device detection: VOICE_STT_DEVICE -> WHISPER_DEVICE (legacy) -> auto
    device = os.getenv("VOICE_STT_DEVICE") or os.getenv("WHISPER_DEVICE")
    
    # Chunk size for latency/accuracy tradeoff
    chunk_size = os.getenv("VOICE_STT_CHUNK_SIZE", "medium")
    
    server = STTServer(model_name, device, chunk_size)
    
    # Event Loop
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
            
            elif request_type == "transcribe":
                audio_base64 = payload.get("audioBase64", "")
                language = payload.get("language")
                prompt = payload.get("prompt")
                vad_threshold = payload.get("vadThreshold")
                session_id = payload.get("sessionId")
                streaming = payload.get("streaming", False)
                chunk_size = payload.get("chunkSize")
                clear_cache = payload.get("clearCache", False)
                
                try:
                    result = server.transcribe(
                        audio_base64,
                        language,
                        prompt,
                        vad_threshold,
                        session_id,
                        streaming,
                        chunk_size,
                        clear_cache,
                    )
                    
                    print(json.dumps({
                        "id": request_id,
                        "type": "transcript",
                        "payload": result
                    }), flush=True)
                except Exception as e:
                    logger.error(f"Transcription error: {e}")
                    print(json.dumps({
                        "id": request_id,
                        "type": "error",
                        "payload": {
                            "message": str(e),
                            "traceback": traceback.format_exc()
                        }
                    }), flush=True)
            
            elif request_type == "clear_cache":
                session_id = payload.get("sessionId")
                if session_id:
                    cleared = server.clear_session_cache(session_id)
                    print(json.dumps({
                        "id": request_id,
                        "type": "status",
                        "payload": {"cleared": cleared, "sessionId": session_id}
                    }), flush=True)
                else:
                    print(json.dumps({
                        "id": request_id,
                        "type": "error",
                        "payload": {"message": "sessionId required for clear_cache"}
                    }), flush=True)
            
            elif request_type == "session_info":
                session_id = payload.get("sessionId")
                if session_id:
                    info = server.get_session_info(session_id)
                    print(json.dumps({
                        "id": request_id,
                        "type": "status",
                        "payload": info
                    }), flush=True)
                else:
                    print(json.dumps({
                        "id": request_id,
                        "type": "error",
                        "payload": {"message": "sessionId required for session_info"}
                    }), flush=True)
            
            elif request_type == "shutdown":
                logger.info("Shutdown requested")
                break
            
        except json.JSONDecodeError:
            print(json.dumps({
                "id": "error",
                "type": "error",
                "payload": {"message": "Invalid JSON"}
            }), file=sys.stderr, flush=True)
        except Exception as e:
            print(json.dumps({
                "id": request_id if 'request_id' in locals() else "error",
                "type": "error",
                "payload": {"message": str(e)}
            }), file=sys.stderr, flush=True)

if __name__ == "__main__":
    main()

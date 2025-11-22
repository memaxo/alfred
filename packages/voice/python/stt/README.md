# STT Server

Modular Python implementation of the Speech-to-Text server using NVIDIA NeMo and Silero VAD.

## Structure

- `server.py`: Core STTServer class with model initialization and transcription logic.
- `__main__.py`: Entry point handling CLI args, dependency checks, and the JSON-IPC event loop.
- `__init__.py`: Package marker.

## Usage

Run as a module:
```bash
python -m stt
```

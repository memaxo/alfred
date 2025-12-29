# Audio Codec Patterns

## Core Principle

PCM16 at 16kHz canonical. Native Opus @ 48kHz when available. Fallback to ffmpeg for transcoding. Binary for pipeline base64 for API.

## Rules

1. **PCM16 format.** Use 16kHz sample rate, 1 channel, 16-bit depth. MIME: `audio/raw;codec=pcm_s16le;rate=16000`.

2. **Decoding to PCM.** Call `decodeToPCM16({ audioBase64, mimeType })`. Strip base64 prefix. Return PCM16 base64 with metadata.

3. **Native Opus decode.** Try `decodeOpus()` from `@discordjs/opus` for Opus audio. Fallback to ffmpeg on exception.

4. **Encoding from PCM.** Call `encodeFromPCM16({ audioBase64, format, bitrate? })`. Input must be PCM16. Use default bitrates when unspecified.

5. **Default bitrates.** MP3: 96k, Opus: 48k, WAV: 256k. Use `DEFAULT_BITRATES` for reference.

6. **Opus constraints.** Native Opus expects 48kHz input. Use ffmpeg for resampling when input is 16kHz. Use `@discordjs/opus` for native encoding/decoding.

7. **FFmpeg path.** Resolve via `VOICE_FFMPEG_PATH` env or default `"ffmpeg"`. Check availability with `ensureFfmpegAvailable()`.

8. **FFmpeg args.** Use `-hide_banner -loglevel error` for quiet mode. Use `-f s16le -ac 1 -ar 16000` for PCM spec. Use `-map_metadata -1` to strip metadata.

9. **FFmpeg execution.** Use `Bun.spawnSync()` for blocking ffmpeg. Pass stdin via `stdin` param. Capture stdout, stderr, exit code.

10. **Base64 handling.** Strip `data:*base64,` prefix via `stripBase64Prefix()`. Use Buffer for encode/decode. Never include MIME prefix in output.

## See Also

- `.ruler/25-voice-architecture.md` for voice architecture

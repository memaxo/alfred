# ML Model Integration Patterns

## Core Principle

ML models are black boxes that fail silently. Defensive coding, verbose debugging, and explicit validation are essential for reliable integration.

## Rules

1. **Log raw model outputs.** During development, always log the raw return value from model inference calls (type, structure, key fields) before processing. Silent failures are impossible to diagnose without this.

2. **Don't modify model state at init.** Avoid calling configuration methods (like `change_attention_model()`, `set_streaming_cfg()`) at initialization time. Many ML frameworks have stateful models where init-time changes permanently alter inference behavior in undocumented ways.

3. **Handle heterogeneous return types.** ML models return different types based on architecture (CTC returns strings, RNNT returns Hypothesis objects, etc.). Check for common attributes (`text`, `transcription`, `pred_text`) rather than assuming a fixed type.

4. **Validate outputs before returning.** Check that model outputs contain expected data (non-empty sequences, valid confidence scores, reasonable lengths) before returning to callers. Return empty/error early with descriptive messages.

5. **Prefer CPU for debugging.** GPU backends (CUDA, MPS) can produce different results than CPU. When debugging unexpected model behavior, test on CPU first to rule out device-specific issues.

6. **Verify audio format compatibility.** When chaining audio models (TTS → STT), explicitly verify sample rates match. Log both input and output sample rates. Implement resampling if needed.

7. **Validate audio duration.** Check that generated audio duration is plausible for the input (e.g., 0.1s per word minimum for TTS). Truncated audio indicates model issues.

8. **Check audio levels.** Calculate RMS and max sample values to detect silence, clipping, or corruption. Audio with max < 100 or RMS < 50 is likely broken.

9. **Isolate warmup from requests.** ML model warmup (first inference) can be slow and interfere with concurrent requests. Either await warmup completion or use separate warmup tracking.

10. **Document device quirks.** When a model works on some devices but not others (e.g., MPS returning empty results), document this explicitly in the codebase and configuration examples.

## Debugging Checklist

When an ML model returns unexpected results:

1. Log the raw return value (type and contents)
2. Check the device (try CPU)
3. Verify input format (sample rate, dtype, shape)
4. Check input values (not silent, not clipped)
5. Check output values (non-empty, valid range)
6. Test with a known-good input
7. Check if any init-time configuration modified the model

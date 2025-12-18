class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.cursor = 0;
    this.isPlaying = false;
    this.inputBuffer = [];
    this.bufferSize = 4096; // Send chunks of ~250ms (at 16kHz) or ~100ms (at 44.1kHz)

    this.port.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === "write") {
        // payload is Float32Array
        if (payload && payload.length > 0) {
          this.buffer.push(payload);
          this.isPlaying = true;
        }
      } else if (type === "clear") {
        this.buffer = [];
        this.cursor = 0;
        this.isPlaying = false;
      }
    };
  }

  process(inputs, outputs, _parameters) {
    // --- Playback (Output) ---
    const output = outputs[0];
    if (output && output.length > 0) {
      const outputChannel = output[0];
      // Check if we have data to play
      if (this.buffer.length > 0) {
        let outputIndex = 0;
        while (outputIndex < outputChannel.length && this.buffer.length > 0) {
          const currentChunk = this.buffer[0];
          const remainingInChunk = currentChunk.length - this.cursor;
          const spaceInOutput = outputChannel.length - outputIndex;

          const copyCount = Math.min(remainingInChunk, spaceInOutput);

          // Copy data
          outputChannel.set(
            currentChunk.subarray(this.cursor, this.cursor + copyCount),
            outputIndex
          );

          this.cursor += copyCount;
          outputIndex += copyCount;

          if (this.cursor >= currentChunk.length) {
            this.buffer.shift();
            this.cursor = 0;
          }
        }
      }
    }

    // --- Recording (Input) ---
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];
      // Only capture if input is active (non-zero check optional but good for VAD visualization if we did it here)
      // We just buffer raw floats
      // Push to temp buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.inputBuffer.push(inputChannel[i]);
      }

      if (this.inputBuffer.length >= this.bufferSize) {
        const chunk = new Float32Array(this.inputBuffer);
        this.inputBuffer = [];
        this.port.postMessage({ type: "audio_data", buffer: chunk }, [
          chunk.buffer,
        ]);
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor("voice-processor", VoiceProcessor);

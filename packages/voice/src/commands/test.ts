/**
 * Voice Test Commands
 *
 * CLI commands for testing STT/TTS functionality.
 */

// biome-ignore lint/suspicious/noConsole: CLI output
const log = console.log;

/**
 * Test speech-to-text with an audio file
 */
export async function testSTT(args: { file?: string }): Promise<void> {
  const file = args.file ?? "test.wav";

  log(`Testing STT with file: ${file}`);

  try {
    const { STTPool } = await import("../process/stt");
    const pool = new STTPool();

    await pool.initialize();

    log("STT pool initialized, transcribing...");

    // Read file and transcribe
    const audioFile = Bun.file(file);
    if (!(await audioFile.exists())) {
      log(`Error: File not found: ${file}`);
      return;
    }

    const buffer = await audioFile.arrayBuffer();
    const result = await pool.transcribe(Buffer.from(buffer));

    log("Transcription result:");
    log(result);
  } catch (error) {
    log(`STT test failed: ${(error as Error).message}`);
  }
}

/**
 * Test text-to-speech with sample text
 */
export async function testTTS(args: { text?: string }): Promise<void> {
  const text =
    args.text ?? "Hello, this is a test of the text to speech system.";

  log(`Testing TTS with text: "${text}"`);

  try {
    const { TTSPool } = await import("../process/tts");
    const pool = new TTSPool();

    await pool.initialize();

    log("TTS pool initialized, synthesizing...");

    const audioBuffer = await pool.synthesize(text);

    log(`Generated ${audioBuffer.length} bytes of audio`);

    // Write to file
    const outFile = "tts-output.wav";
    await Bun.write(outFile, audioBuffer);
    log(`Audio written to: ${outFile}`);
  } catch (error) {
    log(`TTS test failed: ${(error as Error).message}`);
  }
}

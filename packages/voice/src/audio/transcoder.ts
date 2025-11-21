import { Buffer } from "node:buffer";

export class Transcoder {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private closed = false;

  constructor(
    private readonly format: "pcm" | "mp3", // Only support basic formats for now
    private readonly onData: (chunk: Buffer) => void,
    private readonly onError?: (error: Error) => void
  ) {}

  start() {
    if (this.proc) {
      return;
    }

    // Args for streaming input -> streaming output
    // Assuming input is 16k PCM s16le (from codec.ts defaults)
    // and output is target format.
    // NOTE: Persistent transcoding is complex because we need to know boundaries.
    // Actually, ffmpeg can stream raw PCM to raw PCM/MP3.

    const args = [
      "ffmpeg",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-i",
      "pipe:0", // Input from stdin
    ];

    if (this.format === "mp3") {
      args.push("-f", "mp3", "-codec:a", "libmp3lame", "-b:a", "96k", "pipe:1");
    } else {
      // pcm (passthrough or resample)
      args.push("-f", "s16le", "-ar", "16000", "-ac", "1", "pipe:1");
    }

    try {
      this.proc = Bun.spawn(args, {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      // Type assertions for Bun.spawn streams
      this.writer = (this.proc.stdin as any).getWriter();
      this.reader = (this.proc.stdout as any).getReader();

      this.readLoop();
      this.monitorStderr();
    } catch (e) {
      this.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async write(chunk: Uint8Array) {
    if (this.closed || !this.writer) {
      return;
    }
    try {
      await this.writer.write(chunk);
    } catch (_e) {
      // Ignore write errors on closed pipe
    }
  }

  private async readLoop() {
    if (!this.reader) {
      return;
    }
    try {
      while (true) {
        const { done, value } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          this.onData(Buffer.from(value));
        }
      }
    } catch (e) {
      if (!this.closed) {
        this.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  private async monitorStderr() {
    if (!this.proc?.stderr) {
      return;
    }
    const reader = (this.proc.stderr as any).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          const msg = new TextDecoder().decode(value);
          console.warn("[ffmpeg]", msg); // Use it to avoid unused var
        }
      }
    } catch {}
  }

  close() {
    this.closed = true;
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {}
    }
    this.proc = null;
    this.writer = null;
    this.reader = null;
  }
}

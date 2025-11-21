export type VADOptions = {
  fftSize?: number;
  minDecibels?: number;
  maxDecibels?: number;
  smoothingTimeConstant?: number;
  silenceThreshold?: number; // 0-255, approximate energy level
  silenceDurationMs?: number;
  speechThreshold?: number; // 0-255
};

export type VADEvent = "speech_start" | "speech_end";
export type VADCallback = (event: VADEvent) => void;

export class EnergyVAD {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private interval: number | null = null;
  private callbacks: VADCallback[] = [];

  private speaking = false;
  private silenceStart: number | null = null;
  private speechStart: number | null = null;

  private readonly options: Required<VADOptions>;

  constructor(options: VADOptions = {}) {
    this.options = {
      fftSize: options.fftSize ?? 2048,
      minDecibels: options.minDecibels ?? -90,
      maxDecibels: options.maxDecibels ?? -10,
      smoothingTimeConstant: options.smoothingTimeConstant ?? 0.85,
      silenceThreshold: options.silenceThreshold ?? 25, // Adjust based on noise floor
      silenceDurationMs: options.silenceDurationMs ?? 700, // Wait 700ms of silence before stopping
      speechThreshold: options.speechThreshold ?? 40, // Must exceed this to start
    };
  }

  start(stream: MediaStream) {
    this.stop(); // Cleanup existing

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    this.ctx = new AudioContextClass();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();

    this.analyser.fftSize = this.options.fftSize;
    this.analyser.minDecibels = this.options.minDecibels;
    this.analyser.maxDecibels = this.options.maxDecibels;
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

    this.source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    this.interval = window.setInterval(() => {
      if (!this.analyser) {
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average energy
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      this.process(average);
    }, 50); // Check every 50ms
  }

  private process(level: number) {
    const now = Date.now();

    if (this.speaking) {
      if (level < this.options.silenceThreshold) {
        // Potential silence
        if (this.silenceStart === null) {
          this.silenceStart = now;
        } else if (now - this.silenceStart > this.options.silenceDurationMs) {
          // Validated silence
          this.speaking = false;
          this.silenceStart = null;
          this.emit("speech_end");
        }
      } else {
        // Still speaking, reset silence timer
        this.silenceStart = null;
      }
    } else if (level > this.options.speechThreshold) {
      // Potential speech
      if (this.speechStart === null) {
        this.speechStart = now;
      } else if (now - this.speechStart > 50) {
        // Short debounce for start
        this.speaking = true;
        this.speechStart = null;
        this.silenceStart = null;
        this.emit("speech_start");
      }
    } else {
      this.speechStart = null;
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.speaking = false;
    this.silenceStart = null;
    this.speechStart = null;
  }

  on(callback: VADCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private emit(event: VADEvent) {
    this.callbacks.forEach((cb) => cb(event));
  }
}

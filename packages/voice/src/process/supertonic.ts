import { join } from "node:path";
import * as ort from "onnxruntime-node";

// Types
type UnicodeIndexer = number[];

type TTSConfig = {
  ae: {
    sample_rate: number;
    base_chunk_size: number;
  };
  ttl: {
    chunk_compress_factor: number;
    latent_dim: number;
  };
};

export type SupertonicConfig = {
  modelPath: string;
  defaultVoice?: string;
};

export type SupertonicSynthesisResult = {
  audio: Float32Array;
  duration: number;
  sampleRate: number;
};

class UnicodeProcessor {
  constructor(private readonly indexer: UnicodeIndexer) {}

  call(textList: string[]) {
    const processedTexts = textList.map((text) => this.preprocessText(text));

    const textIdsLengths = processedTexts.map((text) => text.length);
    const maxLen = Math.max(...textIdsLengths);

    const textIds = processedTexts.map((text) => {
      const row = new Array(maxLen).fill(0);
      for (let j = 0; j < text.length; j++) {
        const codePoint = text.codePointAt(j);
        row[j] =
          codePoint !== undefined && codePoint < this.indexer.length
            ? this.indexer[codePoint]
            : -1;
      }
      return row;
    });

    const textMask = this.getTextMask(textIdsLengths);
    return { textIds, textMask };
  }

  private preprocessText(text: string): string {
    return text.normalize("NFKC");
  }

  private getTextMask(textIdsLengths: number[]): number[][][] {
    const maxLen = Math.max(...textIdsLengths);
    return this.lengthToMask(textIdsLengths, maxLen);
  }

  private lengthToMask(
    lengths: number[],
    maxLen: number | null = null
  ): number[][][] {
    const actualMaxLen = maxLen || Math.max(...lengths);
    return lengths.map((len) => {
      const row = new Array(actualMaxLen).fill(0.0);
      for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
        row[j] = 1.0;
      }
      return [row];
    });
  }
}

class Style {
  constructor(
    public readonly ttl: ort.Tensor,
    public readonly dp: ort.Tensor
  ) {}
}

class TextToSpeech {
  public readonly sampleRate: number;

  constructor(
    private readonly cfgs: TTSConfig,
    private readonly textProcessor: UnicodeProcessor,
    private readonly dpOrt: ort.InferenceSession,
    private readonly textEncOrt: ort.InferenceSession,
    private readonly vectorEstOrt: ort.InferenceSession,
    private readonly vocoderOrt: ort.InferenceSession
  ) {
    this.sampleRate = cfgs.ae.sample_rate;
  }

  async release() {
    await Promise.all([
      this.dpOrt.release(),
      this.textEncOrt.release(),
      this.vectorEstOrt.release(),
      this.vocoderOrt.release(),
    ]);
  }

  private async _infer(
    textList: string[],
    style: Style,
    totalStep: number,
    speed = 1.05,
    progressCallback: ((current: number, total: number) => void) | null = null
  ) {
    const bsz = textList.length;

    // Process text
    const { textIds, textMask } = this.textProcessor.call(textList);

    const textIds0 = textIds[0];
    if (!textIds0) {
      throw new Error("textIds[0] missing");
    }

    const textIdsFlat = new BigInt64Array(textIds.flat().map((x) => BigInt(x)));
    const textIdsShape = [bsz, textIds0.length];
    const textIdsTensor = new ort.Tensor("int64", textIdsFlat, textIdsShape);

    const textMask0 = textMask[0];
    if (!textMask0) {
      throw new Error("textMask[0] missing");
    }
    const textMask00 = textMask0[0];
    if (!textMask00) {
      throw new Error("textMask[0][0] missing");
    }

    const textMaskFlat = new Float32Array(textMask.flat(2));
    const textMaskShape = [bsz, 1, textMask00.length];
    const textMaskTensor = new ort.Tensor(
      "float32",
      textMaskFlat,
      textMaskShape
    );

    // Predict duration
    const dpOutputs = await this.dpOrt.run({
      text_ids: textIdsTensor,
      style_dp: style.dp,
      text_mask: textMaskTensor,
    });

    if (!dpOutputs.duration) {
      throw new Error("Duration prediction failed: output missing");
    }
    const duration = Array.from(dpOutputs.duration.data as Float32Array);

    // Apply speed factor to duration
    for (let i = 0; i < duration.length; i++) {
      const val = duration[i];
      if (val !== undefined) {
        duration[i] = val / speed;
      }
    }

    // Encode text
    const textEncOutputs = await this.textEncOrt.run({
      text_ids: textIdsTensor,
      style_ttl: style.ttl,
      text_mask: textMaskTensor,
    });
    const textEmb = textEncOutputs.text_emb;
    if (!textEmb) {
      throw new Error("Inference failed: text_emb missing");
    }

    // Sample noisy latent
    let { xt, latentMask } = this.sampleNoisyLatent(
      duration,
      this.sampleRate,
      this.cfgs.ae.base_chunk_size,
      this.cfgs.ttl.chunk_compress_factor,
      this.cfgs.ttl.latent_dim
    );

    const latentMask0 = latentMask[0];
    if (!latentMask0) {
      throw new Error("latentMask[0] missing");
    }
    const latentMask00 = latentMask0[0];
    if (!latentMask00) {
      throw new Error("latentMask[0][0] missing");
    }

    const latentMaskFlat = new Float32Array(latentMask.flat(2));
    const latentMaskShape = [bsz, 1, latentMask00.length];
    const latentMaskTensor = new ort.Tensor(
      "float32",
      latentMaskFlat,
      latentMaskShape
    );

    const totalStepArray = new Float32Array(bsz).fill(totalStep);
    const totalStepTensor = new ort.Tensor("float32", totalStepArray, [bsz]);

    // Denoising loop
    for (let step = 0; step < totalStep; step++) {
      if (progressCallback) {
        progressCallback(step + 1, totalStep);
      }

      const currentStepArray = new Float32Array(bsz).fill(step);
      const currentStepTensor = new ort.Tensor("float32", currentStepArray, [
        bsz,
      ]);

      const xt0 = xt[0];
      if (!xt0) {
        throw new Error("xt[0] missing");
      }
      const xt00 = xt0[0];
      if (!xt00) {
        throw new Error("xt[0][0] missing");
      }

      const xtFlat = new Float32Array(xt.flat(2) as number[]);
      const xtShape = [bsz, xt0.length, xt00.length];
      const xtTensor = new ort.Tensor("float32", xtFlat, xtShape);

      const vectorEstOutputs = await this.vectorEstOrt.run({
        noisy_latent: xtTensor,
        text_emb: textEmb,
        style_ttl: style.ttl,
        latent_mask: latentMaskTensor,
        text_mask: textMaskTensor,
        current_step: currentStepTensor,
        total_step: totalStepTensor,
      });

      if (!vectorEstOutputs.denoised_latent) {
        throw new Error("Vector estimation failed: output missing");
      }

      const denoised = Array.from(
        vectorEstOutputs.denoised_latent.data as Float32Array
      );

      // Reshape to 3D
      const latentDim = xt0.length;
      const latentLen = xt00.length;

      // Reconstruct xt from denoised
      const newXt: number[][][] = [];
      let idx = 0;
      for (let b = 0; b < bsz; b++) {
        const batch: number[][] = [];
        for (let d = 0; d < latentDim; d++) {
          const row: number[] = [];
          for (let t = 0; t < latentLen; t++) {
            const val = denoised[idx++];
            if (val === undefined) {
              throw new Error("Inference failed: denoised index out of bounds");
            }
            row.push(val);
          }
          batch.push(row);
        }
        newXt.push(batch);
      }
      xt = newXt;
    }

    // Generate waveform
    const finalXt0 = xt[0];
    if (!finalXt0) {
      throw new Error("xt[0] missing");
    }
    const finalXt00 = finalXt0[0];
    if (!finalXt00) {
      throw new Error("xt[0][0] missing");
    }

    const finalXtFlat = new Float32Array(xt.flat(2) as number[]);
    const finalXtShape = [bsz, finalXt0.length, finalXt00.length];
    const finalXtTensor = new ort.Tensor("float32", finalXtFlat, finalXtShape);

    const vocoderOutputs = await this.vocoderOrt.run({
      latent: finalXtTensor,
    });

    if (!vocoderOutputs.wav_tts) {
      throw new Error("Vocoder failed: output missing");
    }

    const wav = Array.from(vocoderOutputs.wav_tts.data as Float32Array);

    return { wav, duration };
  }

  async call(
    text: string,
    style: Style,
    totalStep: number,
    speed = 1.05,
    silenceDuration = 0.3,
    progressCallback: ((current: number, total: number) => void) | null = null,
    onChunk?: (chunk: { audio: Float32Array; sampleRate: number }) => void
  ) {
    if (style.ttl.dims[0] !== 1) {
      throw new Error(
        "Single speaker text to speech only supports single style"
      );
    }
    const maxLen = onChunk ? 1 : 300;
    const textList = this.chunkText(text, maxLen);
    let wavCat: number[] = [];
    let durCat = 0;

    for (const chunk of textList) {
      const { wav, duration } = await this._infer(
        [chunk],
        style,
        totalStep,
        speed,
        progressCallback
      );

      if (duration[0] === undefined) {
        throw new Error("Duration missing");
      }

      if (wavCat.length === 0) {
        wavCat = wav;
        durCat = duration[0];
      } else {
        const silenceLen = Math.floor(silenceDuration * this.sampleRate);
        const silence = new Array(silenceLen).fill(0);
        wavCat = [...wavCat, ...silence, ...wav];
        durCat += duration[0] + silenceDuration;
      }

      if (onChunk) {
        onChunk({
          audio: new Float32Array(wav),
          sampleRate: this.sampleRate,
        });
      }
    }

    return { wav: new Float32Array(wavCat), duration: [durCat] };
  }

  private sampleNoisyLatent(
    duration: number[],
    sampleRate: number,
    baseChunkSize: number,
    chunkCompress: number,
    latentDim: number
  ) {
    const bsz = duration.length;
    const maxDur = Math.max(...duration);

    const wavLenMax = Math.floor(maxDur * sampleRate);
    const wavLengths = duration.map((d) => Math.floor(d * sampleRate));

    const chunkSize = baseChunkSize * chunkCompress;
    const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
    const latentDimVal = latentDim * chunkCompress;

    const xt: number[][][] = [];
    for (let b = 0; b < bsz; b++) {
      const batch: number[][] = [];
      for (let d = 0; d < latentDimVal; d++) {
        const row: number[] = [];
        for (let t = 0; t < latentLen; t++) {
          // Box-Muller transform
          const u1 = Math.max(0.0001, Math.random());
          const u2 = Math.random();
          const val =
            Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          row.push(val);
        }
        batch.push(row);
      }
      xt.push(batch);
    }

    const latentLengths = wavLengths.map((len) =>
      Math.floor((len + chunkSize - 1) / chunkSize)
    );
    const latentMask = this.lengthToMask(latentLengths, latentLen);

    // Apply mask
    for (let b = 0; b < bsz; b++) {
      for (let d = 0; d < latentDimVal; d++) {
        for (let t = 0; t < latentLen; t++) {
          const maskRow = latentMask[b]?.[0];
          const maskVal = maskRow ? (maskRow[t] ?? 0) : 0;
          const batch = xt[b];
          if (batch) {
            const dimRow = batch[d];
            if (dimRow) {
              const val = dimRow[t];
              if (val !== undefined) {
                dimRow[t] = val * maskVal;
              }
            }
          }
        }
      }
    }

    return { xt, latentMask };
  }

  private lengthToMask(
    lengths: number[],
    maxLen: number | null = null
  ): number[][][] {
    const actualMaxLen = maxLen || Math.max(...lengths);
    return lengths.map((len) => {
      const row = new Array(actualMaxLen).fill(0.0);
      for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
        row[j] = 1.0;
      }
      return [row];
    });
  }

  private chunkText(text: string, maxLen = 300): string[] {
    // Split by paragraph (two or more newlines)
    const paragraphs = text
      .trim()
      .split(/\n\s*\n+/)
      .filter((p) => p.trim());
    const chunks: string[] = [];

    for (let paragraph of paragraphs) {
      paragraph = paragraph.trim();
      if (!paragraph) {
        continue;
      }

      const sentences = paragraph.split(
        /(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|Ph\.D\.|etc\.|e\.g\.|i\.e\.|vs\.|Inc\.|Ltd\.|Co\.|Corp\.|St\.|Ave\.|Blvd\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/
      );

      let currentChunk = "";
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 <= maxLen) {
          currentChunk += (currentChunk ? " " : "") + sentence;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    }

    return chunks;
  }
}

export class SupertonicTTS {
  private textToSpeech: TextToSpeech | null = null;
  private currentStyle: Style | null = null;
  private currentVoice: string | null = null;
  private initialized = false;
  private readonly config: SupertonicConfig;
  // Cache loaded voices to avoid re-reading and re-allocating tensors
  private readonly voiceCache = new Map<string, Style>();

  constructor(config: SupertonicConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load configuration
      const cfgsFile = Bun.file(join(this.config.modelPath, "tts.json"));
      const cfgsData = await cfgsFile.text();
      const cfgs = JSON.parse(cfgsData) as TTSConfig;

      // Load models
      const sessionOptions = { executionProviders: ["cpu"] }; // Use CPU for node environment

      const [dpOrt, textEncOrt, vectorEstOrt, vocoderOrt] = await Promise.all([
        ort.InferenceSession.create(
          join(this.config.modelPath, "duration_predictor.onnx"),
          sessionOptions
        ),
        ort.InferenceSession.create(
          join(this.config.modelPath, "text_encoder.onnx"),
          sessionOptions
        ),
        ort.InferenceSession.create(
          join(this.config.modelPath, "vector_estimator.onnx"),
          sessionOptions
        ),
        ort.InferenceSession.create(
          join(this.config.modelPath, "vocoder.onnx"),
          sessionOptions
        ),
      ]);

      // Load text processor
      const indexerFile = Bun.file(
        join(this.config.modelPath, "unicode_indexer.json")
      );
      const indexerData = await indexerFile.text();
      const indexer = JSON.parse(indexerData) as UnicodeIndexer;
      const textProcessor = new UnicodeProcessor(indexer);

      this.textToSpeech = new TextToSpeech(
        cfgs,
        textProcessor,
        dpOrt,
        textEncOrt,
        vectorEstOrt,
        vocoderOrt
      );

      if (this.config.defaultVoice) {
        await this.loadVoice(this.config.defaultVoice);
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Supertonic TTS: ${error}`);
    }
  }

  async loadVoice(voiceNameOrPath: string): Promise<void> {
    // Normalize voice name (e.g., "M1" -> "M1.json")
    let voiceFilename = voiceNameOrPath;
    if (
      !voiceFilename.endsWith(".json") &&
      ["M1", "M2", "F1", "F2"].includes(voiceFilename)
    ) {
      voiceFilename = `${voiceFilename}.json`;
    }

    // If it's already loaded, just switch currentStyle
    if (this.voiceCache.has(voiceFilename)) {
      const cached = this.voiceCache.get(voiceFilename);
      if (cached) {
        this.currentStyle = cached;
        this.currentVoice = voiceFilename;
        return;
      }
    }

    // Construct full path
    // Check if it's a full path or relative to modelPath/voice_styles
    let fullPath = voiceFilename;
    if (!(voiceFilename.includes("/") || voiceFilename.includes("\\"))) {
      fullPath = join(this.config.modelPath, "voice_styles", voiceFilename);
    }

    try {
      const voiceFile = Bun.file(fullPath);
      const voiceData = await voiceFile.text();
      const voiceStyle = JSON.parse(voiceData);

      const bsz = 1;
      const ttlDims = voiceStyle.style_ttl.dims;
      const dpDims = voiceStyle.style_dp.dims;

      const ttlDim1 = ttlDims[1];
      const ttlDim2 = ttlDims[2];
      const dpDim1 = dpDims[1];
      const dpDim2 = dpDims[2];

      const ttlFlat = new Float32Array(
        voiceStyle.style_ttl.data.flat(Number.POSITIVE_INFINITY)
      );
      const dpFlat = new Float32Array(
        voiceStyle.style_dp.data.flat(Number.POSITIVE_INFINITY)
      );

      const ttlShape = [bsz, ttlDim1, ttlDim2];
      const dpShape = [bsz, dpDim1, dpDim2];

      const ttlTensor = new ort.Tensor("float32", ttlFlat, ttlShape);
      const dpTensor = new ort.Tensor("float32", dpFlat, dpShape);

      const style = new Style(ttlTensor, dpTensor);

      this.voiceCache.set(voiceFilename, style);
      this.currentStyle = style;
      this.currentVoice = voiceFilename;
    } catch (error) {
      throw new Error(`Failed to load voice ${voiceFilename}: ${error}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.textToSpeech) {
      await this.textToSpeech.release();
      this.textToSpeech = null;
    }
    this.voiceCache.clear();
    this.currentStyle = null;
    this.initialized = false;
  }

  async synthesize(
    text: string,
    options: {
      voice?: string;
      steps?: number;
      speed?: number;
      silenceDuration?: number;
      onChunk?: (chunk: { audio: Float32Array; sampleRate: number }) => void;
    } = {}
  ): Promise<SupertonicSynthesisResult> {
    if (!(this.initialized && this.textToSpeech)) {
      await this.initialize();
    }

    // Handle voice switching
    if (options.voice && options.voice !== this.currentVoice) {
      try {
        await this.loadVoice(options.voice);
      } catch (_error) {}
    }

    if (!this.currentStyle) {
      if (this.config.defaultVoice) {
        await this.loadVoice(this.config.defaultVoice);
      } else {
        throw new Error("No voice style loaded");
      }
    }

    if (!(this.currentStyle && this.textToSpeech)) {
      throw new Error("No voice style loaded or textToSpeech not initialized");
    }

    const result = await this.textToSpeech.call(
      text,
      this.currentStyle,
      options.steps ?? 5,
      options.speed ?? 1.05,
      options.silenceDuration ?? 0.3,
      null,
      options.onChunk
    );

    if (!result) {
      throw new Error("Synthesis failed");
    }

    return {
      audio: result.wav,
      duration: result.duration[0] ?? 0,
      sampleRate: this.textToSpeech.sampleRate,
    };
  }
}

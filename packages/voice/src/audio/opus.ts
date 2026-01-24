import { type Buffer } from "node:buffer";

// Lazy load @discordjs/opus to allow mocking in tests
// oxlint-disable noExplicitAny: Dynamic require
let OpusEncoderClass: any = null;

function getOpusClass() {
  if (!OpusEncoderClass) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("@discordjs/opus");
      OpusEncoderClass = mod.OpusEncoder;
    } catch (error) {
      throw new Error(`opus_load_failed: ${String(error)}`, { cause: e });
    }
  }
  return OpusEncoderClass;
}

const RATE = 48_000;
const CHANNELS = 1;

// oxlint-disable noExplicitAny: Native binding
let encoder: any = null;
// oxlint-disable noExplicitAny: Native binding
let decoder: any = null;

function getEncoder() {
  if (!encoder) {
    const Cls = getOpusClass();
    encoder = new Cls(RATE, CHANNELS);
  }
  return encoder;
}

function getDecoder() {
  if (!decoder) {
    const Cls = getOpusClass();
    decoder = new Cls(RATE, CHANNELS);
  }
  return decoder;
}

export function encodeOpus(pcm: Buffer): Buffer {
  try {
    return getEncoder().encode(pcm);
  } catch (error) {
    throw new Error(
      `opus_encode_failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

export function decodeOpus(opus: Buffer): Buffer {
  try {
    return getDecoder().decode(opus);
  } catch (error) {
    throw new Error(
      `opus_decode_failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

export const OPUS_SAMPLE_RATE = RATE;
export const OPUS_CHANNELS = CHANNELS;

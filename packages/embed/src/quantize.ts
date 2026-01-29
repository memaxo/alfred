/**
 * Int8 Quantization for Embeddings
 *
 * Implements symmetric quantization for embedding vectors to achieve 4x storage reduction
 * with 97-100% cosine similarity retention (per HuggingFace research).
 *
 * Reference: alfred-memory-review.md - "Int8 quantization achieves 97-100% performance retention"
 */

/**
 * Quantization metadata stored alongside quantized embeddings
 */
export interface QuantizationMetadata {
  scale: number;
  dimensions: number;
}

/**
 * Quantized embedding with metadata for reconstruction
 */
export interface QuantizedEmbedding {
  data: Int8Array;
  scale: number;
  dimensions: number;
}

/**
 * Compute scale factor for symmetric quantization
 * Uses max absolute value to map [-max, max] to [-127, 127]
 */
export function computeScale(embedding: number[]): number {
  if (embedding.length === 0) {
    return 1;
  }

  let maxAbs = 0;
  for (const val of embedding) {
    const abs = Math.abs(val);
    if (abs > maxAbs) {
      maxAbs = abs;
    }
  }

  // Avoid division by zero
  if (maxAbs === 0) {
    return 1;
  }

  // Scale factor to map max value to 127
  return maxAbs / 127;
}

/**
 * Quantize float32 embedding to int8
 * Uses symmetric quantization: q = round(x / scale)
 */
export function quantizeToInt8(embedding: number[]): QuantizedEmbedding {
  const scale = computeScale(embedding);
  const quantized = new Int8Array(embedding.length);

  for (let i = 0; i < embedding.length; i++) {
    // Symmetric quantization with clamping
    const val = embedding[i] ?? 0;
    const scaled = val / scale;
    const clamped = Math.max(-127, Math.min(127, Math.round(scaled)));
    quantized[i] = clamped;
  }

  return {
    data: quantized,
    scale,
    dimensions: embedding.length,
  };
}

/**
 * Dequantize int8 back to float32
 * Reconstruction: x = q * scale
 */
export function dequantizeFromInt8(quantized: QuantizedEmbedding): number[] {
  const { data, scale } = quantized;
  const result = new Array<number>(data.length);

  for (let i = 0; i < data.length; i++) {
    const val = data[i] ?? 0;
    result[i] = val * scale;
  }

  return result;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Compute cosine similarity directly on quantized embeddings
 * More efficient than dequantizing first
 */
export function quantizedCosineSimilarity(
  a: QuantizedEmbedding,
  b: QuantizedEmbedding
): number {
  if (a.dimensions !== b.dimensions || a.dimensions === 0) {
    return 0;
  }

  const aData = a.data;
  const bData = b.data;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.dimensions; i++) {
    // Scale factors cancel out in cosine similarity
    // cos(a,b) = (a·b)/(|a||b|) = (qa*sa · qb*sb)/(|qa*sa||qb*sb|)
    //          = (qa·qb * sa*sb) / (|qa|*sa * |qb|*sb)
    //          = (qa·qb) / (|qa||qb|)
    const aVal = aData[i] ?? 0;
    const bVal = bData[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Batch quantize multiple embeddings
 */
export function quantizeBatch(embeddings: number[][]): QuantizedEmbedding[] {
  return embeddings.map(quantizeToInt8);
}

/**
 * Batch dequantize multiple embeddings
 */
export function dequantizeBatch(
  quantizedEmbeddings: QuantizedEmbedding[]
): number[][] {
  return quantizedEmbeddings.map(dequantizeFromInt8);
}

/**
 * Serialize quantized embedding for storage
 * Format: [scale as float64 (8 bytes)] + [int8 data]
 */
export function serializeQuantized(quantized: QuantizedEmbedding): Uint8Array {
  const buffer = new ArrayBuffer(8 + quantized.dimensions);
  const view = new DataView(buffer);

  // Write scale as float64
  view.setFloat64(0, quantized.scale, true); // little-endian

  // Copy int8 data
  const uint8View = new Uint8Array(buffer, 8);
  for (let i = 0; i < quantized.dimensions; i++) {
    // Convert signed int8 to unsigned for storage
    const val = quantized.data[i] ?? 0;
    uint8View[i] = (val + 128) & 0xff;
  }

  return new Uint8Array(buffer);
}

/**
 * Deserialize quantized embedding from storage
 */
export function deserializeQuantized(data: Uint8Array): QuantizedEmbedding {
  if (data.length < 8) {
    throw new Error("Invalid quantized embedding data: too short");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const scale = view.getFloat64(0, true); // little-endian

  const dimensions = data.length - 8;
  const int8Data = new Int8Array(dimensions);

  for (let i = 0; i < dimensions; i++) {
    // Convert unsigned back to signed
    const val = data[8 + i] ?? 128;
    int8Data[i] = val - 128;
  }

  return {
    data: int8Data,
    scale,
    dimensions,
  };
}

/**
 * Calculate storage ratio (float32 vs int8)
 * float32: 4 bytes per dimension
 * int8 + metadata: 1 byte per dimension + 8 bytes scale
 */
export function storageRatio(dimensions: number): number {
  const float32Size = dimensions * 4;
  const int8Size = dimensions + 8; // int8 data + scale
  return float32Size / int8Size;
}

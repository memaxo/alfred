function hash32(str: string): number {
  // FNV-1a 32-bit
  let h = 0x81_1C_9D_C5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.codePointAt(i) ?? 0;
    h = Math.imul(h, 0x01_00_01_93);
  }
  return h >>> 0;
}

export function embedText(text: string, dims = 128): Float32Array {
  const v = new Float32Array(dims);
  const toks = text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 2 && t.length <= 40);

  for (const t of toks) {
    const h = hash32(t);
    const i = h % dims;
    const sign = (h & 1) === 0 ? 1 : -1;
    v[i] = (v[i] ?? 0) + sign;
  }

  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i] ?? 0;
    norm += x * x;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) {
      v[i] = (v[i] ?? 0) / norm;
    }
  }

  return v;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

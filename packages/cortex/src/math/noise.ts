/**
 * Noise Functions
 *
 * Simplex and Fractal Brownian Motion noise for organic effects.
 * Implementations match WGSL shader versions for CPU/GPU parity.
 */

// Permutation table for simplex noise
const PERM = new Uint8Array(512);
const GRAD3 = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];

// Initialize permutation table
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }

  // Fisher-Yates shuffle with fixed seed
  let seed = 12_345;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16_807) % 2_147_483_647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }

  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
  }
})();

/**
 * 2D Simplex Noise
 *
 * Returns value in range [-1, 1]
 */
export function simplexNoise2D(x: number, y: number): number {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  // Skew input to determine which simplex cell
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);

  // Unskew to get simplex origin
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;

  // Distances from simplex origin
  const x0 = x - X0;
  const y0 = y - Y0;

  // Determine which simplex we're in
  let i1: number, j1: number;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  // Offsets for second and third corners
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  // Hash coordinates
  const ii = i & 255;
  const jj = j & 255;

  // Calculate contributions from three corners
  let n0 = 0,
    n1 = 0,
    n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const gi0 = PERM[ii + PERM[jj]] % 12;
    t0 *= t0;
    n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const gi1 = PERM[ii + i1 + PERM[jj + j1]] % 12;
    t1 *= t1;
    n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const gi2 = PERM[ii + 1 + PERM[jj + 1]] % 12;
    t2 *= t2;
    n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
  }

  // Scale to [-1, 1]
  return 70 * (n0 + n1 + n2);
}

/**
 * Fractal Brownian Motion
 *
 * Layered noise for natural textures.
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param octaves - Number of noise layers
 * @param persistence - Amplitude decay per octave (default 0.5)
 * @param lacunarity - Frequency multiplier per octave (default 2.0)
 */
export function fbm(
  x: number,
  y: number,
  octaves: number,
  persistence = 0.5,
  lacunarity = 2
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplexNoise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Ridged noise variant
 *
 * Creates sharp ridges useful for fiber textures.
 */
export function ridgedNoise(x: number, y: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let weight = 1;

  for (let i = 0; i < octaves; i++) {
    let signal = simplexNoise2D(x * frequency, y * frequency);
    signal = 1 - Math.abs(signal);
    signal *= signal;
    signal *= weight;
    weight = Math.min(1, Math.max(0, signal * 2));
    value += signal * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value;
}

/**
 * Turbulence (absolute value noise)
 */
export function turbulence(x: number, y: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * Math.abs(simplexNoise2D(x * frequency, y * frequency));
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value;
}

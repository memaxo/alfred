/**
 * Fallback Renderers
 *
 * Export fallback rendering implementations for devices without WebGPU.
 */

export type { Canvas2DConfig } from "./canvas2d";
export { Canvas2DRenderer, createCanvas2DFallback } from "./canvas2d";
export type { WebGLConfig } from "./webgl";
export { createWebGLFallback, WebGLRenderer } from "./webgl";

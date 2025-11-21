# Mindscape Test Plan

## Purpose
Ensure reliability, performance, and visual correctness of the Mindscape Frontpage system across its isomorphic (Server/Client) and hybrid (WebGPU/Canvas2D) implementation.

## 1. Unit Tests (Logic & Math)
Focus on pure functions and independent modules.

### `math.test.ts` (Existing)
- [x] `signalToCharIndex` mapping and distribution.
- [x] `oklchToRgb` validity.

### `font-atlas.test.ts` (New)
- [ ] Verify `createFontAtlas` returns correct structure.
- [ ] Verify atlas dimensions match configuration (1024x1024).
- [ ] Verify Grid layout logic (16 cols).
- [ ] Ensure `OffscreenCanvas` is used in Node/Bun environment (mock if needed).

### `ssr.test.ts` (New)
- [ ] Test `calculateAsciiFrame` (extract from `index.server.ts` or `engine.ts` if shared).
- [ ] Verify output is a string.
- [ ] Verify output dimensions (rows/cols) match input.
- [ ] Verify content contains only characters from `GLYPH_SET`.

## 2. Integration Tests (Engine & State)
Focus on the `MindscapeEngine` lifecycle and environment handling.

### `engine.test.ts` (New)
- [ ] **Lifecycle**: Test instantiation does not throw.
- [ ] **Fallback**: Simulate missing `navigator.gpu` and verify `isWebGPU` flag is false.
- [ ] **Battery**: Mock `navigator.getBattery` and verify `isLowPowerMode` toggles correctly.
- [ ] **Resize**: Verify `handleResize` updates canvas dimensions and respects DPR (mock `window.devicePixelRatio`).
- [ ] **Cleanup**: Verify `destroy()` removes event listeners and observers.

## 3. Visual Consistency (Manual/Verification)
Since automated visual regression for WebGPU is complex in this environment, we define manual verification steps or "math consistency" checks.

- [ ] **Algorithm Match**: Ensure the JS math in `engine.ts` (Canvas2D loop) matches the WGSL formula in `compute.wgsl` (by code inspection or extracting the JS logic to a shared verifyable function).

## Implementation Strategy
1.  **Refactor SSR Logic**: Extract `calculateAsciiFrame` logic to a shared/testable file if possible, or export it from `index.server.ts` for testing.
2.  **Mocking**: Use `bun:test` mocks for DOM APIs (`HTMLCanvasElement`, `ResizeObserver`, `navigator`).

## Test Files to Create
- `apps/web/src/lib/mindscape/font-atlas.test.ts`
- `apps/web/src/lib/mindscape/engine.test.ts`
- `apps/web/src/routes/index.server.test.ts`

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

const { window } = dom;

globalThis.window = window as unknown as typeof globalThis.window;
globalThis.document = window.document;
globalThis.self = window as unknown as typeof globalThis;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.MutationObserver = window.MutationObserver;
globalThis.navigator = window.navigator;
globalThis.getComputedStyle = window.getComputedStyle;
(globalThis.document as Document & { documentMode?: number }).documentMode =
  undefined;
(HTMLElement.prototype as unknown as { attachEvent?: () => void }).attachEvent =
  () => undefined;
(HTMLElement.prototype as unknown as { detachEvent?: () => void }).detachEvent =
  () => undefined;

// Provide minimal canvas and resize observer shims for jsdom-based tests.
if (typeof (globalThis as any).HTMLCanvasElement === "undefined") {
  class CanvasElement extends window.HTMLElement {}
  (globalThis as any).HTMLCanvasElement = CanvasElement;
  (window as any).HTMLCanvasElement = CanvasElement;
}

const HTMLCanvasProto = (globalThis as any)
  .HTMLCanvasElement.prototype as {
  getContext?: (contextId: string, options?: unknown) => unknown;
};
if (!HTMLCanvasProto.getContext) {
  HTMLCanvasProto.getContext = () => ({
    fillRect() {},
    clearRect() {},
    getImageData: () => ({ data: [] }),
    putImageData() {},
    createImageData: () => [],
    setTransform() {},
    drawImage() {},
    save() {},
    fillText() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    translate() {},
    scale() {},
    rotate() {},
    arc() {},
    fill() {},
    measureText: () => ({ width: 0 }),
    transform() {},
    rect() {},
    clip() {},
  });
}

if (typeof (globalThis as any).ResizeObserver === "undefined") {
  const ResizeObserverPolyfill = class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_callback: (entries: unknown[]) => void) {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    observe(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unobserve(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect(): void {}
  };
  (globalThis as any).ResizeObserver = ResizeObserverPolyfill;
  if (typeof window !== "undefined") {
    (window as any).ResizeObserver = ResizeObserverPolyfill;
  }
}

if (typeof (globalThis as any).screen === "undefined") {
  const screenStub = {
    width: 1024,
    height: 768,
    availWidth: 1024,
    availHeight: 768,
    colorDepth: 24,
    pixelDepth: 24,
  };
  (globalThis as any).screen = screenStub;
  if (typeof window !== "undefined") {
    (window as any).screen = screenStub;
  }
}

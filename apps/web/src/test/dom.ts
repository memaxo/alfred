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
  () => {};
(HTMLElement.prototype as unknown as { detachEvent?: () => void }).detachEvent =
  () => {};

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16) as unknown as number;
}

if (typeof globalThis.cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = (handle: number) => {
    clearTimeout(handle);
  };
}

// Provide minimal canvas and resize observer shims for jsdom-based tests.
const CanvasElementCtor = (window as any).HTMLCanvasElement
  ? (window as any).HTMLCanvasElement
  : (globalThis as any).HTMLCanvasElement
    ? (globalThis as any).HTMLCanvasElement
    : class CanvasElement extends window.HTMLElement {};

(globalThis as any).HTMLCanvasElement = CanvasElementCtor;
(window as any).HTMLCanvasElement = CanvasElementCtor;

const HTMLCanvasProto = CanvasElementCtor.prototype as {
  getContext?: (contextId: string, options?: unknown) => unknown;
  toDataURL?: () => string;
};

HTMLCanvasProto.getContext = () => ({
  fillRect() {},
  clearRect() {},
  getImageData: () => ({ data: [] }),
  putImageData() {},
  createImageData: () => [],
  createLinearGradient: () => ({
    addColorStop() {},
  }),
  createRadialGradient: () => ({
    addColorStop() {},
  }),
  createPattern: () => null,
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

if (!HTMLCanvasProto.toDataURL) {
  HTMLCanvasProto.toDataURL = () => "data:image/png;base64,";
}

if (typeof (globalThis as any).ResizeObserver === "undefined") {
  const ResizeObserverPolyfill = class ResizeObserver {
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

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  } as Storage;
};

const ensureStorage = (key: "localStorage" | "sessionStorage") => {
  const storage = createMemoryStorage();
  const assign = (target: typeof globalThis | Window) => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value: storage,
      writable: true,
    });
  };

  if (typeof (globalThis as any)[key] === "undefined") {
    assign(globalThis);
  }

  if (
    typeof window !== "undefined" &&
    typeof (window as any)[key] === "undefined"
  ) {
    assign(window);
  }
};

ensureStorage("localStorage");
ensureStorage("sessionStorage");

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - jsdom doesn't have types in this project
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

const { window } = dom;

(globalThis as { window: unknown }).window = window;
globalThis.document = window.document;
(globalThis as { self: unknown }).self = window;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.MouseEvent = window.MouseEvent;
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

// Also set on window since some libraries access window.* directly
type WindowWithRAF = Window & {
  requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
  cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
};

if (typeof (window as WindowWithRAF).requestAnimationFrame === "undefined") {
  (window as WindowWithRAF).requestAnimationFrame =
    globalThis.requestAnimationFrame;
}

if (typeof (window as WindowWithRAF).cancelAnimationFrame === "undefined") {
  (window as WindowWithRAF).cancelAnimationFrame =
    globalThis.cancelAnimationFrame;
}

// Provide minimal canvas and resize observer shims for jsdom-based tests.
type WindowWithCanvas = Window & {
  HTMLCanvasElement?: typeof HTMLCanvasElement;
};

type GlobalWithCanvas = typeof globalThis & {
  HTMLCanvasElement?: typeof HTMLCanvasElement;
};

const CanvasElementCtor =
  (window as WindowWithCanvas).HTMLCanvasElement ??
  (globalThis as GlobalWithCanvas).HTMLCanvasElement ??
  (class CanvasElement extends window.HTMLElement {} as typeof HTMLCanvasElement);

(globalThis as GlobalWithCanvas).HTMLCanvasElement = CanvasElementCtor;
(window as WindowWithCanvas).HTMLCanvasElement = CanvasElementCtor;

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

type GlobalWithResizeObserver = typeof globalThis & {
  ResizeObserver?: typeof ResizeObserver;
};

type WindowWithResizeObserver = Window & {
  ResizeObserver?: typeof ResizeObserver;
};

if (
  typeof (globalThis as GlobalWithResizeObserver).ResizeObserver === "undefined"
) {
  const ResizeObserverPolyfill = class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    observe(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unobserve(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect(): void {}
  } as typeof ResizeObserver;
  (globalThis as GlobalWithResizeObserver).ResizeObserver =
    ResizeObserverPolyfill;
  if (typeof window !== "undefined") {
    (window as WindowWithResizeObserver).ResizeObserver =
      ResizeObserverPolyfill;
  }
}

type GlobalWithScreen = typeof globalThis & {
  screen?: Screen;
};

type WindowWithScreen = Window & {
  screen?: Screen;
};

if (typeof (globalThis as GlobalWithScreen).screen === "undefined") {
  const screenStub: Screen = {
    width: 1024,
    height: 768,
    availWidth: 1024,
    availHeight: 768,
    colorDepth: 24,
    pixelDepth: 24,
  } as Screen;
  (globalThis as GlobalWithScreen).screen = screenStub;
  if (typeof window !== "undefined") {
    (window as WindowWithScreen).screen = screenStub;
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

  type GlobalWithStorage = typeof globalThis & {
    [K in typeof key]?: Storage;
  };

  type WindowWithStorage = Window & {
    [K in typeof key]?: Storage;
  };

  if (typeof (globalThis as GlobalWithStorage)[key] === "undefined") {
    assign(globalThis);
  }

  if (
    typeof window !== "undefined" &&
    typeof (window as WindowWithStorage)[key] === "undefined"
  ) {
    assign(window);
  }
};

ensureStorage("localStorage");
ensureStorage("sessionStorage");

if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    public pointerId: number;
    public width: number;
    public height: number;
    public pressure: number;
    public tangentialPressure: number;
    public tiltX: number;
    public tiltY: number;
    public twist: number;
    public pointerType: string;
    public isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  if (typeof globalThis !== "undefined") {
    // biome-ignore lint: test scaffold code
    (
      globalThis as typeof globalThis & { PointerEvent: typeof PointerEvent }
    ).PointerEvent = PointerEvent;
  }
  if (typeof window !== "undefined") {
    // biome-ignore lint: test scaffold code
    (
      window as typeof window & { PointerEvent: typeof PointerEvent }
    ).PointerEvent = PointerEvent;
  }
}

// Suppress specific warnings that are noisy in tests
// biome-ignore lint/suspicious/noConsole: test environment setup
const originalConsoleWarn = console.warn;
// biome-ignore lint/suspicious/noConsole: test environment setup
const originalConsoleError = console.error;

console.warn = (...args) => {
  const msg = args[0];
  if (typeof msg === "string") {
    if (msg.includes("THREE.WebGLRenderer")) {
      return;
    }
    if (msg.includes('The pseudo class ":first-child" is potentially unsafe')) {
      return;
    }
    if (msg.includes('The pseudo class ":nth-child" is potentially unsafe')) {
      return;
    }
  }
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  const msg = args[0];
  if (typeof msg === "string" && msg.includes("Error creating WebGL context")) {
    return;
  }
  originalConsoleError(...args);
};

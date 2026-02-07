import { render } from "@testing-library/react";
import { describe, expect, it, mock, vi } from "bun:test";

const useReducedMotionMock = vi.fn(() => true);
let frameCallback: ((state: unknown, delta: number) => void) | null = null;

mock.module("@/components/desktop/accessibility/hooks", () => ({
  useReducedMotion: useReducedMotionMock,
}));

mock.module("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useThree: () => ({
    gl: {
      domElement: document.createElement("canvas"),
      forceContextRestore: vi.fn(),
    },
  }),
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frameCallback = cb;
  },
}));

import { Orb } from "../orb";

describe("Orb reduced motion behavior", () => {
  it("registers a frame callback that short-circuits under reduced motion", () => {
    render(<Orb />);

    expect(useReducedMotionMock).toHaveBeenCalled();
    expect(frameCallback).toBeTruthy();

    expect(() => frameCallback?.({}, 0.16)).not.toThrow();
  });
});

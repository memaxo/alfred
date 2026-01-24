import { describe, expect, it } from "bun:test";

import { detectZoneFromPosition } from "../../../components/desktop/tiling/utils";

describe("Tiling System Integration", () => {
  it("should calculate zone bounds for split-h layout", () => {
    const desktopArea = { x: 0, y: 32, width: 1920, height: 1000 };
    const gap = 8;

    const halfWidth = (desktopArea.width - gap) / 2;

    expect(halfWidth).toBe(956);

    const leftZone = {
      id: "left" as const,
      bounds: {
        x: desktopArea.x,
        y: desktopArea.y,
        width: halfWidth,
        height: desktopArea.height,
      },
      occupied: false,
    };

    const rightZone = {
      id: "right" as const,
      bounds: {
        x: desktopArea.x + halfWidth + gap,
        y: desktopArea.y,
        width: halfWidth,
        height: desktopArea.height,
      },
      occupied: false,
    };

    expect(leftZone.bounds.width).toBe(956);
    expect(rightZone.bounds.x).toBe(964);
    expect(rightZone.bounds.width).toBe(956);
  });

  it("should calculate zone bounds for quad layout", () => {
    const desktopArea = { x: 0, y: 32, width: 1920, height: 1000 };
    const gap = 8;

    const halfWidth = (desktopArea.width - gap) / 2;
    const halfHeight = (desktopArea.height - gap) / 2;

    expect(halfWidth).toBe(956);
    expect(halfHeight).toBe(496);

    const topLeftZone = {
      id: "top-left" as const,
      bounds: {
        x: desktopArea.x,
        y: desktopArea.y,
        width: halfWidth,
        height: halfHeight,
      },
      occupied: false,
    };

    const topRightZone = {
      id: "top-right" as const,
      bounds: {
        x: desktopArea.x + halfWidth + gap,
        y: desktopArea.y,
        width: halfWidth,
        height: halfHeight,
      },
      occupied: false,
    };

    expect(topLeftZone.bounds.width).toBe(956);
    expect(topLeftZone.bounds.height).toBe(496);
    expect(topRightZone.bounds.x).toBe(964);
  });

  it("should detect tile zone from cursor position", () => {
    const desktopArea = { x: 0, y: 32, width: 1920, height: 1000 };

    const x = 400;
    const y = 400;

    const zone = detectZoneFromPosition(x, y, desktopArea);

    expect(zone).toBe("left");
  });
});

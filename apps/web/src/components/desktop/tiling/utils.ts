import type { DesktopArea, TileZone } from "@/store/desktop/types.new";

/**
 * Detects the tile zone based on a cursor position within the desktop area.
 */
export function detectZoneFromPosition(
  x: number,
  y: number,
  desktopArea: DesktopArea
): TileZone | null {
  const { width, height, x: areaX, y: areaY } = desktopArea;
  const relativeX = x - areaX;
  const relativeY = y - areaY;

  // Corner quadrants (30% threshold)
  if (relativeX < width * 0.3 && relativeY < height * 0.3) {
    return "top-left";
  }
  if (relativeX > width * 0.7 && relativeY < height * 0.3) {
    return "top-right";
  }
  if (relativeX < width * 0.3 && relativeY > height * 0.7) {
    return "bottom-left";
  }
  if (relativeX > width * 0.7 && relativeY > height * 0.7) {
    return "bottom-right";
  }

  // Side halves (50% threshold)
  if (relativeX < width * 0.5) {
    return "left";
  }
  if (relativeX > width * 0.5) {
    return "right";
  }
  if (relativeY < height * 0.5) {
    return "top";
  }
  return "bottom";
}

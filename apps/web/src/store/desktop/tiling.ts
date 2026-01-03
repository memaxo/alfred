/**
 * Tiling Slice - Wayland-inspired tiling window manager
 *
 * @see docs/execplans/desktop-type-migration.md Section 2.2
 */

import type { StateCreator } from "zustand";
import type {
  Bounds,
  DesktopState,
  TileZone,
  TilingConfig,
  TilingLayout,
  TilingSlice,
  TilingZoneState,
} from "./types.new";

const DEFAULT_CONFIG: TilingConfig = {
  layout: "float",
  gap: 8,
  mainRatio: 0.6,
  respectMinSize: true,
};

/**
 * Calculate zone bounds based on layout and desktop area
 */
function calculateZoneBounds(
  layout: TilingLayout,
  desktopArea: Bounds,
  gap: number,
  mainRatio: number
): TilingZoneState[] {
  const { x, y, width, height } = desktopArea;
  const halfWidth = (width - gap) / 2;
  const halfHeight = (height - gap) / 2;
  const mainWidth = width * mainRatio - gap / 2;
  const sideWidth = width * (1 - mainRatio) - gap / 2;

  switch (layout) {
    case "float":
      return [
        {
          id: "center",
          bounds: { x, y, width, height },
          occupied: false,
        },
      ];

    case "split-h":
      return [
        {
          id: "left",
          bounds: { x, y, width: halfWidth, height },
          occupied: false,
        },
        {
          id: "right",
          bounds: { x: x + halfWidth + gap, y, width: halfWidth, height },
          occupied: false,
        },
      ];

    case "split-v":
      return [
        {
          id: "top",
          bounds: { x, y, width, height: halfHeight },
          occupied: false,
        },
        {
          id: "bottom",
          bounds: { x, y: y + halfHeight + gap, width, height: halfHeight },
          occupied: false,
        },
      ];

    case "quad":
      return [
        {
          id: "top-left",
          bounds: { x, y, width: halfWidth, height: halfHeight },
          occupied: false,
        },
        {
          id: "top-right",
          bounds: {
            x: x + halfWidth + gap,
            y,
            width: halfWidth,
            height: halfHeight,
          },
          occupied: false,
        },
        {
          id: "bottom-left",
          bounds: {
            x,
            y: y + halfHeight + gap,
            width: halfWidth,
            height: halfHeight,
          },
          occupied: false,
        },
        {
          id: "bottom-right",
          bounds: {
            x: x + halfWidth + gap,
            y: y + halfHeight + gap,
            width: halfWidth,
            height: halfHeight,
          },
          occupied: false,
        },
      ];

    case "main-side":
      return [
        {
          id: "left",
          bounds: { x, y, width: mainWidth, height },
          occupied: false,
        },
        {
          id: "right",
          bounds: { x: x + mainWidth + gap, y, width: sideWidth, height },
          occupied: false,
        },
      ];

    case "stack":
      return [
        {
          id: "full",
          bounds: { x, y, width, height },
          occupied: false,
        },
      ];

    case "columns": {
      // Default to 3 columns
      const colWidth = (width - gap * 2) / 3;
      return [
        {
          id: "left",
          bounds: { x, y, width: colWidth, height },
          occupied: false,
        },
        {
          id: "center",
          bounds: { x: x + colWidth + gap, y, width: colWidth, height },
          occupied: false,
        },
        {
          id: "right",
          bounds: { x: x + colWidth * 2 + gap * 2, y, width: colWidth, height },
          occupied: false,
        },
      ];
    }

    default:
      return [
        {
          id: "center",
          bounds: { x, y, width, height },
          occupied: false,
        },
      ];
  }
}

export const createTilingSlice: StateCreator<
  DesktopState,
  [],
  [],
  TilingSlice
> = (set, get) => ({
  config: DEFAULT_CONFIG,
  zones: [],
  activeTilePreview: null,

  setLayout: (layout: TilingLayout) => {
    set((state) => ({
      config: { ...state.config, layout },
    }));
    get().calculateZones();
  },

  setGap: (gap: number) => {
    set((state) => ({
      config: { ...state.config, gap: Math.max(0, Math.min(32, gap)) },
    }));
    get().calculateZones();
  },

  setMainRatio: (ratio: number) => {
    set((state) => ({
      config: {
        ...state.config,
        mainRatio: Math.max(0.3, Math.min(0.8, ratio)),
      },
    }));
    get().calculateZones();
  },

  calculateZones: () => {
    const { config, desktopArea, windows } = get();
    const zones = calculateZoneBounds(
      config.layout,
      desktopArea,
      config.gap,
      config.mainRatio
    );

    // Mark zones as occupied if windows are tiled in them
    for (const zone of zones) {
      const tiledWindow = windows.find(
        (w) => w.isTiled && w.tileZone === zone.id
      );
      if (tiledWindow) {
        zone.occupied = true;
        zone.windowId = tiledWindow.id;
      }
    }

    set({ zones });
  },

  tileWindow: (windowId: string, zone: TileZone) => {
    const { zones, windows, config } = get();
    const targetZone = zones.find((z) => z.id === zone);

    if (!targetZone) {
      return;
    }

    // Check min size constraint
    const window = windows.find((w) => w.id === windowId);
    if (
      window &&
      config.respectMinSize &&
      (targetZone.bounds.width < window.minSize.width ||
        targetZone.bounds.height < window.minSize.height)
    ) {
      return;
    }

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id === windowId) {
          return {
            ...w,
            isTiled: true,
            tileZone: zone,
            bounds: targetZone.bounds,
            state: "normal" as const,
          };
        }
        return w;
      }),
      zones: state.zones.map((z) => {
        if (z.id === zone) {
          return { ...z, occupied: true, windowId };
        }
        // Clear previous assignment if window was in another zone
        if (z.windowId === windowId) {
          return { ...z, occupied: false, windowId: undefined };
        }
        return z;
      }),
    }));
  },

  untileWindow: (windowId: string) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id === windowId) {
          return {
            ...w,
            isTiled: false,
            tileZone: undefined,
          };
        }
        return w;
      }),
      zones: state.zones.map((z) => {
        if (z.windowId === windowId) {
          return { ...z, occupied: false, windowId: undefined };
        }
        return z;
      }),
    }));
  },

  swapTiles: (zoneA: TileZone, zoneB: TileZone) => {
    const { zones } = get();
    const stateA = zones.find((z) => z.id === zoneA);
    const stateB = zones.find((z) => z.id === zoneB);

    if (!(stateA && stateB)) {
      return;
    }

    const windowA = stateA.windowId;
    const windowB = stateB.windowId;

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id === windowA) {
          return {
            ...w,
            tileZone: zoneB,
            bounds: stateB.bounds,
          };
        }
        if (w.id === windowB) {
          return {
            ...w,
            tileZone: zoneA,
            bounds: stateA.bounds,
          };
        }
        return w;
      }),
      zones: state.zones.map((z) => {
        if (z.id === zoneA) {
          return { ...z, windowId: windowB, occupied: !!windowB };
        }
        if (z.id === zoneB) {
          return { ...z, windowId: windowA, occupied: !!windowA };
        }
        return z;
      }),
    }));
  },

  showTilePreview: (zone: TileZone) => {
    set({ activeTilePreview: zone });
  },

  hideTilePreview: () => {
    set({ activeTilePreview: null });
  },

  autoTile: () => {
    const { windows, zones, config } = get();
    const floatingWindows = windows.filter(
      (w) => !w.isTiled && w.state === "normal"
    );
    const availableZones = zones.filter((z) => !z.occupied);

    if (floatingWindows.length === 0 || availableZones.length === 0) {
      return;
    }

    // Tile windows into available zones
    const assignments: Array<{ windowId: string; zone: TileZone }> = [];
    for (
      let i = 0;
      i < Math.min(floatingWindows.length, availableZones.length);
      i++
    ) {
      const window = floatingWindows.at(i);
      const zone = availableZones.at(i);

      if (!(window && zone)) {
        continue;
      }

      // Check min size constraint
      if (
        config.respectMinSize &&
        (zone.bounds.width < window.minSize.width ||
          zone.bounds.height < window.minSize.height)
      ) {
        continue;
      }

      assignments.push({ windowId: window.id, zone: zone.id });
    }

    // Apply all assignments
    for (const { windowId, zone } of assignments) {
      get().tileWindow(windowId, zone);
    }
  },
});

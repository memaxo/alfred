/**
 * Window Adapter - Bridge between ReactFlow NodeProps and WindowComponentProps
 *
 * This adapter enables gradual migration from ReactFlow-based windows to
 * traditional DOM-based windows. It wraps legacy window components that
 * expect NodeProps and provides them with the new WindowComponentProps interface.
 *
 * @see docs/execplans/desktop-type-migration.md Section 6.1
 */

import { type ComponentType, useCallback } from "react";

import type { WindowData, WindowInstance } from "@/store/desktop/types.new";

import { useDesktopStore } from "@/store/desktop";

import type {
  LegacyNodeProps,
  ResizeDirection,
  WindowComponentProps,
} from "./types";

import { detectZoneFromPosition } from "../tiling/utils";

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER: Legacy → New Props
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a WindowInstance to legacy NodeProps format
 * Used when rendering legacy components in the new system
 */
export function windowToNodeProps(window: WindowInstance): LegacyNodeProps {
  return {
    id: window.id,
    data: window.data,
    selected: window.isFocused,
    dragging: false,
    type: window.type,
    xPos: window.bounds.x,
    yPos: window.bounds.y,
    zIndex: window.zIndex,
    connectable: false, // Windows don't use ReactFlow connections
    positionAbsoluteX: window.bounds.x,
    positionAbsoluteY: window.bounds.y,
  };
}

/**
 * Convert legacy NodeProps (from ReactFlow) to WindowInstance
 * Used during migration when ReactFlow is still providing window state
 */
export function nodePropsToWindow(
  props: LegacyNodeProps,
  defaults?: Partial<WindowInstance>
): WindowInstance {
  const now = Date.now();
  return {
    id: props.id,
    type: (props.data?.type ?? props.type ?? "chat") as WindowInstance["type"],
    data: props.data ?? { type: "chat" as const, viewMode: "full" as const },
    bounds: {
      x: props.xPos ?? props.positionAbsoluteX ?? 100,
      y: props.yPos ?? props.positionAbsoluteY ?? 100,
      width: defaults?.bounds?.width ?? 400,
      height: defaults?.bounds?.height ?? 300,
    },
    state: "normal",
    isTiled: false,
    zIndex: props.zIndex ?? 0,
    isFocused: props.selected ?? false,
    minSize: defaults?.minSize ?? { width: 200, height: 150 },
    resizable: defaults?.resizable ?? true,
    createdAt: defaults?.createdAt ?? now,
    lastFocusedAt: props.selected ? now : (defaults?.lastFocusedAt ?? now),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOC: Wrap Legacy Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Higher-order component that wraps a legacy window component (expecting NodeProps)
 * and provides it with the new WindowComponentProps interface.
 *
 * Usage:
 * ```tsx
 * const NewChatWindow = withWindowAdapter(LegacyChatWindow);
 * // Now NewChatWindow accepts WindowComponentProps
 * ```
 */
export function withWindowAdapter<P extends LegacyNodeProps>(
  LegacyComponent: ComponentType<P>
): ComponentType<WindowComponentProps> {
  function AdaptedComponent(props: WindowComponentProps) {
    const { window } = props;
    const legacyProps = windowToNodeProps(window) as P;

    return <LegacyComponent {...legacyProps} />;
  }

  AdaptedComponent.displayName = `withWindowAdapter(${LegacyComponent.displayName ?? LegacyComponent.name ?? "Component"})`;

  return AdaptedComponent;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOC: Wrap New Component for ReactFlow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Higher-order component that wraps a new window component (expecting WindowComponentProps)
 * and makes it compatible with ReactFlow's nodeTypes registry.
 *
 * This is the inverse of withWindowAdapter - used when you have a new-style
 * component but need to render it in the ReactFlow canvas during migration.
 *
 * Usage:
 * ```tsx
 * const ReactFlowChatWindow = withNodePropsAdapter(NewChatWindow);
 * // Now ReactFlowChatWindow accepts NodeProps
 * ```
 */
export function withNodePropsAdapter(
  NewComponent: ComponentType<WindowComponentProps>
): ComponentType<LegacyNodeProps> {
  function AdaptedComponent(props: LegacyNodeProps) {
    // Get store actions
    const removeWindow = useDesktopStore((s) => s.removeWindow);
    const updateWindowData = useDesktopStore((s) => s.updateWindowData);
    const focusWindow = useDesktopStore((s) => s.focusWindow);

    // Convert NodeProps to WindowInstance
    const window = nodePropsToWindow(props);

    // Create callbacks
    const handleClose = useCallback(() => {
      removeWindow(window.id);
    }, [window.id]);

    const handleMinimize = useCallback(() => {
      // Legacy ReactFlow doesn't have minimize concept
      // This will work properly after full migration
    }, []);

    const handleMaximize = useCallback(() => {
      updateWindowData(window.id, { viewMode: "maximized" });
    }, [window.id, updateWindowData]);

    const handleRestore = useCallback(() => {
      updateWindowData(window.id, { viewMode: "full" });
    }, [window.id, updateWindowData]);

    const handleFocus = useCallback(() => {
      focusWindow(window.id);
    }, [window.id]);

    const handleBlur = useCallback(() => {
      // No-op in ReactFlow mode
    }, []);

    const handleDragStart = useCallback((_e: React.MouseEvent) => {
      // ReactFlow handles drag
    }, []);

    const handleDragEnd = useCallback((_e: React.MouseEvent) => {
      // ReactFlow handles drag
    }, []);

    const handleResizeStart = useCallback(
      (_e: React.MouseEvent, _direction: ResizeDirection) => {
        // ReactFlow handles resize
      },
      []
    );

    const handleResizeEnd = useCallback((_e: React.MouseEvent) => {
      // ReactFlow handles resize
    }, []);

    const handleDataChange = useCallback(
      (data: Partial<WindowData>) => {
        // Cast to handle type differences during migration
        updateWindowData(window.id, data as Record<string, unknown>);
      },
      [window.id, updateWindowData]
    );

    const windowProps: WindowComponentProps = {
      window,
      onClose: handleClose,
      onMinimize: handleMinimize,
      onMaximize: handleMaximize,
      onRestore: handleRestore,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onResizeStart: handleResizeStart,
      onResizeEnd: handleResizeEnd,
      onDataChange: handleDataChange,
    };

    return <NewComponent {...windowProps} />;
  }

  AdaptedComponent.displayName = `withNodePropsAdapter(${NewComponent.displayName ?? NewComponent.name ?? "Component"})`;

  return AdaptedComponent;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Create Window Props from Store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to create WindowComponentProps from a window ID
 * Connects to the desktop store and provides all necessary callbacks
 */
export function useWindowProps(windowId: string): WindowComponentProps | null {
  const window = useDesktopStore((s) =>
    s.windows.find((w) => w.id === windowId)
  );
  const removeWindow = useDesktopStore((s) => s.removeWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);
  const blurWindow = useDesktopStore((s) => s.blurWindow);
  const minimizeWindow = useDesktopStore((s) => s.minimizeWindow);
  const maximizeWindow = useDesktopStore((s) => s.maximizeWindow);
  const restoreWindow = useDesktopStore((s) => s.restoreWindow);
  const moveWindow = useDesktopStore((s) => s.moveWindow);
  const setBounds = useDesktopStore((s) => s.setBounds);
  const desktopArea = useDesktopStore((s) => s.desktopArea);
  const showTilePreview = useDesktopStore((s) => s.showTilePreview);
  const hideTilePreview = useDesktopStore((s) => s.hideTilePreview);
  const tileWindow = useDesktopStore((s) => s.tileWindow);
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);

  const handleClose = useCallback(() => {
    removeWindow(windowId);
  }, [windowId, removeWindow]);

  const handleMinimize = useCallback(() => {
    minimizeWindow(windowId);
  }, [minimizeWindow, windowId]);

  const handleMaximize = useCallback(() => {
    maximizeWindow(windowId);
  }, [maximizeWindow, windowId]);

  const handleRestore = useCallback(() => {
    restoreWindow(windowId);
  }, [restoreWindow, windowId]);

  const handleFocus = useCallback(() => {
    focusWindow(windowId);
  }, [windowId, focusWindow]);

  const handleBlur = useCallback(() => {
    blurWindow(windowId);
  }, [blurWindow, windowId]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) {
        return;
      }
      e.preventDefault();
      handleFocus();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentBounds = window?.bounds ?? {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = currentBounds.x + (moveEvent.clientX - startX);
        const newY = currentBounds.y + (moveEvent.clientY - startY);

        const { x: minX, y: minY, width: maxX, height: maxY } = desktopArea;

        moveWindow(windowId, {
          x: Math.max(minX, Math.min(newX, minX + maxX - currentBounds.width)),
          y: Math.max(minY, Math.min(newY, minY + maxY - currentBounds.height)),
        });

        const zone = detectZoneFromPosition(
          moveEvent.clientX,
          moveEvent.clientY,
          desktopArea
        );
        if (zone) {
          showTilePreview(zone);
        } else {
          hideTilePreview();
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        hideTilePreview();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        const zone = detectZoneFromPosition(
          upEvent.clientX,
          upEvent.clientY,
          desktopArea
        );
        if (zone) {
          tileWindow(windowId, zone);
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      desktopArea,
      handleFocus,
      hideTilePreview,
      moveWindow,
      showTilePreview,
      tileWindow,
      window,
      windowId,
    ]
  );

  const handleDragEnd = useCallback((_e: React.MouseEvent) => {
    // Drag teardown is handled by the document mouseup listener.
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      e.preventDefault();
      handleFocus();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentBounds = window?.bounds ?? {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const { x: minX, y: minY, width: maxX, height: maxY } = desktopArea;
        const minW = window?.minSize.width ?? 200;
        const minH = window?.minSize.height ?? 150;
        const maxW = window?.maxSize?.width ?? Number.POSITIVE_INFINITY;
        const maxH = window?.maxSize?.height ?? Number.POSITIVE_INFINITY;

        const newBounds = { ...currentBounds };

        switch (direction) {
          case "n": {
            newBounds.y = currentBounds.y + deltaY;
            newBounds.height = currentBounds.height - deltaY;
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.y =
              currentBounds.y + currentBounds.height - newBounds.height;
            newBounds.y = Math.max(
              minY,
              Math.min(newBounds.y, minY + maxY - newBounds.height)
            );
            break;
          }
          case "s": {
            newBounds.height = currentBounds.height + deltaY;
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.height = Math.min(
              newBounds.height,
              minY + maxY - currentBounds.y
            );
            break;
          }
          case "e": {
            newBounds.width = currentBounds.width + deltaX;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.width = Math.min(
              newBounds.width,
              minX + maxX - currentBounds.x
            );
            break;
          }
          case "w": {
            newBounds.x = currentBounds.x + deltaX;
            newBounds.width = currentBounds.width - deltaX;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.x =
              currentBounds.x + currentBounds.width - newBounds.width;
            newBounds.x = Math.max(
              minX,
              Math.min(newBounds.x, minX + maxX - newBounds.width)
            );
            break;
          }
          case "ne": {
            newBounds.y = currentBounds.y + deltaY;
            newBounds.height = currentBounds.height - deltaY;
            newBounds.width = currentBounds.width + deltaX;
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.y =
              currentBounds.y + currentBounds.height - newBounds.height;
            newBounds.y = Math.max(
              minY,
              Math.min(newBounds.y, minY + maxY - newBounds.height)
            );
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.width = Math.min(
              newBounds.width,
              minX + maxX - currentBounds.x
            );
            break;
          }
          case "nw": {
            newBounds.x = currentBounds.x + deltaX;
            newBounds.y = currentBounds.y + deltaY;
            newBounds.width = currentBounds.width - deltaX;
            newBounds.height = currentBounds.height - deltaY;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.x =
              currentBounds.x + currentBounds.width - newBounds.width;
            newBounds.x = Math.max(
              minX,
              Math.min(newBounds.x, minX + maxX - newBounds.width)
            );
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.y =
              currentBounds.y + currentBounds.height - newBounds.height;
            newBounds.y = Math.max(
              minY,
              Math.min(newBounds.y, minY + maxY - newBounds.height)
            );
            break;
          }
          case "se": {
            newBounds.width = currentBounds.width + deltaX;
            newBounds.height = currentBounds.height + deltaY;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.width = Math.min(
              newBounds.width,
              minX + maxX - currentBounds.x
            );
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.height = Math.min(
              newBounds.height,
              minY + maxY - currentBounds.y
            );
            break;
          }
          case "sw": {
            newBounds.x = currentBounds.x + deltaX;
            newBounds.width = currentBounds.width - deltaX;
            newBounds.height = currentBounds.height + deltaY;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.x =
              currentBounds.x + currentBounds.width - newBounds.width;
            newBounds.x = Math.max(
              minX,
              Math.min(newBounds.x, minX + maxX - newBounds.width)
            );
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.height = Math.min(
              newBounds.height,
              minY + maxY - currentBounds.y
            );
            break;
          }
        }

        setBounds(windowId, newBounds);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [desktopArea, handleFocus, setBounds, window, windowId]
  );

  const handleResizeEnd = useCallback((_e: React.MouseEvent) => {
    // Resize teardown is handled by the document mouseup listener.
  }, []);

  const handleDataChange = useCallback(
    (data: Partial<WindowData>) => {
      // Cast to handle type differences during migration
      updateWindowData(windowId, data as Record<string, unknown>);
    },
    [windowId, updateWindowData]
  );

  if (!window) {
    return null;
  }

  // Type assertion needed because current store uses old WindowInstance type
  // This will be unnecessary after store migration is complete
  const typedWindow =
    window as unknown as import("@/store/desktop/types.new").WindowInstance;

  return {
    window: typedWindow,
    onClose: handleClose,
    onMinimize: handleMinimize,
    onMaximize: handleMaximize,
    onRestore: handleRestore,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onResizeStart: handleResizeStart,
    onResizeEnd: handleResizeEnd,
    onDataChange: handleDataChange,
  };
}

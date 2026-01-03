/**
 * Window Adapter - Bridge between ReactFlow NodeProps and WindowComponentProps
 *
 * This adapter enables gradual migration from ReactFlow-based windows to
 * traditional DOM-based windows. It wraps legacy window components that
 * expect NodeProps and provides them with the new WindowComponentProps interface.
 *
 * @see docs/execplans/desktop-type-migration.md Section 6.1
 */

"use client";

import { type ComponentType, useCallback } from "react";
import { useDesktopStore } from "@/store/desktop";
import type { WindowData, WindowInstance } from "@/store/desktop/types.new";
import type {
  LegacyNodeProps,
  ResizeDirection,
  WindowComponentProps,
} from "./types";

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
    isConnectable: false, // Windows don't use ReactFlow connections
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
    const updateWindow = useDesktopStore((s) => s.updateWindow);
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
      updateWindow(window.id, { viewMode: "maximized" });
    }, [window.id]);

    const handleRestore = useCallback(() => {
      updateWindow(window.id, { viewMode: "full" });
    }, [window.id]);

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
        updateWindow(window.id, data as Record<string, unknown>);
      },
      [window.id]
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
  const updateWindow = useDesktopStore((s) => s.updateWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);

  const handleClose = useCallback(() => {
    removeWindow(windowId);
  }, [windowId, removeWindow]);

  const handleMinimize = useCallback(() => {
    // Will be implemented in Phase 1
  }, []);

  const handleMaximize = useCallback(() => {
    updateWindow(windowId, { viewMode: "maximized" });
  }, [windowId, updateWindow]);

  const handleRestore = useCallback(() => {
    updateWindow(windowId, { viewMode: "full" });
  }, [windowId, updateWindow]);

  const handleFocus = useCallback(() => {
    focusWindow(windowId);
  }, [windowId, focusWindow]);

  const handleBlur = useCallback(() => {
    // Will be implemented when focus management is complete
  }, []);

  const handleDragStart = useCallback((_e: React.MouseEvent) => {
    // Will be implemented in Phase 1
  }, []);

  const handleDragEnd = useCallback((_e: React.MouseEvent) => {
    // Will be implemented in Phase 1
  }, []);

  const handleResizeStart = useCallback(
    (_e: React.MouseEvent, _direction: ResizeDirection) => {
      // Will be implemented in Phase 1
    },
    []
  );

  const handleResizeEnd = useCallback((_e: React.MouseEvent) => {
    // Will be implemented in Phase 1
  }, []);

  const handleDataChange = useCallback(
    (data: Partial<WindowData>) => {
      // Cast to handle type differences during migration
      updateWindow(windowId, data as Record<string, unknown>);
    },
    [windowId, updateWindow]
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

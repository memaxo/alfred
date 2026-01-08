import { useEffect, useRef } from "react";
import {
  type ResourceType,
  useDesktopStore,
  type WindowType,
} from "@/store/desktop";

export type DesktopSearchParams = {
  windowId?: string;
  spawn?: WindowType;
  resourceType?: ResourceType;
  resourceId?: string;
  ragDoc?: string;
};

const VALID_WINDOW_TYPES: WindowType[] = [
  "chat",
  "terminal",
  "droid",
  "note",
  "reminder",
  "todo",
  "workflow",
  "workflowlist",
  "settings",
  "integrations",
  "knowledge",
  "concept",
  "code",
  "agents",
  "taskmanager",
  "docker",
  "pr-review",
  "agentfs",
  "files",
  "cortex",
  "learning",
  "policy",
  "tune",
  "plan",
  "metrics",
  "rag",
  "linear",
  "notes",
  "reminders",
  "todos",
];

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "note",
  "reminder",
  "thread",
  "workflow_run",
  "preference",
  "integration",
  "knowledge",
  "concept",
];

function isValidWindowType(type: string): type is WindowType {
  return VALID_WINDOW_TYPES.includes(type as WindowType);
}

function isValidResourceType(type: string): type is ResourceType {
  return VALID_RESOURCE_TYPES.includes(type as ResourceType);
}

export function useDesktopDeeplinks(params: DesktopSearchParams) {
  const windows = useDesktopStore((s) => s.windows);
  const focusWindow = useDesktopStore((s) => s.focusWindow);
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  // Track if we've already processed the params
  const processedRef = useRef<string | null>(null);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    // Skip if already processed these exact params
    if (processedRef.current === paramsKey) {
      return;
    }
    processedRef.current = paramsKey;

    // Handle ?windowId - focus existing window
    if (params.windowId) {
      const existingWindow = windows.find((w) => w.id === params.windowId);
      if (existingWindow) {
        focusWindow(params.windowId);
        return;
      }
    }

    // Handle ?spawn - spawn new window of type
    if (params.spawn && isValidWindowType(params.spawn)) {
      // If resourceType and resourceId provided, create with resourceRef
      if (
        params.resourceType &&
        params.resourceId &&
        isValidResourceType(params.resourceType)
      ) {
        const windowId = spawnWindow(params.spawn, {
          type: params.resourceType,
          id: params.resourceId,
        });
        focusWindow(windowId);
      } else {
        const windowId = spawnWindow(params.spawn);
        focusWindow(windowId);
      }
      return;
    }

    // Handle ?resourceType + ?resourceId - find or spawn window for resource
    if (
      params.resourceType &&
      params.resourceId &&
      isValidResourceType(params.resourceType)
    ) {
      // Look for existing window with this resource
      const existingWindow = windows.find(
        (w) =>
          w.data?.resourceRef?.type === params.resourceType &&
          w.data?.resourceRef?.id === params.resourceId
      );

      if (existingWindow) {
        focusWindow(existingWindow.id);
      } else {
        // Map resource type to window type
        const windowType = resourceTypeToWindowType(params.resourceType);
        if (windowType) {
          const windowId = spawnWindow(windowType, {
            type: params.resourceType,
            id: params.resourceId,
          });
          focusWindow(windowId);
        }
      }
    }
  }, [paramsKey, windows, focusWindow, spawnWindow, params]);
}

function resourceTypeToWindowType(
  resourceType: ResourceType
): WindowType | null {
  const mapping: Partial<Record<ResourceType, WindowType>> = {
    note: "note",
    reminder: "reminder",
    thread: "chat",
    workflow_run: "workflow",
    preference: "settings",
    integration: "integrations",
    knowledge: "knowledge",
    concept: "concept",
  };
  return mapping[resourceType] ?? null;
}

/**
 * Generate a deep link URL for a window or resource
 */
export function createDesktopDeeplink(
  base: string,
  options: {
    windowId?: string;
    spawn?: WindowType;
    resourceType?: ResourceType;
    resourceId?: string;
  }
): string {
  const url = new URL(base);

  if (options.windowId) {
    url.searchParams.set("windowId", options.windowId);
  }
  if (options.spawn) {
    url.searchParams.set("spawn", options.spawn);
  }
  if (options.resourceType) {
    url.searchParams.set("resourceType", options.resourceType);
  }
  if (options.resourceId) {
    url.searchParams.set("resourceId", options.resourceId);
  }

  return url.toString();
}

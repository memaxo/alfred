/**
 * Hook for syncing Mindscape layouts to database
 * 
 * Integrates with Zustand store to automatically sync position changes
 */

import { useEffect, useRef, useState } from "react";
import { useStore } from "@xyflow/react";
import { layoutSyncService } from "@/lib/mindscape/layout-sync";
import type { Node } from "@xyflow/react";
import type { ArtifactData } from "@/store/mindscape";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

/**
 * Hook to sync node positions to database
 * 
 * Monitors React Flow node changes and queues updates for background sync
 */
export function useLayoutSync() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const nodes = useStore((state) => state.nodeInternals);
  const prevNodesRef = useRef<Map<string, Node<ArtifactData>>>(new Map());
  const isInitializedRef = useRef(false);
  
  // Get tRPC mutations
  const setPreferenceMutation = trpc.user.setPreference.useMutation();
  const getPreferencesQuery = trpc.user.getPreferences.useQuery(undefined, {
    enabled: !!userId,
  });

  // Initialize sync service on mount
  useEffect(() => {
    if (!userId || isInitializedRef.current || !getPreferencesQuery.data) {
      return;
    }

    layoutSyncService.init(userId, {
      setPreference: async (input) => {
        await setPreferenceMutation.mutateAsync(input);
      },
      getPreferences: async () => {
        return getPreferencesQuery.data ?? [];
      },
    });
    isInitializedRef.current = true;

    return () => {
      // Force sync on unmount (e.g., page navigation)
      layoutSyncService.forceSync().catch(() => {
        // Ignore errors during cleanup
      });
    };
  }, [userId, setPreferenceMutation, getPreferencesQuery.data]);

  // Monitor node position changes
  useEffect(() => {
    if (!userId || !isInitializedRef.current) {
      return;
    }

    const currentNodes = new Map(nodes);
    const prevNodes = prevNodesRef.current;

    // Detect position changes
    for (const [id, node] of currentNodes) {
      const prevNode = prevNodes.get(id);
      
      if (!prevNode) {
        // New node - queue initial position
        layoutSyncService.queueUpdate(id, node.position);
      } else if (
        prevNode.position.x !== node.position.x ||
        prevNode.position.y !== node.position.y
      ) {
        // Position changed - queue update
        layoutSyncService.queueUpdate(id, node.position);
      }
    }

    // Detect removed nodes (they'll be cleaned up on next sync)
    for (const [id] of prevNodes) {
      if (!currentNodes.has(id)) {
        // Node removed - will be handled by full layout sync
      }
    }

    prevNodesRef.current = currentNodes;
  }, [nodes, userId, setPreferenceMutation]);

  // Handle page visibility (sync when tab becomes hidden)
  useEffect(() => {
    if (!userId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - force sync before backgrounding
        layoutSyncService.forceSync().catch(() => {
          // Ignore errors
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId]);

  // Handle page unload (sync before closing)
  useEffect(() => {
    if (!userId) {
      return;
    }

    const handleBeforeUnload = () => {
      // Synchronous sync attempt (may not complete, but tries)
      layoutSyncService.forceSync().catch(() => {
        // Ignore errors
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userId]);
}

/**
 * Hook to load saved layout from database
 * 
 * Returns saved node positions for hydration
 */
export function useSavedLayout() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const getPreferencesQuery = trpc.user.getPreferences.useQuery(undefined, {
    enabled: !!userId,
  });
  const [savedLayout, setSavedLayout] = useState<
    Array<{ id: string; position: { x: number; y: number } }> | null
  >(null);

  useEffect(() => {
    if (!userId || !getPreferencesQuery.data) {
      return;
    }

    const layoutPref = getPreferencesQuery.data.find(
      (p) => p.key === "mindscape:layout"
    );
    if (layoutPref?.value && typeof layoutPref.value === "object") {
      const snapshot = layoutPref.value as {
        nodes: Array<{ id: string; position: { x: number; y: number } }>;
      };
      setSavedLayout(snapshot.nodes);
    }
  }, [userId, getPreferencesQuery.data]);

  return savedLayout;
}

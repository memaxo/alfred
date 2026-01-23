import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function ProjectWindow({ window }: WindowComponentProps) {
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const utils = trpc.useUtils();

  const selectedId = asString(
    (window.data as Record<string, unknown>).projectId
  );

  const listQuery = trpc.project.list.useQuery();
  const getQuery = trpc.project.get.useQuery(
    { id: selectedId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: selectedId !== null }
  );

  const archive = trpc.project.archive.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      if (selectedId) {
        await utils.project.get.invalidate({ id: selectedId });
      }
    },
  });
  const unarchive = trpc.project.unarchive.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      if (selectedId) {
        await utils.project.get.invalidate({ id: selectedId });
      }
    },
  });

  const projects = useMemo(
    () => (listQuery.data as any[]) ?? [],
    [listQuery.data]
  );
  const selected = getQuery.data as any;
  const isArchived = Boolean(selected?.archivedAt);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Projects</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Projects detected by ALFRED (and optionally linked to Linear).
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">List</Text>
        {listQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : projects.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No projects yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {projects.slice(0, 50).map((p: any) => {
              const id = String(p.id ?? "");
              const label = String(p.name ?? p.label ?? id);
              const archived = Boolean(p.archivedAt);
              return (
                <TouchableOpacity
                  className={[
                    "rounded-md border p-3",
                    selectedId === id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  ].join(" ")}
                  key={id}
                  onPress={() =>
                    updateWindowData(window.id, {
                      projectId: id,
                      label,
                    })
                  }
                >
                  <Text className="font-medium text-foreground text-sm">
                    {label}
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    {archived ? "archived" : "active"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Details</Text>
        {selectedId === null ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select a project above.
          </Text>
        ) : getQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : getQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {getQuery.error.message}
          </Text>
        ) : (
          <View className="mt-2">
            <Text className="text-foreground text-sm">
              {String(selected?.name ?? selected?.label ?? selectedId)}
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              id: {selectedId}
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              status: {isArchived ? "archived" : "active"}
            </Text>

            <View className="mt-3 flex-row gap-2">
              {isArchived ? (
                <TouchableOpacity
                  className="rounded-md bg-secondary px-3 py-2"
                  disabled={unarchive.isPending}
                  onPress={() => unarchive.mutate({ id: selectedId })}
                >
                  <Text className="text-secondary-foreground text-xs">
                    Unarchive
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="rounded-md bg-destructive/10 px-3 py-2"
                  disabled={archive.isPending}
                  onPress={() =>
                    Alert.alert("Archive project", "Archive this project?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Archive",
                        style: "destructive",
                        onPress: () =>
                          archive.mutate({ id: selectedId, reason: "user" }),
                      },
                    ])
                  }
                >
                  <Text className="text-destructive text-xs">Archive</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="rounded-md bg-secondary px-3 py-2"
                disabled={listQuery.isFetching || getQuery.isFetching}
                onPress={() => {
                  void listQuery.refetch();
                  void getQuery.refetch();
                }}
              >
                <Text className="text-secondary-foreground text-xs">
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

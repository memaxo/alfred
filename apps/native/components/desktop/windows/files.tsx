import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

function joinPath(base: string, name: string): string {
  const b = base.trim() === "" ? "." : base.trim();
  if (b === ".") {
    return `./${name}`;
  }
  return `${b.replace(/\/+$/, "")}/${name}`;
}

function parentPath(path: string): string {
  const p = path.trim();
  if (p === "" || p === "." || p === "./") {
    return ".";
  }
  const normalized = p.replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) {
    return ".";
  }
  const parent = normalized.slice(0, idx);
  return parent.length === 0 ? "." : parent;
}

export function FilesWindow({ window: _window }: WindowComponentProps) {
  const [path, setPath] = useState(".");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const listQuery = trpc.fs.list.useQuery({ path, showHidden: false });
  const readQuery = trpc.fs.read.useQuery(
    { path: selectedFile ?? "" },
    { enabled: selectedFile !== null }
  );

  const files = useMemo(
    () => (listQuery.data as any)?.files ?? [],
    [listQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">Files</Text>
            <Text className="mt-1 text-muted-foreground text-xs">{path}</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="rounded-md bg-secondary px-3 py-2"
              onPress={() => setPath(parentPath(path))}
            >
              <Text className="text-secondary-foreground text-xs">Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-md bg-secondary px-3 py-2"
              disabled={listQuery.isFetching}
              onPress={() => void listQuery.refetch()}
            >
              <Text className="text-secondary-foreground text-xs">Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Browse</Text>
        {listQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : listQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {listQuery.error.message}
          </Text>
        ) : files.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Empty directory.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {files.slice(0, 60).map((f: any) => (
              <TouchableOpacity
                className="rounded-md border border-border bg-background p-3"
                key={String(f.path)}
                onPress={() => {
                  if (f.type === "folder") {
                    setSelectedFile(null);
                    setPath(joinPath(path, f.name));
                    return;
                  }
                  setSelectedFile(String(f.path));
                }}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(f.name)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(f.type)}
                  {typeof f.size === "number" ? ` • ${f.size}b` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Preview</Text>
        {selectedFile ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {selectedFile}
          </Text>
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">
            Tap a file to preview.
          </Text>
        )}

        {readQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : readQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {readQuery.error.message}
          </Text>
        ) : readQuery.data ? (
          <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
            {String((readQuery.data as any).content ?? "").slice(0, 6000)}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

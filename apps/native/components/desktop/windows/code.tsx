import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
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

export function CodeWindow({ window: _window }: WindowComponentProps) {
  const [path, setPath] = useState("apps");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openPath, setOpenPath] = useState("");

  const listQuery = trpc.fs.list.useQuery({ path, showHidden: false });
  const readQuery = trpc.fs.read.useQuery(
    { path: selectedFile ?? "" },
    { enabled: selectedFile !== null, retry: false }
  );

  const files = useMemo(
    () => (listQuery.data as any)?.files ?? [],
    [listQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Code</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Browse repo sources (read-only).
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["apps", "packages", "docs"] as const).map((p) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                p === path
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={p}
              onPress={() => {
                setSelectedFile(null);
                setPath(p);
              }}
            >
              <Text className="text-foreground text-xs">{p}</Text>
            </TouchableOpacity>
          ))}
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

        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            onChangeText={setOpenPath}
            placeholder="Open path (e.g. apps/native/app/_layout.tsx)"
            placeholderTextColor="#6b7280"
            value={openPath}
          />
          <TouchableOpacity
            className={[
              "rounded-md px-3 py-2",
              openPath.trim().length > 0 ? "bg-secondary" : "bg-muted",
            ].join(" ")}
            disabled={openPath.trim().length === 0}
            onPress={() => {
              setSelectedFile(openPath.trim());
              setOpenPath("");
            }}
          >
            <Text className="text-secondary-foreground text-xs">Open</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">{path}</Text>
        {listQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : (listQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {listQuery.error.message}
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
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Preview</Text>
        {selectedFile ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {selectedFile}
          </Text>
        ) : null}

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
            {String((readQuery.data as any).content ?? "").slice(0, 7000)}
          </Text>
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">
            Tap a file to preview.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

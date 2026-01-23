import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function LinearWindow({ window }: WindowComponentProps) {
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const selectedIssueId = asString(
    (window.data as Record<string, unknown>).issueId
  );

  const [teamId, setTeamId] = useState("");
  const [search, setSearch] = useState("");

  const auth = trpc.linear.getAuthorizeUrl.useMutation();
  const issuesQuery = trpc.linear.issuesList.useQuery(
    {
      teamId: teamId.trim().length > 0 ? teamId.trim() : undefined,
      limit: 50,
    },
    { retry: false }
  );
  const issueQuery = trpc.linear.issueGet.useQuery(
    { issueId: selectedIssueId ?? "missing" },
    { enabled: selectedIssueId !== null, retry: false }
  );

  const issues = useMemo(() => {
    const list = (issuesQuery.data as any)?.issues ?? [];
    const q = search.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((i: any) => {
      const title = String(i.title ?? "").toLowerCase();
      const ident = String(i.identifier ?? "").toLowerCase();
      return title.includes(q) || ident.includes(q);
    });
  }, [issuesQuery.data, search]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Linear</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Connect and browse issues.
        </Text>

        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-secondary px-3 py-2"
          disabled={auth.isPending}
          onPress={() =>
            auth.mutate(undefined, {
              onSuccess: (data) => {
                const url = (data as any)?.url;
                if (typeof url === "string" && url.length > 0) {
                  void Linking.openURL(url).catch(() => {});
                }
              },
            })
          }
        >
          {auth.isPending ? (
            <ActivityIndicator color="#3b82f6" size="small" />
          ) : (
            <Text className="font-medium text-secondary-foreground text-sm">
              Connect Linear
            </Text>
          )}
        </TouchableOpacity>
        {auth.data && (auth.data as any).url ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {(auth.data as any).url}
          </Text>
        ) : null}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Filters</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setTeamId}
          placeholder="Team id (optional)…"
          placeholderTextColor="#6b7280"
          value={teamId}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setSearch}
          placeholder="Search issues…"
          placeholderTextColor="#6b7280"
          value={search}
        />
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Issues</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={issuesQuery.isFetching}
            onPress={() => void issuesQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>

        {issuesQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : issuesQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {issuesQuery.error.message}
          </Text>
        ) : issues.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">No issues.</Text>
        ) : (
          <View className="mt-3 gap-2">
            {issues.slice(0, 30).map((i: any) => (
              <TouchableOpacity
                className={[
                  "rounded-md border p-3",
                  selectedIssueId === i.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background",
                ].join(" ")}
                key={String(i.id)}
                onPress={() =>
                  updateWindowData(window.id, {
                    issueId: i.id,
                    label: i.identifier ?? "Linear",
                  })
                }
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(i.identifier ?? "ISSUE")} — {String(i.title ?? "")}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(i.state?.name ?? "unknown")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Issue</Text>
        {selectedIssueId === null ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select an issue above.
          </Text>
        ) : issueQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : issueQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {issueQuery.error.message}
          </Text>
        ) : (
          <View className="mt-2">
            <Text className="text-foreground text-sm">
              {String((issueQuery.data as any)?.issue?.identifier ?? "")}{" "}
              {String((issueQuery.data as any)?.issue?.title ?? "")}
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              {String((issueQuery.data as any)?.issue?.state?.name ?? "")}
            </Text>
            <Text
              className="mt-2 text-muted-foreground text-xs"
              numberOfLines={8}
            >
              {String((issueQuery.data as any)?.issue?.description ?? "")}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

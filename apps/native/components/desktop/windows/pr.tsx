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

import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function PrReviewWindow({ window: _window }: WindowComponentProps) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const [selected, setSelected] = useState<number | null>(null);

  const listQuery = trpc.github.pullRequestsList.useQuery({
    owner: owner.trim().length > 0 ? owner.trim() : undefined,
    repo: repo.trim().length > 0 ? repo.trim() : undefined,
    state,
    limit: 30,
  });

  const prQuery = trpc.github.pullRequestGet.useQuery(
    {
      owner: owner.trim().length > 0 ? owner.trim() : undefined,
      repo: repo.trim().length > 0 ? repo.trim() : undefined,
      number: selected ?? 1,
    },
    { enabled: selected !== null, retry: false }
  );
  const diffQuery = trpc.github.pullRequestDiff.useQuery(
    {
      owner: owner.trim().length > 0 ? owner.trim() : undefined,
      repo: repo.trim().length > 0 ? repo.trim() : undefined,
      number: selected ?? 1,
    },
    { enabled: selected !== null, retry: false }
  );

  const prs = useMemo(
    () => (listQuery.data as any)?.pullRequests ?? [],
    [listQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">PR Review</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          List PRs via `gh` on the server and inspect diff.
        </Text>
        <View className="mt-3 flex-row gap-2">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            onChangeText={setOwner}
            placeholder="owner (optional)"
            placeholderTextColor="#6b7280"
            value={owner}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            onChangeText={setRepo}
            placeholder="repo (optional)"
            placeholderTextColor="#6b7280"
            value={repo}
          />
        </View>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["open", "closed", "all"] as const).map((s) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                s === state
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={s}
              onPress={() => {
                setSelected(null);
                setState(s);
              }}
            >
              <Text className="text-foreground text-xs">{s}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={listQuery.isFetching}
            onPress={() => void listQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">
          Pull requests
        </Text>
        {listQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : listQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {listQuery.error.message}
          </Text>
        ) : prs.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">No PRs.</Text>
        ) : (
          <View className="mt-3 gap-2">
            {prs.slice(0, 30).map((p: any) => (
              <TouchableOpacity
                className={[
                  "rounded-md border p-3",
                  selected === p.number
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background",
                ].join(" ")}
                key={String(p.id)}
                onPress={() => setSelected(p.number)}
              >
                <Text className="font-medium text-foreground text-sm">
                  #{String(p.number)} {String(p.title)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(p.status)} • {String(p.reviewStatus)} •{" "}
                  {String(p.ciStatus)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(p.author)} • +{String(p.additions)} -
                  {String(p.deletions)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Details</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={selected === null}
            onPress={() => {
              void prQuery.refetch();
              void diffQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>

        {selected === null ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select a PR above.
          </Text>
        ) : prQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : prQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {prQuery.error.message}
          </Text>
        ) : prQuery.data ? (
          <>
            <Text className="mt-2 font-medium text-foreground text-sm">
              #{String((prQuery.data as any).number)}{" "}
              {String((prQuery.data as any).title)}
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              {String((prQuery.data as any).url ?? "")}
            </Text>
            <TouchableOpacity
              className="mt-2 self-start rounded-md bg-secondary px-3 py-2"
              onPress={() => {
                const { url } = prQuery.data as any;
                if (typeof url === "string" && url.length > 0) {
                  void Linking.openURL(url).catch(() => {});
                }
              }}
            >
              <Text className="text-secondary-foreground text-xs">Open</Text>
            </TouchableOpacity>
            <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
              {String((prQuery.data as any).body ?? "").slice(0, 1200)}
            </Text>
          </>
        ) : null}

        {selected !== null ? (
          <>
            <Text className="mt-4 font-medium text-foreground text-sm">
              Diff
            </Text>
            {diffQuery.isLoading ? (
              <View className="py-4">
                <ActivityIndicator color="#00D9FF" />
              </View>
            ) : diffQuery.error ? (
              <Text className="mt-2 text-destructive text-xs">
                {diffQuery.error.message}
              </Text>
            ) : diffQuery.data ? (
              <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
                {String((diffQuery.data as any).diff ?? "").slice(0, 4000)}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

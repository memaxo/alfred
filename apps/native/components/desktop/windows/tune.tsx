import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function TuneWindow(_props: WindowComponentProps) {
  const utils = trpc.useUtils();
  const datasetsQuery = trpc.tune.datasetsList.useQuery();
  const [selected, setSelected] = useState<string[]>([]);
  const evalQuery = trpc.tune.evalCompare.useQuery({
    modelIds: selected.length > 0 ? selected : undefined,
  });
  const jobsQuery = trpc.tune.jobsList.useQuery({ limit: 50 });
  const cancel = trpc.tune.jobsCancel.useMutation({
    onSuccess: async () => {
      await utils.tune.jobsList.invalidate();
    },
  });

  const datasets = useMemo(
    () => (datasetsQuery.data as any)?.datasets ?? [],
    [datasetsQuery.data]
  );
  const models = useMemo(
    () => (evalQuery.data as any)?.models ?? [],
    [evalQuery.data]
  );
  const jobs = useMemo(
    () => (jobsQuery.data as any)?.jobs ?? [],
    [jobsQuery.data]
  );

  const toggleModel = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id)
    );
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Tune</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Datasets, evaluations, and fine-tune jobs.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Datasets</Text>
        {datasetsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : (
          <View className="mt-3 gap-2">
            {datasets.slice(0, 10).map((d: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(d.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(d.name)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(d.samples)} samples • {String(d.size)} •{" "}
                  {String(d.format)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(d.description)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">
            Evaluations
          </Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={evalQuery.isFetching}
            onPress={() => void evalQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {evalQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : evalQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {evalQuery.error.message}
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {models.map((m: any) => {
              const id = String(m.id);
              const isSelected = selected.includes(id);
              return (
                <TouchableOpacity
                  className={[
                    "rounded-md border p-3",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  ].join(" ")}
                  key={id}
                  onPress={() => toggleModel(id)}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {String(m.name)} ({String(m.version)})
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    acc: {String(m.accuracy)} • latency: {String(m.latency)}ms •
                    tps: {String(m.tokensPerSec)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Jobs</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={jobsQuery.isFetching}
            onPress={() => void jobsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {jobsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : jobsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {jobsQuery.error.message}
          </Text>
        ) : jobs.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No jobs yet (start jobs from server/CLI).
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {jobs.slice(0, 10).map((j: any) => {
              const id = String(j.id);
              const status = String(j.status);
              const canCancel = status === "running" || status === "pending";
              return (
                <View
                  className="rounded-md border border-border bg-background p-3"
                  key={id}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {String(j.name)}
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    {status} • {String(j.createdAt)}
                  </Text>
                  <TouchableOpacity
                    className="mt-2 self-start rounded-md bg-destructive/10 px-3 py-2"
                    disabled={!canCancel || cancel.isPending}
                    onPress={() =>
                      Alert.alert("Cancel job", "Cancel this job?", [
                        { text: "Keep", style: "cancel" },
                        {
                          text: "Cancel",
                          style: "destructive",
                          onPress: () => cancel.mutate({ jobId: id }),
                        },
                      ])
                    }
                  >
                    <Text className="text-destructive text-xs">Cancel</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

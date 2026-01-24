import React, { Suspense, lazy } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";

import type { ChartProps } from "./Chart";

const Chart = lazy(() => import("./Chart").then((m) => ({ default: m.Chart })));

function ChartFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color="#00D9FF" />
    </View>
  );
}

export function LazyChart(props: ChartProps) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <Chart {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
});

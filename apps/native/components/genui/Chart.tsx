import { Circle } from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import {
  CartesianChart,
  Line,
  Bar,
  Area,
  type PointsArray,
} from "victory-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

export interface AxisConfig {
  label?: string;
  tickFormat?: (value: number | string) => string;
  tickCount?: number;
}

export interface ChartProps {
  type: "line" | "bar" | "area";
  data: ChartDataPoint[];
  title?: string;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  width?: number;
  height?: number;
  showGrid?: boolean;
  animate?: boolean;
}

export function Chart({
  type,
  data,
  title,
  width,
  height = 200,
  animate = true,
}: ChartProps) {
  const theme = useVoidTheme();
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = width ?? screenWidth - 48;

  // Transform data for victory-native-xl format
  const chartData = data.map((point, index) => ({
    x: typeof point.x === "number" ? point.x : index,
    y: point.y,
  }));

  return (
    <View style={styles.container}>
      {title && (
        <BiolumText
          variant="title"
          size="small"
          color="bright"
          style={styles.title}
        >
          {title}
        </BiolumText>
      )}
      <View style={{ width: chartWidth, height }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={["y"]}
          domainPadding={{ left: 20, right: 20, top: 20, bottom: 0 }}
          axisOptions={{
            lineColor: theme.colors.biolum.faint,
            labelColor: theme.colors.biolum.dim,
          }}
        >
          {({ points, chartBounds }) => {
            const yPoints = points.y as PointsArray;
            switch (type) {
              case "line": {
                return (
                  <Line
                    points={yPoints}
                    color={theme.colors.biolum.bright}
                    strokeWidth={2}
                    animate={
                      animate ? { type: "timing", duration: 500 } : undefined
                    }
                  />
                );
              }
              case "bar": {
                return (
                  <Bar
                    points={yPoints}
                    chartBounds={chartBounds}
                    color="rgba(255, 255, 255, 0.15)"
                    animate={
                      animate ? { type: "timing", duration: 500 } : undefined
                    }
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                  />
                );
              }
              case "area": {
                return (
                  <Area
                    points={yPoints}
                    y0={chartBounds.bottom}
                    color={theme.colors.biolum.standard}
                    animate={
                      animate ? { type: "timing", duration: 500 } : undefined
                    }
                  />
                );
              }
              default: {
                return null;
              }
            }
          }}
        </CartesianChart>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});

export default Chart;

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  View,
} from "react-native";

import {
  BodyText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { HUDSurface } from "@/components/foundation/HUDSurface";

interface VariableInspectorProps {
  variables: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "[Circular]";
    }
  }
  return String(value);
}

function getValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (Array.isArray(value)) {
    return `array[${value.length}]`;
  }
  if (typeof value === "object") {
    return "object";
  }
  return typeof value;
}

function getTypeColor(type: string): string {
  switch (type) {
    case "string": {
      return "#00FF88";
    }
    case "number": {
      return "#00D9FF";
    }
    case "boolean": {
      return "#FFB800";
    }
    case "object":
    case "array": {
      return "#FF6B9D";
    }
    case "null":
    case "undefined": {
      return "#8B8B8B";
    }
    default: {
      return "#5A6B7D";
    }
  }
}

interface VariableRowProps {
  name: string;
  value: unknown;
}

function VariableRow({ name, value }: VariableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const type = getValueType(value);
  const typeColor = getTypeColor(type);
  const formattedValue = formatValue(value);
  const isComplex = typeof value === "object" && value !== null;

  const handleCopy = () => {
    Clipboard.setString(formattedValue);
    if (Platform.OS === "android") {
      ToastAndroid.show("Copied to clipboard", ToastAndroid.SHORT);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.nameContainer}>
          <CaptionText mono style={styles.name}>
            {name}
          </CaptionText>
          <View
            style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}
          >
            <CaptionText mono style={{ fontSize: 10, color: typeColor }}>
              {type}
            </CaptionText>
          </View>
        </View>
        <View style={styles.actions}>
          {isComplex && (
            <Pressable
              onPress={() => setExpanded(!expanded)}
              style={styles.actionButton}
            >
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color="#8B8B8B"
              />
            </Pressable>
          )}
          <Pressable onPress={handleCopy} style={styles.actionButton}>
            <Ionicons name="copy-outline" size={16} color="#8B8B8B" />
          </Pressable>
        </View>
      </View>

      <View style={styles.valueContainer}>
        <CaptionText
          mono
          numberOfLines={expanded ? undefined : 2}
          style={styles.value}
        >
          {formattedValue}
        </CaptionText>
      </View>
    </View>
  );
}

export function VariableInspector({ variables }: VariableInspectorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setCollapsed(!collapsed)} style={styles.header}>
        <View style={styles.headerLeft}>
          <TitleText size="small">Variables</TitleText>
          <View style={styles.countBadge}>
            <CaptionText mono style={styles.countText}>
              {entries.length}
            </CaptionText>
          </View>
        </View>
        <Ionicons
          name={collapsed ? "chevron-forward" : "chevron-down"}
          size={20}
          color="#8B8B8B"
        />
      </Pressable>

      {!collapsed && (
        <HUDSurface elevation={1} style={styles.surface}>
          <ScrollView
            style={styles.scrollView}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {entries.map(([name, value]) => (
              <VariableRow key={name} name={name} value={value} />
            ))}
          </ScrollView>
        </HUDSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    backgroundColor: "rgba(0, 217, 255, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    color: "#00D9FF",
    fontSize: 12,
  },
  surface: {
    maxHeight: 300,
  },
  scrollView: {
    padding: 12,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 10,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  name: {
    color: "#FFFFFF",
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  valueContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 4,
    padding: 8,
  },
  value: {
    color: "#B0B0B0",
    fontSize: 11,
  },
});

export default VariableInspector;

import React from "react";
import { View, StyleSheet } from "react-native";

import { BiolumText, MonoText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";
import { getGenUIComponent, isValidGenUIComponent } from "./registry";
import { getTransform } from "./transforms";

interface UIComponent {
  component: string;
  props?: Record<string, unknown>;
  children?: UIComponent[];
  key?: string;
}

interface DataUIPart {
  type: "data-ui";
  ui: UIComponent;
  data?: unknown;
}

export interface GenUIRendererProps {
  part: DataUIPart;
  fallbackToJson?: boolean;
}

export function GenUIRenderer({
  part,
  fallbackToJson = true,
}: GenUIRendererProps) {
  const { ui, data } = part;

  if (!ui || !ui.component) {
    if (fallbackToJson) {
      return <JsonFallback data={part} />;
    }
    return null;
  }

  return renderUIComponent(ui, data, fallbackToJson);
}

function renderUIComponent(
  ui: UIComponent,
  data: unknown,
  fallbackToJson: boolean
): React.ReactNode {
  const { component, props = {}, children, key } = ui;

  if (!isValidGenUIComponent(component)) {
    console.warn(`Unknown GenUI component: ${component}`);
    if (fallbackToJson) {
      return <JsonFallback data={{ component, props }} key={key} />;
    }
    return null;
  }

  const Component = getGenUIComponent(component);
  if (!Component) {
    return null;
  }

  // Handle children if present
  const renderedChildren = children?.map((child, index) =>
    renderUIComponent(child, data, fallbackToJson)
  );

  // Transform props using the component-specific transform
  const transform = getTransform(component);
  const transformedProps = transform(props) as
    | Record<string, unknown>
    | undefined;

  // Merge data into props if component expects it
  const mergedProps = {
    ...(transformedProps ?? {}),
    ...(data && typeof data === "object" ? { data } : {}),
  };

  try {
    return (
      <ErrorBoundary key={key} fallbackToJson={fallbackToJson}>
        <Component {...(mergedProps as any)}>{renderedChildren}</Component>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error(`Error rendering GenUI component ${component}:`, error);
    if (fallbackToJson) {
      return (
        <JsonFallback
          data={{ component, props, error: String(error) }}
          key={key}
        />
      );
    }
    return null;
  }
}

function JsonFallback({ data }: { data: unknown }) {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <HUDSurface elevation={1} style={styles.fallbackContainer}>
      <BiolumText
        variant="caption"
        size="small"
        color="faint"
        style={styles.fallbackLabel}
      >
        GenUI Component
      </BiolumText>
      <MonoText size="small" color="dim" numberOfLines={10} selectable>
        {jsonString}
      </MonoText>
    </HUDSurface>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackToJson: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("GenUI component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackToJson) {
        return (
          <JsonFallback
            data={{
              error: "Component render error",
              message: this.state.error?.message,
            }}
          />
        );
      }
      return null;
    }

    return this.props.children;
  }
}

export function renderGenUI(part: DataUIPart): React.ReactNode {
  return <GenUIRenderer part={part} />;
}

const styles = StyleSheet.create({
  fallbackContainer: {
    marginVertical: 8,
    padding: 12,
  },
  fallbackLabel: {
    marginBottom: 8,
  },
});

export default GenUIRenderer;

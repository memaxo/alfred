import React, { Component, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { VoidContainer } from "./foundation/VoidContainer";
import { ErrorPanel } from "./workflow/ErrorPanel";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.error("ScreenErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <VoidContainer gradient="ambient" style={styles.container}>
          <View style={styles.content}>
            <ErrorPanel
              title="Something went wrong"
              message={
                this.state.error?.message ?? "An unexpected error occurred"
              }
              stackTrace={this.state.errorInfo?.componentStack ?? undefined}
              onRetry={this.handleRetry}
              onDismiss={this.handleRetry}
            />
          </View>
        </VoidContainer>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier use with hooks
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ScreenErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ScreenErrorBoundary>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
});

export default ScreenErrorBoundary;

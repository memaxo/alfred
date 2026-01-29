"use client";

/**
 * Desktop Error Boundaries - Layered error handling for desktop components
 *
 * Provides specialized error boundaries for different desktop layers:
 * - ShellErrorBoundary: Top-level boundary for entire desktop
 * - LayerErrorBoundary: Per-layer isolation (mindscape, orb, etc.)
 *
 * @see docs/execplans/desktop-evolution-prd.md
 */

import { logger } from "@alfred/logger";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  layerName?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHELL ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Top-level error boundary for the entire desktop shell.
 * Provides a full-screen recovery UI when critical layers fail.
 */
export class ShellErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));

    logger.error("desktop_shell_crashed", {
      error,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.errorCount < 2;

      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-void p-8">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <h1 className="font-semibold text-xl">Desktop Error</h1>
          <p className="max-w-md text-center text-biolum-dim">
            The desktop encountered an unexpected error. This may be due to a
            temporary issue.
          </p>
          <p className="max-w-md truncate text-center text-red-400 text-sm">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <div className="flex gap-3">
            {canRetry && (
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button onClick={this.handleReload} variant="default">
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-layer error boundary for isolating failures in specific desktop layers.
 * Provides a compact recovery UI that doesn't disrupt the entire desktop.
 */
export class LayerErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));

    const layerName = this.props.layerName ?? "unknown";
    logger.error("desktop_layer_crashed", {
      layerName,
      error,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const layerName = this.props.layerName ?? "Component";
      const maxRetries = 3;
      const canRetry = this.state.errorCount < maxRetries;

      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
          <AlertTriangle className="h-6 w-6 text-red-500/70" />
          <p className="text-biolum-dim text-sm">{layerName} unavailable</p>
          {canRetry ? (
            <Button
              className="text-xs"
              onClick={this.handleRetry}
              size="sm"
              variant="ghost"
            >
              Retry ({maxRetries - this.state.errorCount} left)
            </Button>
          ) : (
            <p className="text-biolum-faint text-xs">Please refresh the page</p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

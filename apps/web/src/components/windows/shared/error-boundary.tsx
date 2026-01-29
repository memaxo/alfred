import { logger } from "@alfred/logger";
import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  windowId: string;
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class WindowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));

    logger.error("desktop_window_crashed", {
      windowId: this.props.windowId,
      error,
      componentStack: errorInfo.componentStack,
    });

    // Allow custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      const maxRetries = 3;
      const canRetry = this.state.errorCount < maxRetries;

      return (
        <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-red-400 text-sm">Window error</p>
          <p className="max-w-[200px] truncate text-center text-biolum-faint text-xs">
            {this.state.error?.message ?? "Unknown error"}
          </p>
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
            <p className="text-biolum-faint text-xs">
              Too many errors. Please refresh the page.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

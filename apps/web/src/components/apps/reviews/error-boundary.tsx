/**
 * Review-specific error boundary with retry functionality
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  title?: string;
  className?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ReviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center p-6 rounded-lg border border-destructive/20 bg-destructive/5",
            this.props.className
          )}
        >
          <AlertCircle className="w-8 h-8 text-destructive mb-3" />
          <h3 className="font-medium text-sm mb-1">
            {this.props.title ?? "Failed to load"}
          </h3>
          <p className="text-xs text-muted-foreground mb-3 text-center max-w-xs">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <Button size="sm" variant="outline" onClick={this.handleRetry}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inline error state for query failures (not component errors)
 */
export function QueryErrorState({
  error,
  onRetry,
  className,
}: {
  error: Error | null;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-lg border border-destructive/20 bg-destructive/5",
        className
      )}
    >
      <AlertCircle className="w-6 h-6 text-destructive mb-2" />
      <p className="text-xs text-muted-foreground mb-2 text-center">
        {error?.message ?? "Failed to load data"}
      </p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="w-3 h-3 mr-1" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Error Boundary Component
 *
 * Carmack-Karpathy principles:
 * - Fast failure: catch errors immediately
 * - Clear recovery: provide actionable errors
 * - Isolation: component tree isolation
 */

import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: unknown) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: unknown) {
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showDebug =
        import.meta.env.DEV || import.meta.env.VITE_TEST_MODE === "true";
      const stack =
        showDebug && this.state.error?.stack ? this.state.error.stack : null;

      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              {this.state.error?.message ?? "An unexpected error occurred"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
            {stack ? (
              <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                {stack}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

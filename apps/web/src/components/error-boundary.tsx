/**
 * Error Boundary Component
 * 
 * Carmack-Karpathy principles:
 * - Fast failure: catch errors immediately
 * - Clear recovery: provide actionable errors
 * - Isolation: component tree isolation
 */

import { Component, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  componentDidCatch(error: Error, errorInfo: unknown) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

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
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}


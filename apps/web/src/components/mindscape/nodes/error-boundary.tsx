import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MindscapeNode } from "./mindscape-node";

interface NodeErrorBoundaryProps {
  children: ReactNode;
  nodeId: string;
  onError?: (error: Error, errorInfo: unknown) => void;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for mindscape nodes.
 * Catches rendering errors and displays a fallback UI that matches the node design.
 */
export class NodeErrorBoundary extends Component<
  NodeErrorBoundaryProps,
  NodeErrorBoundaryState
> {
  constructor(props: NodeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): NodeErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    this.props.onError?.(error, errorInfo);
    // Log error for debugging
    console.error(`Node error (${this.props.nodeId}):`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <MindscapeNode
          id={this.props.nodeId}
          selected={false}
          title="Error"
        >
          <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="space-y-2">
              <p className="text-biolum text-sm font-medium">
                Node failed to render
              </p>
              <p className="text-biolum-dim text-xs">
                {this.state.error?.message ?? "An unexpected error occurred"}
              </p>
            </div>
            <Button
              className="mt-2"
              onClick={this.handleReset}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </MindscapeNode>
      );
    }

    return this.props.children;
  }
}


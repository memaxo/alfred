import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  windowId: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class WindowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {}

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-red-400 text-sm">Window error</p>
          <p className="max-w-[200px] truncate text-center text-biolum-faint text-xs">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <Button
            className="text-xs"
            onClick={this.handleRetry}
            size="sm"
            variant="ghost"
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const isDev = import.meta.env.DEV;

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const maxRetriesReached = this.state.retryCount >= 3;

      return (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg bg-card p-8 text-center text-foreground">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Algo sali&oacute; mal</h2>

          {isDev && this.state.error?.message && (
            <p className="max-w-md text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
          )}

          {maxRetriesReached ? (
            <p className="text-sm text-muted-foreground">
              El problema persiste. Por favor, contactar soporte.
            </p>
          ) : (
            <button
              className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              onClick={this.handleRetry}
            >
              Reintentar
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

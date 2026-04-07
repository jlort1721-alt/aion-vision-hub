import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

const isDev = import.meta.env.DEV;

/**
 * ErrorBoundary mejorado con UI de marca (navy/brand-red/gold),
 * tarjeta shadcn/ui y boton de reintentar.
 */
class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Error capturado:", error);
    console.error("[AppErrorBoundary] Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const maxRetriesReached = this.state.retryCount >= 3;

      return (
        <div className="flex h-full min-h-[400px] items-center justify-center bg-background p-6">
          <Card className="w-full max-w-lg border-destructive/30 bg-card shadow-lg">
            <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  Ha ocurrido un error inesperado
                </h2>
                <p className="text-sm text-muted-foreground">
                  Algo no funciono correctamente. Puede intentar recargar esta seccion.
                </p>
              </div>

              {isDev && this.state.error?.message && (
                <pre className="w-full max-h-32 overflow-auto rounded-md bg-muted/50 p-3 text-left text-xs text-muted-foreground">
                  {this.state.error.message}
                </pre>
              )}

              {maxRetriesReached ? (
                <p className="text-sm text-muted-foreground">
                  El problema persiste. Por favor, contacte al equipo de soporte.
                </p>
              ) : (
                <Button onClick={this.handleRetry} variant="default" className="mt-2">
                  Reintentar
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;

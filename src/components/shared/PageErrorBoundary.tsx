import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error(
      `[PageErrorBoundary:${this.props.pageName ?? "page"}]`,
      error,
      info,
    );
    this.setState({ componentStack: info.componentStack ?? null });
  }

  reload = () => {
    window.location.reload();
  };

  clearCacheAndReload = async () => {
    try {
      // Unregister service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // Clear caches
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // Clear localStorage for this page
      const keysToKeep = ["aion-jwt", "aion-refresh-token", "aion-tenant"];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((k) => {
        if (!keysToKeep.includes(k)) localStorage.removeItem(k);
      });
    } catch (e) {
      console.warn("Cache clear failed", e);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              Error al cargar {this.props.pageName ?? "la página"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Mensaje de error:
              </p>
              <pre className="text-xs bg-black/40 p-3 rounded overflow-auto max-h-40 text-red-300">
                {this.state.error?.message ?? "Error desconocido"}
              </pre>
            </div>

            {this.state.error?.stack && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Stack trace (para soporte técnico)
                </summary>
                <pre className="text-[10px] bg-black/40 p-3 rounded overflow-auto max-h-60 mt-2 text-muted-foreground">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {this.state.componentStack && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Component stack
                </summary>
                <pre className="text-[10px] bg-black/40 p-3 rounded overflow-auto max-h-60 mt-2 text-muted-foreground">
                  {this.state.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={this.reload} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recargar página
              </Button>
              <Button
                onClick={this.clearCacheAndReload}
                variant="outline"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar caché + recargar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
              Tip: si el error persiste después de limpiar caché, usa una
              ventana de incógnito o reporta el error al equipo técnico.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}

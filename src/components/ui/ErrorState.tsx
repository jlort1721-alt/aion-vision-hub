import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorStateProps {
  error?: Error | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
  variant?: 'page' | 'inline' | 'card';
}

function getDisplayMessage(error?: Error | null, fallbackDescription?: string): string {
  if (import.meta.env.PROD) {
    return fallbackDescription || 'An unexpected error occurred. Please try again.';
  }
  return error?.message || fallbackDescription || 'An unexpected error occurred. Please try again.';
}

export default function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  description,
  variant = 'page',
}: ErrorStateProps) {
  const message = getDisplayMessage(error, description);

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 underline underline-offset-2 hover:text-destructive/80 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-base font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // variant === 'page' (default)
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Page Shell Component
// Consistent page header with title, breadcrumbs, and actions
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';

export interface PageShellProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  description?: string;
  /** Icon component rendered before the title */
  icon?: React.ReactNode;
  /** Badge shown next to the title (e.g., count) */
  badge?: React.ReactNode;
  /** Action buttons rendered on the right side of the header */
  actions?: React.ReactNode;
  /** Custom className for the outer container */
  className?: string;
  /** Content */
  children: React.ReactNode;
}

export function PageShell({
  title,
  description,
  icon,
  badge,
  actions,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b bg-background/95">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
              {badge}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Optional leading icon (e.g. an svg or lucide/vibe icon). Rendered in a muted color. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Optional action node, typically a Button. */
  action?: React.ReactNode;
  className?: string;
}

/** Unified empty / zero-state: centered icon + title + description + optional action. */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    {icon && (
      <div className="mb-3 flex h-12 w-12 items-center justify-center text-gray-400 dark:text-ink-faint">
        {icon}
      </div>
    )}
    <p className="text-base font-semibold text-gray-900 dark:text-ink">{title}</p>
    {description && (
      <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-ink-muted">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;

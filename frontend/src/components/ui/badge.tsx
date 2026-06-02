import * as React from 'react'
import { cn } from '@/lib/utils'
import { radiusChip } from '@/lib/radius'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'teal'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium',
        radiusChip,
        {
          'bg-gray-100 dark:bg-surface text-gray-600 dark:text-ink-muted': variant === 'default',
          'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400': variant === 'success',
          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400': variant === 'warning',
          'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400': variant === 'error',
          'bg-brand-soft dark:bg-brand/20 text-brand-ink dark:text-brand-on-dark': variant === 'info',
          'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400': variant === 'purple',
          'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400': variant === 'teal',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }

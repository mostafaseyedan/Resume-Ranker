import * as React from 'react'
import { cn } from '@/lib/utils'
import { radiusControl } from '@/lib/radius'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'xs' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          {
            'bg-brand text-brand-fg hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover': variant === 'default',
            'border border-gray-300 dark:border-line bg-white dark:bg-transparent text-gray-700 dark:text-ink hover:bg-gray-50 dark:hover:bg-surface': variant === 'outline',
            'text-gray-600 dark:text-ink-muted hover:bg-gray-100 dark:hover:bg-surface hover:text-gray-900 dark:hover:text-ink': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
            'text-brand dark:text-brand-on-dark underline-offset-4 hover:underline p-0 h-auto': variant === 'link',
          },
          {
            'h-9 px-4 py-2 text-sm': size === 'default',
            'h-8 px-3 py-1.5 text-sm': size === 'sm',
            'h-6 px-2 py-1 text-xs': size === 'xs',
            'h-8 w-8': size === 'icon',
          },
          variant !== 'link' && radiusControl,
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }

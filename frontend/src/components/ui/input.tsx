import * as React from 'react'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/semanticColors'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-gray-500 dark:text-ink-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'flex h-8 w-full rounded-md border border-gray-300 dark:border-line bg-white dark:bg-canvas-deep px-3 py-1 text-sm text-gray-900 dark:text-ink placeholder:text-gray-400 dark:placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
            focusRing,
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }

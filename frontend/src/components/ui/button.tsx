import * as React from 'react'
import { cn } from '@/lib/utils'

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
          'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          {
            'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500': variant === 'default',
            'border border-gray-300 dark:border-[#4b4e69] bg-white dark:bg-transparent text-gray-700 dark:text-[#d5d8df] hover:bg-gray-50 dark:hover:bg-[#30324e]': variant === 'outline',
            'text-gray-600 dark:text-[#9699a6] hover:bg-gray-100 dark:hover:bg-[#30324e] hover:text-gray-900 dark:hover:text-[#d5d8df]': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
            'text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline p-0 h-auto': variant === 'link',
          },
          {
            'h-9 px-4 py-2 text-sm rounded-md': size === 'default',
            'h-8 px-3 py-1.5 text-sm rounded-md': size === 'sm',
            'h-6 px-2 py-1 text-xs rounded': size === 'xs',
            'h-8 w-8 rounded-md': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { radiusSurface } from '@/lib/radius';
import { tabActive, tabInactive } from '@/lib/semanticColors';

export type SectionTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const sectionCardClass = cn(
  'mb-3 border border-gray-200 dark:border-line bg-white dark:bg-surface p-4 shadow-sm',
  radiusSurface
);

export const sectionCardHeaderClass =
  'mb-2.5 flex items-start justify-between border-b border-gray-200 dark:border-line pb-2';

export const sectionCardTitleClass = 'm-0 text-sm font-semibold text-gray-900 dark:text-ink';

export const sectionCardBodyClass = 'text-sm leading-relaxed text-gray-700 dark:text-ink';

export const sectionListDiscClass =
  'ml-6 list-outside list-disc space-y-2 text-sm leading-relaxed text-gray-700 dark:text-ink marker:text-gray-500 dark:marker:text-ink-muted';

const toneBodyClass: Record<SectionTone, string> = {
  neutral: cn(radiusSurface, 'border border-gray-200 dark:border-line bg-gray-50 dark:bg-canvas p-3 text-sm text-gray-700 dark:text-ink'),
  info: cn(
    radiusSurface,
    'border border-sky-200 bg-sky-50/95 p-3 text-sm text-sky-950',
    'dark:border-sky-400/50 dark:bg-sky-950/70 dark:text-sky-100'
  ),
  success: cn(
    radiusSurface,
    'border border-emerald-200 bg-emerald-50/95 p-3 text-sm text-emerald-950',
    'dark:border-emerald-400/50 dark:bg-emerald-950/75 dark:text-emerald-100'
  ),
  warning: cn(
    radiusSurface,
    'border border-amber-200 bg-amber-50/95 p-3 text-sm text-amber-950',
    'dark:border-amber-400/50 dark:bg-amber-950/60 dark:text-amber-100'
  ),
  danger: cn(
    radiusSurface,
    'border border-red-200 bg-red-50/95 p-3 text-sm text-red-950',
    'dark:border-red-400/50 dark:bg-red-950/70 dark:text-red-100'
  ),
};

const toneTitleClass: Record<SectionTone, string> = {
  neutral: 'text-gray-900 dark:text-ink',
  info: 'text-sky-900 dark:text-sky-200',
  success: 'text-emerald-900 dark:text-emerald-200',
  warning: 'text-amber-900 dark:text-amber-200',
  danger: 'text-red-900 dark:text-red-200',
};

export function SectionHighlight({
  tone,
  title,
  children,
  className,
}: {
  tone: SectionTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(toneBodyClass[tone], 'section-highlight', className)}>
      {title && <h3 className={cn('mb-2 text-sm font-semibold', toneTitleClass[tone])}>{title}</h3>}
      {children}
    </div>
  );
}

export const detailTabActiveClass = tabActive;
export const detailTabInactiveClass = tabInactive;

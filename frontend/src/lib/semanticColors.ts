import { cn } from '@/lib/utils';

/**
 * Semantic color classes — Monday brand as the single interactive accent.
 * Use these instead of raw Tailwind `blue-*` / `indigo-*` for UI chrome.
 * Requirement-section tints (green, amber, purple, etc.) stay local per category.
 */

// —— Text ——
export const textPrimary = 'text-brand dark:text-brand-on-dark';
export const textLink = 'text-brand hover:text-brand-hover dark:text-brand-on-dark dark:hover:text-brand-on-dark';
export const textMetric = textPrimary;

// —— Surfaces ——
export const bgPrimarySoft = 'bg-brand-soft dark:bg-brand/15';
export const bgPrimaryWell = 'bg-brand-soft dark:bg-brand/10';
export const bgSelection = 'bg-brand-soft/70 dark:bg-brand/15';
export const bgSelectionStrong = 'bg-brand-soft dark:bg-brand/20';

// —— Borders ——
export const borderPrimary = 'border-brand/25 dark:border-brand/35';
export const borderPrimaryStrong = 'border-brand dark:border-brand/50';

// —— Focus ——
export const focusWithinRing =
  'focus-within:ring-2 focus-within:ring-brand focus-within:border-transparent';

export const focusRing =
  'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent';

export const focusVisibleRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-transparent';

/** Timeline / list marker dots */
export const timelineDot = 'border-brand dark:border-brand-on-dark';

// —— Tabs ——
export const tabActive = 'border-b-2 border-brand text-brand dark:text-brand-on-dark';
export const tabInactive =
  'border-b-2 border-transparent text-gray-500 dark:text-ink-muted hover:text-gray-700 dark:hover:text-ink hover:border-gray-300 dark:hover:border-line';

// —— Chips (email tags, etc.) ——
export const chipPrimary =
  'bg-brand-soft dark:bg-brand/20 text-brand-ink dark:text-brand-on-dark';

// —— Native buttons (when not using Vibe) ——
export const btnPrimary = 'bg-brand text-brand-fg hover:bg-brand-hover';

// —— Loading ——
export const spinner = 'border-brand border-t-transparent';
export const loadingWell = cn('p-4', bgPrimaryWell);
export const loadingText = 'text-sm text-brand-ink dark:text-brand-on-dark';

// —— Progress ——
export const progressFill = 'bg-brand';

// —— Chat ——
export const chatBubbleUser = 'bg-brand text-brand-fg';

// —— Job-detail: brand-highlight block (e.g. preferred skills) ——
export const jobSectionBrand = cn('border p-4 mb-3 shadow-sm', borderPrimary, bgPrimaryWell);
export const jobSectionBrandTitle = 'm-0 font-semibold text-brand-ink dark:text-brand-on-dark';
export const jobSectionBrandChip = cn(
  'px-3 py-1 bg-white dark:bg-surface border text-sm font-medium transition-all cursor-pointer hover:shadow-sm',
  borderPrimary,
  'text-brand-ink dark:text-brand-on-dark hover:bg-brand-soft dark:hover:bg-brand/20'
);

// —— Job-detail: neutral block (e.g. key responsibilities) ——
export const jobSectionNeutral = cn(
  'border border-gray-200 dark:border-line p-4 mb-3 bg-gray-50 dark:bg-canvas-deep shadow-sm'
);
export const jobSectionNeutralTitle = 'm-0 font-semibold text-gray-900 dark:text-ink';

// —— External candidate cards ——
export const externalCardSelected = cn(
  'border-l-brand ring-1 ring-brand/20 dark:ring-brand/30 bg-brand-soft/50 dark:bg-brand/10'
);
export const externalCardDefault =
  'border-l-gray-200 dark:border-l-line hover:border-l-brand dark:hover:border-l-brand-on-dark';

// —— Email thread ——
export const emailSentText = textPrimary;
export const emailSentBorder = borderPrimary;

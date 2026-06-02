import { radiusControl } from '@/lib/radius';
import { textLink } from '@/lib/semanticColors';
import { cn } from '@/lib/utils';

export interface DetailPanelBackProps {
  /** Parent pane name shown beside the chevron (e.g. "Candidates", "Resumes"). */
  label: string;
  onClick: () => void;
  className?: string;
}

/** Standard back control when drilling into a nested detail pane. */
export function DetailPanelBack({ label, onClick, className }: DetailPanelBackProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Back to ${label}`}
      className={cn(
        'inline-flex items-center gap-1 -ml-1 px-1 py-0.5 text-sm font-medium',
        radiusControl,
        textLink,
        'hover:underline',
        className
      )}
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}

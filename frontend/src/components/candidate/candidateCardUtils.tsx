import type { Candidate } from '../../services/apiService';
import { cn } from '@/lib/utils';
import { radiusChip, radiusSurface } from '@/lib/radius';

export const candidateAnalysisCardClass = cn(
  'flex cursor-pointer flex-col border border-gray-200 dark:border-line',
  radiusSurface,
  'bg-white dark:bg-surface p-4 transition-colors',
  'hover:bg-gray-50 dark:hover:bg-surface-hover'
);

export function formatCandidateDate(dateString?: string): string {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getScoreTone(score: number | undefined): {
  chipClass: string;
  textClass: string;
} {
  if (score === undefined) {
    return {
      chipClass: 'bg-gray-100 dark:bg-surface text-gray-600 dark:text-ink-muted',
      textClass: 'text-gray-600 dark:text-ink-muted',
    };
  }
  if (score >= 80) {
    return {
      chipClass: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      textClass: 'text-green-700 dark:text-green-300',
    };
  }
  if (score >= 70) {
    return {
      chipClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      textClass: 'text-yellow-700 dark:text-yellow-300',
    };
  }
  if (score >= 60) {
    return {
      chipClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400',
      textClass: 'text-orange-700 dark:text-orange-300',
    };
  }
  return {
    chipClass: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    textClass: 'text-red-700 dark:text-red-300',
  };
}

export function getVerificationBadge(candidate: Candidate): { label: string; className: string } {
  const status = candidate.web_verification?.overall_verification_status;
  if (!candidate.web_verification) {
    return {
      label: 'Verification pending',
      className: 'bg-gray-100 dark:bg-surface text-gray-600 dark:text-ink-muted',
    };
  }
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      };
    case 'partially_verified':
      return {
        label: 'Partially verified',
        className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      };
    case 'contradicted':
      return {
        label: 'Contradicted',
        className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      };
    case 'limited_information':
      return {
        label: 'Limited info',
        className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      };
    case 'no_information_found':
      return {
        label: 'No info found',
        className: 'bg-gray-100 dark:bg-surface text-gray-600 dark:text-ink-muted',
      };
    default:
      return {
        label: 'Verification pending',
        className: 'bg-gray-100 dark:bg-surface text-gray-600 dark:text-ink-muted',
      };
  }
}

export function getProviderLabel(candidate: Candidate): string | null {
  const p = candidate.web_verification_provider;
  if (p === 'openai') return 'ChatGPT';
  if (p === 'gemini') return 'Gemini';
  return null;
}

export interface ProviderBadge {
  label: string;
  image: string;
  className: string;
}

// Logo for the AI provider that analyzed the resume.
export function getAnalysisProviderBadge(candidate: Candidate): ProviderBadge | null {
  const p = (candidate.analysis_provider || '').toLowerCase();
  if (p === 'openai') {
    return { label: 'ChatGPT', image: '/chatgpt.png', className: 'h-4 w-auto dark:invert' };
  }
  if (p === 'gemini') {
    return { label: 'Gemini', image: '/gemini-icon.svg', className: 'h-5 w-auto' };
  }
  return null;
}

export function MetricRow({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-gray-500 dark:text-ink-muted">{label}</span>
      <span className={cn('font-medium tabular-nums', valueClassName)}>{value}</span>
    </div>
  );
}

export function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap', radiusChip, className)}>
      {label}
    </span>
  );
}

export function ScoreChip({ score, label = 'Score' }: { score: number | undefined; label?: string }) {
  const tone = getScoreTone(score);
  return (
    <div className={cn('inline-flex h-8 overflow-hidden border border-gray-200 dark:border-line text-xs', radiusChip)}>
      <span className="flex items-center border-r border-gray-200 dark:border-line bg-gray-50 dark:bg-canvas-deep px-2 font-medium text-gray-600 dark:text-ink-muted whitespace-nowrap">
        {label}
      </span>
      <span className={cn('flex min-w-[2.75rem] items-center justify-center px-2 font-semibold tabular-nums', tone.chipClass)}>
        {score !== undefined ? `${Math.round(score)}%` : 'N/A'}
      </span>
    </div>
  );
}

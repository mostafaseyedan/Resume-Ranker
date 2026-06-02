import React from 'react';
import { cn } from '@/lib/utils';
import { tabActive, tabInactive } from '@/lib/semanticColors';

export type SidebarViewMode = 'jobs' | 'candidates';

export interface SidebarViewTabsProps {
  value: SidebarViewMode;
  onChange: (mode: SidebarViewMode) => void;
  jobsCount?: number | null;
  candidatesCount?: number | null;
  candidatesLoading?: boolean;
}

function formatCount(
  count: number | null | undefined,
  loading?: boolean
): string | null {
  if (loading && (count == null || count === 0)) return null;
  if (count == null) return null;
  return String(count);
}

const SidebarViewTabs: React.FC<SidebarViewTabsProps> = ({
  value,
  onChange,
  jobsCount,
  candidatesCount,
  candidatesLoading,
}) => {
  const jobsLabel = formatCount(jobsCount);
  const candidatesLabel = formatCount(candidatesCount, candidatesLoading);

  const tabs: { id: SidebarViewMode; label: string; count: string | null }[] = [
    { id: 'jobs', label: 'Jobs', count: jobsLabel },
    { id: 'candidates', label: 'Candidates', count: candidatesLabel },
  ];

  return (
    <nav
      className="flex-shrink-0 flex bg-white dark:bg-surface border-b border-gray-200 dark:border-line"
      role="tablist"
      aria-label="Sidebar view"
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`sidebar-panel-${tab.id}`}
            id={`sidebar-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 min-w-0 px-3 py-2 text-sm font-medium transition-colors',
              selected ? tabActive : tabInactive
            )}
          >
            <span className="inline-flex items-center justify-center gap-1.5 min-w-0">
              <span className="truncate">{tab.label}</span>
              {tab.count != null ? (
                <span
                  className={cn(
                    'tabular-nums text-xs font-normal shrink-0',
                    selected
                      ? 'text-brand/80 dark:text-brand-on-dark/80'
                      : 'text-gray-400 dark:text-ink-muted'
                  )}
                >
                  {tab.count}
                </span>
              ) : candidatesLoading && tab.id === 'candidates' ? (
                <span
                  className="inline-block h-3 w-5 shrink-0 rounded bg-gray-200 dark:bg-surface-raised animate-pulse"
                  aria-hidden
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default SidebarViewTabs;

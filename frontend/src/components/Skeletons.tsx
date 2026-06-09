import React from 'react';
import { panelShellClass } from '@/lib/radius';

// Base shimmer block: a static base tint with a light gradient sweeping across it.
const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded bg-gray-200 dark:bg-surface-raised ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent" />
  </div>
);

/** Reusable single shimmer block — the shared loading primitive for one-off placeholders. */
export const Skeleton = Shimmer;

// Skeleton for group headers only (toolbar + accordion headers, no job rows).
export const JobGroupHeadersSkeleton: React.FC = () => (
  <div className="h-full flex flex-col" aria-busy="true" aria-label="Loading job groups">
    <div className="flex-shrink-0 p-4 bg-white dark:bg-surface border-b border-gray-200 dark:border-line">
      <div className="flex items-center gap-2">
        <Shimmer className="h-8 w-44" />
        <Shimmer className="h-8 flex-1" />
        <Shimmer className="h-8 w-24" />
      </div>
    </div>
    <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-canvas py-4">
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, groupIdx) => (
          <div key={groupIdx} className="bg-white dark:bg-surface shadow-sm overflow-hidden rounded-l-[4px]">
            <div className="flex items-center gap-2 py-3 pl-4 pr-4">
              <Shimmer className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-3 w-28" />
              </div>
              <Shimmer className="h-5 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const JobRowSkeleton: React.FC = () => (
  <div className="px-4 py-4 border-b border-gray-200 dark:border-line last:border-b-0 bg-white dark:bg-surface">
    <div className="flex justify-between items-start">
      <Shimmer className="h-4 w-3/5" />
      <div className="flex items-center gap-1 ml-2">
        <Shimmer className="h-4 w-4" />
        <Shimmer className="h-4 w-4" />
      </div>
    </div>
    <div className="mt-2.5 flex items-center gap-1.5">
      <Shimmer className="h-3 w-16" />
      <Shimmer className="h-4 w-14 rounded-full" />
      <Shimmer className="h-4 w-20 rounded-full" />
    </div>
  </div>
);

// Skeleton for the JobList sidebar: mirrors the toolbar + grouped job cards.
export const JobListSkeleton: React.FC = () => (
  <div className="h-full flex flex-col" aria-busy="true" aria-label="Loading jobs">
    {/* Toolbar: status filter + search + new-job button */}
    <div className="flex-shrink-0 p-4 bg-white dark:bg-surface border-b border-gray-200 dark:border-line">
      <div className="flex items-center gap-2">
        <Shimmer className="h-8 w-44" />
        <Shimmer className="h-8 flex-1" />
        <Shimmer className="h-8 w-24" />
      </div>
    </div>

    {/* Grouped job cards */}
    <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-canvas py-4">
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, groupIdx) => (
          <div key={groupIdx} className="bg-white dark:bg-surface shadow-sm overflow-hidden rounded-l-[4px]">
            {/* Group header */}
            <div className="flex items-center gap-2 py-3 pl-4 pr-4">
              <Shimmer className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-3 w-28" />
              </div>
              <Shimmer className="h-5 w-8 rounded-full" />
            </div>

            {/* Job rows */}
            <div className="border-t border-gray-200 dark:border-line">
              {Array.from({ length: 2 }).map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="px-4 py-4 border-b border-gray-200 dark:border-line last:border-b-0"
                >
                  <div className="flex justify-between items-start">
                    <Shimmer className="h-4 w-3/5" />
                    <div className="flex items-center gap-1 ml-2">
                      <Shimmer className="h-4 w-4" />
                      <Shimmer className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <Shimmer className="h-3 w-16" />
                    <Shimmer className="h-4 w-14 rounded-full" />
                    <Shimmer className="h-4 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Skeleton for the main detail panel (job detail / activity logs area).
export const DetailPanelSkeleton: React.FC = () => (
  <div className={`${panelShellClass} space-y-6 p-6`} aria-busy="true" aria-label="Loading details">
    {/* Title block */}
    <div className="space-y-3">
      <Shimmer className="h-7 w-1/2" />
      <div className="flex gap-2">
        <Shimmer className="h-5 w-20 rounded-full" />
        <Shimmer className="h-5 w-24 rounded-full" />
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
    </div>

    {/* Tab bar */}
    <div className="flex gap-4 border-b border-gray-200 dark:border-line pb-2">
      <Shimmer className="h-5 w-24" />
      <Shimmer className="h-5 w-28" />
    </div>

    {/* Content rows */}
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <Shimmer className="h-4 w-1/4" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-11/12" />
        </div>
      ))}
    </div>
  </div>
);

// Vertical list of row cards (candidate / resume / internal-candidate lists).
export const ListRowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-line bg-white dark:bg-surface p-3"
      >
        <Shimmer className="h-4 w-4 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-3 w-1/4" />
        </div>
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

// Responsive grid of profile cards (external / internal candidate results).
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="space-y-2 rounded-lg border border-gray-200 dark:border-line bg-white dark:bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-4 w-4" />
        </div>
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-3 w-2/3" />
        <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-line pt-2">
          <Shimmer className="h-5 w-28 rounded-full" />
          <Shimmer className="h-4 w-16" />
        </div>
      </div>
    ))}
  </div>
);

// SharePoint files explorer placeholder (action bar + file rows).
export const FileListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading files">
    <div className="flex items-center justify-between">
      <Shimmer className="h-5 w-40" />
      <div className="flex gap-2">
        <Shimmer className="h-8 w-28" />
        <Shimmer className="h-8 w-24" />
      </div>
    </div>
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-line divide-y divide-gray-200 dark:divide-line">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3 bg-white dark:bg-surface p-3">
          <Shimmer className="h-4 w-4 flex-shrink-0" />
          <Shimmer className="h-4 w-4 flex-shrink-0" />
          <Shimmer className="h-4 w-2/5" />
          <Shimmer className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

// Chat thread placeholder (alternating assistant / user bubbles).
export const ChatSkeleton: React.FC = () => (
  <div className="flex h-full flex-col gap-6 p-4" aria-busy="true" aria-label="Loading chat">
    <div className="flex items-start gap-2">
      <Shimmer className="h-6 w-6 rounded-full" />
      <div className="min-w-0 flex-1 max-w-[80%] space-y-2">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-11/12" />
        <Shimmer className="h-3 w-2/3" />
      </div>
    </div>
    <div className="flex flex-col items-end gap-1">
      <Shimmer className="h-6 w-6 rounded-full" />
      <Shimmer className="h-12 w-1/2 rounded-md" />
    </div>
    <div className="flex items-start gap-2">
      <Shimmer className="h-6 w-6 rounded-full" />
      <div className="min-w-0 flex-1 max-w-[80%] space-y-2">
        <Shimmer className="h-3 w-10/12" />
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-1/2" />
      </div>
    </div>
  </div>
);

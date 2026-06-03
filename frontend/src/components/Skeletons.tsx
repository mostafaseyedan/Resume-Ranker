import React from 'react';
import { panelShellClass } from '@/lib/radius';

// Base shimmer block: a static base tint with a light gradient sweeping across it.
const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded bg-gray-200 dark:bg-surface-raised ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent" />
  </div>
);

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

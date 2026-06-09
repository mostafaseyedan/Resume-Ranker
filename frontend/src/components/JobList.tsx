import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button, Label, Search as SearchField } from '@vibe/core';
import { Dropdown } from '@vibe/core/next';
import '@vibe/core/tokens';
import { Job, JobListItem, MondayBoardGroup, apiService } from '../services/apiService';
import {
  MONDAY_COLORS,
  getGroupColorFromVar,
  getVibeLabelColor,
} from '../lib/mondayColors';
import { JobGroupHeadersSkeleton, JobRowSkeleton } from './Skeletons';
import EmptyState from './common/EmptyState';
import NewJobModal from './NewJobModal';

interface JobListProps {
  jobs: JobListItem[];
  boardGroups: MondayBoardGroup[];
  groupsLoading?: boolean;
  jobsLoading?: boolean;
  selectedJob: Job | JobListItem | null;
  onJobSelect: (job: JobListItem) => void;
  onJobCreated: (job: Job) => void;
  onJobGenerated: (job: Job) => void;
}

const JobList: React.FC<JobListProps> = ({
  jobs,
  boardGroups,
  groupsLoading = false,
  jobsLoading = false,
  selectedJob,
  onJobSelect,
  onJobCreated,
  onJobGenerated,
}) => {
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resumeCounts, setResumeCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  /** At most one Monday group expanded (accordion). */
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const normalizeStatus = (status: string) =>
    (status || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const statusOptions = useMemo(
    () => {
      const map = new Map<string, string>();
      jobs.forEach((job) => {
        const status = job.monday_metadata?.status;
        if (status) {
          const key = normalizeStatus(status);
          if (key && !map.has(key)) {
            map.set(key, status);
          }
        }
      });
      const options = Array.from(map.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return [{ value: 'all', label: 'All statuses' }, ...options];
    },
    [jobs]
  );

  const hasSearch = searchQuery.trim().length > 0;
  const hasActiveFilters = hasSearch || statusFilter !== 'all';

  const filteredJobs = useMemo(
    () => {
      let filtered = jobs;

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter((job) => normalizeStatus(job.monday_metadata?.status || '') === statusFilter);
      }

      // Filter by search query (title, status, group, client)
      if (hasSearch) {
        const query = searchQuery.trim().toLowerCase();
        filtered = filtered.filter((job) => {
          const title = job.title?.toLowerCase() || '';
          const status = job.monday_metadata?.status?.toLowerCase() || '';
          const group = job.monday_metadata?.group?.toLowerCase() || '';
          const client = String((job.monday_metadata as any)?.client || '').toLowerCase();
          return (
            title.includes(query) ||
            status.includes(query) ||
            group.includes(query) ||
            client.includes(query)
          );
        });
      }

      // Sort by created date (newest first)
      const sorted = [...filtered].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      return sorted;
    },
    [jobs, statusFilter, searchQuery, hasSearch]
  );

  const getGroupKey = useCallback((job: JobListItem) => {
    const meta = job.monday_metadata as any;
    const groupMeta = meta?.group && typeof meta.group === 'object' ? meta.group : null;
    return (
      meta?.group_id ||
      meta?.groupId ||
      groupMeta?.id ||
      groupMeta?.group_id ||
      meta?.group ||
      'ungrouped'
    );
  }, []);

  const getGroupTitle = useCallback((job: JobListItem) => {
    const meta = job.monday_metadata as any;
    const groupMeta = meta?.group && typeof meta.group === 'object' ? meta.group : null;
    return (
      meta?.group_title ||
      meta?.groupTitle ||
      groupMeta?.title ||
      groupMeta?.name ||
      meta?.group ||
      'Other'
    );
  }, []);

  const getGroupPosition = useCallback((job: JobListItem) => {
    const meta = job.monday_metadata as any;
    const groupMeta = meta?.group && typeof meta.group === 'object' ? meta.group : null;
    const raw =
      meta?.group_position ??
      meta?.groupPosition ??
      meta?.group_order ??
      meta?.groupOrder ??
      meta?.group_index ??
      meta?.groupIndex ??
      meta?.group_pos ??
      meta?.groupPos ??
      groupMeta?.position ??
      groupMeta?.index ??
      groupMeta?.order;

    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) return Number(raw);
    return 999999;
  }, []);

  const getGroupColor = useCallback((job: JobListItem) => {
    const meta = job.monday_metadata as any;
    const groupMeta = meta?.group && typeof meta.group === 'object' ? meta.group : null;
    const candidates = [
      meta?.group_color,
      meta?.groupColor,
      meta?.group_color_name,
      meta?.groupColorName,
      meta?.group_color_var,
      meta?.groupColorVar,
      meta?.group_color_hex,
      meta?.groupColorHex,
      meta?.group_color_value,
      meta?.groupColorValue,
      meta?.group_color_id,
      meta?.groupColorId,
      groupMeta?.color,
      groupMeta?.color_name,
      groupMeta?.colorName,
      groupMeta?.color_var,
      groupMeta?.colorVar,
      groupMeta?.color_hex,
      groupMeta?.colorHex,
      groupMeta?.style?.color
    ];
    const first = candidates.find((value) => typeof value === 'string' && value.trim());
    if (first) return getGroupColorFromVar(first);
    if (meta?.status_color) return getGroupColorFromVar(meta.status_color);
    return MONDAY_COLORS.BLUE;
  }, []);

  const resolveGroupColor = useCallback(
    (groupId: string, items: JobListItem[], groupColor?: string | null) => {
      if (items.length > 0) {
        return getGroupColor(items[0]);
      }
      if (groupColor) {
        return getGroupColorFromVar(groupColor);
      }
      const boardGroup = boardGroups.find((group) => group.id === groupId);
      if (boardGroup?.color) {
        return getGroupColorFromVar(boardGroup.color);
      }
      return MONDAY_COLORS.BLUE;
    },
    [boardGroups, getGroupColor]
  );

  const groupedJobs = useMemo(() => {
    const groups = new Map<
      string,
      {
        items: JobListItem[];
        groupId: string;
        groupTitle: string;
        groupPosition: number;
        groupColor?: string | null;
      }
    >();

    boardGroups.forEach((group) => {
      groups.set(group.id, {
        items: [],
        groupId: group.id,
        groupTitle: group.title,
        groupPosition: group.position,
        groupColor: group.color,
      });
    });

    filteredJobs.forEach((job) => {
      const groupKey = getGroupKey(job);
      const groupTitle = getGroupTitle(job);
      const groupPosition = getGroupPosition(job);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          items: [],
          groupId: groupKey,
          groupTitle,
          groupPosition,
        });
      }
      groups.get(groupKey)!.items.push(job);
    });

    return new Map(
      Array.from(groups.entries()).sort((a, b) => a[1].groupPosition - b[1].groupPosition)
    );
  }, [boardGroups, filteredJobs, getGroupKey, getGroupPosition, getGroupTitle]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  }, []);

  const toggleAllGroups = useCallback(() => {
    setExpandedGroupId((prev) => {
      if (prev) return null;
      const first = groupedJobs.keys().next().value as string | undefined;
      return first ?? null;
    });
  }, [groupedJobs]);

  useEffect(() => {
    if (expandedGroupId && !groupedJobs.has(expandedGroupId)) {
      setExpandedGroupId(null);
    }
  }, [groupedJobs, expandedGroupId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        toggleAllGroups();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleAllGroups]);

  const hasJobDetails = (job: JobListItem) =>
    Boolean(job.has_job_details || (job as Job).extracted_data || (job as Job).description);
  const hasResumeAnalysis = (job: JobListItem) => {
    if (resumeCounts[job.id] > 0) {
      return true;
    }
    const anyJob = job as any;
    const numericKeys = [
      'candidate_count',
      'candidates_count',
      'total_candidates',
      'resume_count',
      'resume_files_count',
      'resumes_count'
    ];

    for (const key of numericKeys) {
      const val = anyJob[key];
      if (typeof val === 'number' && val > 0) {
        return true;
      }
      if (typeof val === 'string' && Number(val) > 0) {
        return true;
      }
    }

    const arrayKeys = ['candidates', 'resumes', 'resume_files'];
    for (const key of arrayKeys) {
      const val = anyJob[key];
      if (Array.isArray(val) && val.length > 0) {
        return true;
      }
    }

    // Some APIs return summarized analysis for the latest resume
    const hasAnalysisFields =
      Boolean(anyJob.overall_score) ||
      Boolean(anyJob.analysis) ||
      Boolean(anyJob.latest_candidate) ||
      Boolean(anyJob.latest_resume);
    return hasAnalysisFields;
  };

  const getJobTypeBreakdown = (items: JobListItem[]) => {
    let detailsTotal = 0;
    let resumeTotal = 0;

    items.forEach((job) => {
      if (hasJobDetails(job)) detailsTotal += 1;
      if (hasResumeAnalysis(job)) resumeTotal += 1;
    });

    const parts: string[] = [];
    if (detailsTotal > 0) {
      parts.push(`${detailsTotal} Job Detail${detailsTotal === 1 ? '' : 's'}`);
    }
    if (resumeTotal > 0) {
      parts.push(`${resumeTotal} Resume Analys${resumeTotal === 1 ? 'is' : 'es'}`);
    }

    return parts.length > 0 ? parts.join(' / ') : 'No analyses yet';
  };

  const formatDate = (value?: string | null) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  const getDueInfo = (value?: string | null) => {
    if (!value) return { text: 'N/A', isSoon: false };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { text: value, isSoon: false };

    const due = new Date(parsed);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${formatDate(value)} (past due)`, isSoon: true };
    }

    return {
      text: `${formatDate(value)} (${diffDays} day${diffDays === 1 ? '' : 's'})`,
      isSoon: diffDays < 15
    };
  };

  // Load resume badge counts lazily on the first group expansion, then cache.
  // (Without this guard the full candidate list was re-fetched on every group switch.)
  const resumeCountsLoadedRef = useRef(false);
  useEffect(() => {
    if (!expandedGroupId || resumeCountsLoadedRef.current) {
      return;
    }

    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const { candidates } = await apiService.getAllCandidates();
        if (cancelled) return;
        const counts: Record<string, number> = {};
        candidates.forEach((candidate) => {
          if (candidate.job_id) {
            counts[candidate.job_id] = (counts[candidate.job_id] || 0) + 1;
          }
        });
        setResumeCounts(counts);
        resumeCountsLoadedRef.current = true;
      } catch (_e) {
        // Swallow errors; counts will remain unset and may retry on next expand.
      }
    };

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [expandedGroupId]);

  if (groupsLoading) {
    return <JobGroupHeadersSkeleton />;
  }

  const showEmptyState =
    !jobsLoading && filteredJobs.length === 0 && boardGroups.length === 0 && groupedJobs.size === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="board-toolbar flex-shrink-0 p-4 bg-white dark:bg-surface border-b border-gray-200 dark:border-line">
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Dropdown
              id="status-filter"
              size="small"
              options={statusOptions}
              value={statusOptions.find(opt => opt.value === statusFilter)}
              onChange={(option: { value: string; label: string } | null) =>
                setStatusFilter(option?.value ?? 'all')
              }
              placeholder="All statuses"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchField
              value={searchQuery}
              onChange={(value: string) => setSearchQuery(value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search jobs..."
              size="small"
              showClearIcon={true}
              clearIconLabel="Clear search"
              inputAriaLabel="Search jobs"
              className="w-full board-toolbar-search"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => setShowNewJobModal(true)}
              size="small"
              kind="primary"
              color="positive"
            >
              + New Job
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-scroll bg-gray-100 dark:bg-canvas py-4">
        {showEmptyState ? (
          <EmptyState
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            }
            title={hasActiveFilters ? 'No matching jobs' : 'No jobs yet'}
            description={
              hasActiveFilters
                ? 'Try adjusting your search or status filter.'
                : 'Create a job or sync from Monday.com to get started.'
            }
          />
        ) : (
          <div className="space-y-3">
            {Array.from(groupedJobs.entries()).map(([groupId, { items, groupTitle, groupColor }]) => {
              const isCollapsed = expandedGroupId !== groupId;
              const resolvedGroupColor = resolveGroupColor(groupId, items, groupColor);
              const showGroupItemSkeleton = jobsLoading && items.length === 0;

              return (
                <div
                  key={groupId}
                  className={`shadow-sm overflow-hidden rounded-l-[4px] ${isCollapsed ? 'bg-white dark:bg-surface' : 'bg-transparent'}`}
                >
                  <div
                    onClick={() => toggleGroup(groupId)}
                    className={`flex items-center gap-2 py-3 cursor-pointer transition-colors relative ${isCollapsed
                      ? 'bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surface-hover'
                      : 'bg-gray-50/70 dark:bg-canvas-deep hover:bg-gray-100 dark:hover:bg-surface'
                      }`}
                  >
                    {isCollapsed && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                        style={{ backgroundColor: resolvedGroupColor }}
                      />
                    )}

                    <div className="flex items-center gap-2 pl-4 pr-4 w-full">
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'
                          }`}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: resolvedGroupColor }}
                      >
                        <polyline points="6,4 10,8 6,12" />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-base font-semibold"
                          style={{ color: resolvedGroupColor }}
                        >
                          {groupTitle}
                        </h3>
                        <div className="text-sm text-gray-500 dark:text-ink-muted mt-0.5">
                          {jobsLoading && items.length === 0
                            ? 'Loading jobs…'
                            : getJobTypeBreakdown(items)}
                        </div>
                      </div>

                      <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-surface-raised text-gray-700 dark:text-ink">
                        {jobsLoading && items.length === 0 ? '…' : items.length}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t border-gray-200 dark:border-line">
                      {showGroupItemSkeleton ? (
                        Array.from({ length: 3 }).map((_, rowIdx) => <JobRowSkeleton key={rowIdx} />)
                      ) : (
                        items.map((job) => {
                        const dueInfo = getDueInfo(job.monday_metadata?.due_date);

                        const itemContent = (
                          <div
                            onClick={() => onJobSelect(job)}
                            className={`group relative px-4 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover hover:z-[1] hover:shadow-elev-1 transition-all duration-150 border-b border-gray-200 dark:border-line last:border-b-0 ${selectedJob?.id === job.id
                              ? 'bg-brand-soft/60 dark:bg-brand/15 border-r-4 border-r-brand'
                              : 'bg-white dark:bg-surface'
                              }`}
                            style={{
                              borderLeft: `6px solid ${resolvedGroupColor}`,
                              borderBottomWidth: 1,
                              borderBottomStyle: 'solid'
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="text-[15px] font-normal text-gray-900 dark:text-ink whitespace-normal break-words pb-2" title={job.title ?? ''}>
                                  {job.title}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                {hasJobDetails(job) && (
                                  <Label
                                    id={`jobdetails-${job.id}`}
                                    text="J"
                                    size="small"
                                    color="positive"
                                    className="!min-w-0"
                                  />
                                )}
                                {hasResumeAnalysis(job) && (
                                  <Label
                                    id={`resume-${job.id}`}
                                    text="R"
                                    size="small"
                                    color="bright-blue"
                                    className="!min-w-0"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="mt-1.5 flex items-center flex-wrap gap-1 text-xs text-gray-500 dark:text-gray-400">
                              {job.created_at && (
                                <span className="mr-1">
                                  {new Date(job.created_at).toLocaleDateString()}
                                </span>
                              )}
                              {dueInfo.text && dueInfo.text !== 'N/A' && (
                                <span className={`mr-1 ${dueInfo.isSoon ? 'text-red-600 dark:text-red-400' : ''}`}>
                                  {dueInfo.text}
                                </span>
                              )}
                              {job.monday_metadata?.employment_type && (
                                <Label
                                  id={`employment-${job.id}`}
                                  text={job.monday_metadata.employment_type}
                                  size="small"
                                  color={getVibeLabelColor(job.monday_metadata.employment_type, job.monday_metadata.employment_type_color) as any}
                                />
                              )}
                              {job.monday_metadata?.status && (
                                <Label
                                  id={`status-${job.id}`}
                                  text={job.monday_metadata.status}
                                  size="small"
                                  color={getVibeLabelColor(job.monday_metadata.status, job.monday_metadata.status_color) as any}
                                />
                              )}
                              {job.monday_metadata?.work_mode && (
                                <Label
                                  id={`workmode-${job.id}`}
                                  text={job.monday_metadata.work_mode}
                                  size="small"
                                  color={getVibeLabelColor(job.monday_metadata.work_mode, job.monday_metadata.work_mode_color) as any}
                                />
                              )}
                            </div>

                          </div>
                        );

                        return <div key={job.id}>{itemContent}</div>;
                      })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewJobModal
        open={showNewJobModal}
        onClose={() => setShowNewJobModal(false)}
        onJobCreated={onJobCreated}
        onJobGenerated={onJobGenerated}
      />
    </div>
  );
};

export default JobList;

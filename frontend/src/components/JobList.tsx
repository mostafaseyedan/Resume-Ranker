import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Button, Label, TextField, TextArea, Search as SearchField } from '@vibe/core';
import { Dropdown } from '@vibe/core/next';
import '@vibe/core/tokens';
import { Job, apiService, CreateJobRequest } from '../services/apiService';
import {
  MONDAY_COLORS,
  getGroupColorFromVar,
  getVibeLabelColor,
} from '../lib/mondayColors';

interface JobListProps {
  jobs: Job[];
  selectedJob: Job | null;
  onJobSelect: (job: Job) => void;
  onJobCreated: (job: Job) => void;
  onJobGenerated: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
}

const JobList: React.FC<JobListProps> = ({ jobs, selectedJob, onJobSelect, onJobCreated, onJobGenerated, onJobDeleted }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPDFForm, setShowPDFForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingFromPDF, setCreatingFromPDF] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateJobRequest>({
    title: '',
    description: '',
    status: 'active'
  });
  const [pdfFormData, setPdfFormData] = useState({
    title: '',
    file: null as File | null
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resumeCounts, setResumeCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const hasInitializedGroups = useRef(false);
  const knownGroupIdsRef = useRef<Set<string>>(new Set());

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

  const getGroupKey = useCallback((job: Job) => {
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

  const getGroupTitle = useCallback((job: Job) => {
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

  const getGroupPosition = useCallback((job: Job) => {
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

  const getGroupColor = useCallback((job: Job) => {
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

  const groupedJobs = useMemo(() => {
    const groups = new Map<string, { items: Job[]; groupId: string; groupTitle: string; groupPosition: number }>();

    filteredJobs.forEach((job) => {
      const groupKey = getGroupKey(job);
      const groupTitle = getGroupTitle(job);
      const groupPosition = getGroupPosition(job);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          items: [],
          groupId: groupKey,
          groupTitle,
          groupPosition
        });
      }
      groups.get(groupKey)!.items.push(job);
    });

    return new Map(
      Array.from(groups.entries()).sort((a, b) => a[1].groupPosition - b[1].groupPosition)
    );
  }, [filteredJobs, getGroupKey, getGroupPosition, getGroupTitle]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleAllGroups = useCallback(() => {
    if (collapsedGroups.size === 0) {
      const allGroupIds = new Set(jobs.map(getGroupKey));
      setCollapsedGroups(allGroupIds);
    } else {
      setCollapsedGroups(new Set());
    }
  }, [collapsedGroups, jobs, getGroupKey]);

  useEffect(() => {
    if (hasInitializedGroups.current || jobs.length === 0) return;
    const allGroupIds = new Set(jobs.map(getGroupKey));
    setCollapsedGroups(allGroupIds);
    knownGroupIdsRef.current = new Set(allGroupIds);
    hasInitializedGroups.current = true;
  }, [jobs, getGroupKey]);

  useEffect(() => {
    if (jobs.length === 0) return;
    const newGroupIds: string[] = [];
    jobs.forEach((job) => {
      const groupId = getGroupKey(job);
      if (!knownGroupIdsRef.current.has(groupId)) {
        newGroupIds.push(groupId);
      }
    });
    if (newGroupIds.length === 0) return;
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      newGroupIds.forEach(groupId => next.add(groupId));
      return next;
    });
    newGroupIds.forEach(groupId => knownGroupIdsRef.current.add(groupId));
  }, [jobs, getGroupKey]);

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

  const handleGenerateJob = async () => {
    if (!formData.title.trim()) return;
    try {
      setGenerating(true);
      const response = await apiService.generateJobRequisition(formData.title.trim());
      if (response.success) {
        const jobResponse = await apiService.getJob(response.job_id);
        onJobGenerated(jobResponse.job);
        setFormData({ title: '', description: '', status: 'active' });
        setShowCreateForm(false);
        toast.success('Job requisition generated successfully');
      }
    } catch (err: any) {
      toast.error('Failed to generate job: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      const response = await apiService.createJob(formData);
      if (response.success) {
        // Get the created job details
        const jobResponse = await apiService.getJob(response.job_id);
        onJobCreated(jobResponse.job);
        setFormData({ title: '', description: '', status: 'active' });
        setShowCreateForm(false);
        toast.success('Job created successfully');
      }
    } catch (err: any) {
      toast.error('Failed to create job: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handlePDFSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFormData.file) {
      toast.error('Please select a PDF file');
      return;
    }

    try {
      setCreatingFromPDF(true);
      const response = await apiService.createJobFromPDF(
        pdfFormData.title,
        pdfFormData.file
      );
      if (response.success) {
        // Get the created job details
        const jobResponse = await apiService.getJob(response.job_id);
        onJobCreated(jobResponse.job);
        setPdfFormData({ title: '', file: null });
        setShowPDFForm(false);
        toast.success('Job created from PDF successfully');
      }
    } catch (err: any) {
      toast.error('Failed to create job from PDF: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreatingFromPDF(false);
    }
  };

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent job selection when clicking delete

    if (!confirm('Are you sure you want to delete this job? This will also delete all associated candidates.')) {
      return;
    }

    setDeletingJobId(jobId);
    try {
      await apiService.deleteJob(jobId);
      onJobDeleted(jobId);
      toast.success('Job deleted successfully');
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job. Please try again.');
    } finally {
      setDeletingJobId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const hasJobDetails = (job: Job) => Boolean((job as any).extracted_data || job.description);
  const hasResumeAnalysis = (job: Job) => {
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

  const getJobTypeBreakdown = (items: Job[]) => {
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

  // Fetch candidate counts in a single batched request to drive the R badge.
  // One GET /candidates, grouped by job_id, instead of one request per visible job.
  useEffect(() => {
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
      } catch (_e) {
        // Swallow errors; counts will remain unset.
      }
    };

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="board-toolbar p-4 bg-white dark:bg-surface border-b border-gray-200 dark:border-line shadow-sm">
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
              onClick={() => setShowCreateForm(!showCreateForm)}
              size="small"
              kind="primary"
            >
              + New Job
            </Button>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="p-4 border-b dark:border-line bg-gray-50 dark:bg-surface">
          <form onSubmit={handleSubmit} className="space-y-3">
            <TextField
              id="job-title-field"
              title="Job Title"
              value={formData.title}
              onChange={(value) => setFormData({ ...formData, title: value })}
              placeholder="e.g. Senior Frontend Developer"
              required
              size="small"
              wrapperClassName="w-full"
            />
            <TextArea
              label="Job Description *"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter detailed job description including required skills, experience, and responsibilities..."
              size="small"
            />
            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={creating || generating}
                loading={creating}
                kind="primary"
                color="positive"
                size="small"
                className="px-4 py-1"
              >
                {creating ? 'Creating...' : 'Create Job'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowPDFForm(true);
                  setShowCreateForm(false);
                }}
                kind="secondary"
                size="small"
                className="px-4 py-1 border-brand text-brand hover:bg-brand-soft dark:hover:bg-brand/15"
              >
                From file
              </Button>
              <Button
                type="button"
                onClick={handleGenerateJob}
                disabled={!formData.title.trim() || generating || creating}
                loading={generating}
                size="small"
                className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white border-0"
              >
                {generating ? 'Generating...' : 'Generate'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowCreateForm(false)}
                kind="tertiary"
                size="small"
                className="px-4 py-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {showPDFForm && (
        <div className="p-4 border-b dark:border-line bg-green-50 dark:bg-green-900/30">
          <form onSubmit={handlePDFSubmit} className="space-y-3">
            <div>
              <TextField
                id="job-title-pdf-field"
                title="Job Title"
                value={pdfFormData.title}
                onChange={(value) => setPdfFormData({ ...pdfFormData, title: value })}
                placeholder="Leave empty to auto-extract from file"
                size="small"
                wrapperClassName="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-ink-muted mt-1">Optional - The system will extract job title from the file if not provided</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-ink">Job Description File *</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setPdfFormData({ ...pdfFormData, file: e.target.files?.[0] || null })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-line dark:bg-surface dark:text-ink shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              />
              <p className="text-xs text-gray-500 dark:text-ink-muted mt-1">Upload a PDF or DOCX file containing the job description</p>
            </div>
            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={creatingFromPDF}
                loading={creatingFromPDF}
                kind="primary"
                color="positive"
                size="small"
                className="px-4 py-1"
              >
                {creatingFromPDF ? 'Creating...' : 'Create from file'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowPDFForm(false)}
                kind="tertiary"
                size="small"
                className="px-4 py-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-scroll bg-gray-100 dark:bg-canvas py-4">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft/60 dark:bg-brand/10 mb-4">
              <svg className="h-7 w-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            {hasActiveFilters ? (
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-ink">No matching jobs</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-ink-muted">Try adjusting your search or status filter.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-ink">No jobs yet</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-ink-muted">Create a job or sync from Monday.com to get started.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(groupedJobs.entries()).map(([groupId, { items, groupTitle }]) => {
              const isCollapsed = collapsedGroups.has(groupId);
              const groupColor = items.length > 0 ? getGroupColor(items[0]) : MONDAY_COLORS.BLUE;

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
                        style={{ backgroundColor: groupColor }}
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
                        style={{ color: groupColor }}
                      >
                        <polyline points="6,4 10,8 6,12" />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-base font-semibold"
                          style={{ color: groupColor }}
                        >
                          {groupTitle}
                        </h3>
                        <div className="text-sm text-gray-500 dark:text-ink-muted mt-0.5">
                          {getJobTypeBreakdown(items)}
                        </div>
                      </div>

                      <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-surface-raised text-gray-700 dark:text-ink">
                        {items.length}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t border-gray-200 dark:border-line">
                      {items.map((job, idx) => {
                        const dueInfo = getDueInfo(job.monday_metadata?.due_date);

                        const itemContent = (
                          <div
                            onClick={() => onJobSelect(job)}
                            className={`group relative px-4 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover hover:z-[1] hover:shadow-elev-1 transition-all duration-150 border-b border-gray-200 dark:border-line last:border-b-0 ${selectedJob?.id === job.id
                              ? 'bg-brand-soft/60 dark:bg-brand/15 border-r-4 border-r-brand'
                              : 'bg-white dark:bg-surface'
                              }`}
                            style={{
                              borderLeft: `6px solid ${groupColor}`,
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
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobList;

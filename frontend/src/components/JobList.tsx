import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Button, Label, TextField, TextArea, Search as SearchField } from '@vibe/core';
import { Dropdown } from '@vibe/core/next';
import '@vibe/core/tokens';
import { Job, apiService, CreateJobRequest } from '../services/apiService';

interface JobListProps {
  jobs: Job[];
  selectedJob: Job | null;
  onJobSelect: (job: Job) => void;
  onJobCreated: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
}

// Monday.com color name mappings (hex)
const MONDAY_COLOR_MAP: Record<string, string> = {
  'black': '#000000',
  'white': '#FFFFFF',
  'red': '#e2445c',
  'orange': '#fdab3d',
  'yellow': '#ffcb00',
  'green': '#00c875',
  'bright-green': '#9cd326',
  'aquamarine': '#00d647',
  'blue': '#579BFC',
  'dark-blue': '#0073ea',
  'purple': '#a25ddc',
  'pink': '#ff158a',
  'lipstick': '#ff5ac4',
  'dark-purple': '#784bd1',
  'indigo': '#6161FF',
  'cyan': '#66ccff',
  'done-green': '#00c875',
  'bright_green': '#9cd326',
  'dark-indigo': '#401694',
  'navy': '#1f76c2',
  'lavender': '#9aadff',
  'lilac': '#a1a1ff',
  'peach': '#ffadad',
  'done_green': '#00c875',
  'working_orange': '#fdab3d',
  'stuck_red': '#e2445c',
  'chili-blue': '#66ccff'
};

const MONDAY_COLORS = {
  BLUE: '#579BFC'
} as const;

// Additional Monday var_name -> hex mappings
const MONDAY_HEXES: Record<string, string> = {
  'grey': '#c4c4c4',
  'trolley-grey': '#757575',
  'winter': '#9aadbd',
  'purple-gray': '#9d99b9',
  'old-rose': '#cd9282',
  'royal': '#784bd1',
  'stuck-red': '#df2f4a',
  'done-green': '#00c875',
  'river': '#007eb5',
  'sky': '#216edf',
  'working-orange': '#fdab3d',
  'berry': '#cd9282',
  'green-shadow': '#00c875',
  'red-shadow': '#df2f4a',
  'lime-green': '#9cd326',
  'light-pink': '#ff5ac4',
  'grass-green': '#9cd326',
  'purple': '#a25ddc'
};

const getGroupColorFromVar = (colorName?: string | null): string => {
  if (!colorName) return MONDAY_COLORS.BLUE;
  const normalized = colorName.toLowerCase().replace(/_/g, '-');
  return (
    MONDAY_COLOR_MAP[normalized] ||
    MONDAY_HEXES[normalized] ||
    (colorName.startsWith('#') ? colorName : MONDAY_COLORS.BLUE)
  );
};

const JobList: React.FC<JobListProps> = ({ jobs, selectedJob, onJobSelect, onJobCreated, onJobDeleted }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPDFForm, setShowPDFForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingFromPDF, setCreatingFromPDF] = useState(false);
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

  // Map Monday.com var_name colors to Vibe Label colors (copied from RFPList.tsx)
  const MONDAY_TO_VIBE_COLOR_MAP: Record<string, string> = {
    // Green variants (done/success)
    'green-shadow': 'done-green',
    'grass-green': 'grass_green',
    'lime-green': 'saladish',

    // Orange/Yellow variants (working/in-progress)
    'orange': 'working_orange',
    'dark-orange': 'dark-orange',
    'yellow': 'egg_yolk',
    'mustered': 'tan',

    // Red variants (stuck/error)
    'red-shadow': 'stuck-red',
    'dark-red': 'dark-red',

    // Pink variants
    'dark-pink': 'sofia_pink',
    'light-pink': 'pink',

    // Purple/Indigo variants
    'dark-purple': 'dark_purple',
    'dark_indigo': 'dark_indigo',
    'purple': 'purple',

    // Blue variants
    'bright-blue': 'bright-blue',
    'blue-links': 'river',
    'sky': 'sky',
    'navy': 'navy',
    'australia': 'aquamarine',

    // Gray/Neutral variants
    'grey': 'american_gray',
    'trolley-grey': 'american_gray',
    'soft-black': 'blackish',
    'dark-grey': 'american_gray',
    'gray': 'american_gray',
    'wolf-gray': 'american_gray',
    'stone': 'american_gray',

    // Special colors
    'sunset': 'sunset',
    'winter': 'winter',     // Will override hex
    'sail': 'winter',       // Map sail to winter as well? Or pick another.
    'eden': 'teal',
    'old_rose': 'berry'     // Map old_rose to berry
  };

  // Define which Monday vars map to which Vibe tokens that we want to OVERRIDE with exact hexes
  // This keeps standard colors standard, but overrides specific ones for exact matching
  const COLOR_OVERRIDES: Record<string, string> = {
    'grey': 'american_gray',       // #c4c4c4
    'trolley-grey': 'steel',       // #757575 (Distinct from grey!)
    'winter': 'winter',            // #9aadbd
    'purple_gray': 'lavender',     // #9d99b9
    'old_rose': 'berry',           // #cd9282
    'dark-purple': 'royal',        // #784bd1
    'red-shadow': 'stuck-red',     // #df2f4a
    'green-shadow': 'done-green',  // #00c875
    'blue-links': 'river',         // #007eb5
    'sky': 'sky',                  // #216edf
    'orange': 'working_orange'     // #fdab3d
  };

  const getVibeLabelColor = (text: string, dynamicVarName?: string): string => {
    // 1. Try dynamic var_name from backend
    if (dynamicVarName) {
      const normalizedVar = dynamicVarName.toLowerCase().replace(/_/g, '-');
      // Check overrides first for exact replacements
      if (COLOR_OVERRIDES[normalizedVar]) return COLOR_OVERRIDES[normalizedVar];
      if (MONDAY_TO_VIBE_COLOR_MAP[normalizedVar]) return MONDAY_TO_VIBE_COLOR_MAP[normalizedVar];
    }

    // 2. Try static fallback based on text content (using STATIC_VAR_NAME_MAP)
    if (!text) return 'american_gray';
    const normalizedText = text.toLowerCase().trim();

    // Direct match in static map?
    let varName = STATIC_VAR_NAME_MAP[normalizedText];

    // Partial matches
    if (!varName) {
      if (normalizedText.includes('open')) varName = 'sky';
      else if (normalizedText.includes('submit')) varName = 'green-shadow';
      else if (normalizedText.includes('won') && !normalizedText.includes('not')) varName = 'lime-green';
      else if (normalizedText.includes('interview')) varName = 'light-pink';
      else if (normalizedText.includes('hold')) varName = 'grey';
      else if (normalizedText.includes('not pursuing')) varName = 'trolley-grey';
      else if (normalizedText.includes('closed')) varName = 'old_rose';
    }

    if (varName) {
      if (COLOR_OVERRIDES[varName]) return COLOR_OVERRIDES[varName];
      if (MONDAY_TO_VIBE_COLOR_MAP[varName]) return MONDAY_TO_VIBE_COLOR_MAP[varName];
    }

    return 'american_gray';
  };

  // Component to inject CSS variables for custom colors based on job metadata
  const CustomColorStyles = ({ jobs }: { jobs: Job[] }) => {
    // Collect all unique colors from jobs to override
    const overrides = jobs.reduce((acc, job) => {
      const process = (varName?: string, hex?: string) => {
        if (varName && hex) {
          const normalized = varName.toLowerCase().replace(/_/g, '-');
          const token = COLOR_OVERRIDES[normalized];
          if (token) {
            acc[token] = hex;
          }
        }
      };

      if (job.monday_metadata) {
        process(job.monday_metadata.status, undefined); // This won't work without var_name prop in metadata? Use fallback hex map?
        // Wait, metadata has _color which is now var_name. We need the HEX to set the variable.
        // Actually, we configured the backend to store var_name in _color field. 
        // We DON'T have the hex in the frontend metadata anymore!
        // We need to use our STATIC HEX MAP for the variable values?
        // Or just hardcode the known Monday Hexes here since they don't change often.
      }
      return acc;
    }, {} as Record<string, string>);

    // Generate CSS
    const css = Object.entries(COLOR_OVERRIDES).map(([varName, token]) => {
      const normalizedVar = varName.toLowerCase().replace(/_/g, '-');
      const normalizedToken = token.toLowerCase().replace(/_/g, '-');
      // Find hex for this var_name
      let hex = MONDAY_HEXES[normalizedVar] || MONDAY_HEXES[varName];
      // Or mapping
      if (!hex && (MONDAY_HEXES[normalizedToken] || MONDAY_HEXES[token])) {
        hex = MONDAY_HEXES[normalizedToken] || MONDAY_HEXES[token];
      }

      if (hex) {
        return `--color-${token}: ${hex}; --color-${token}-hover: ${hex}; --color-${token}-selected: ${hex};`;
      }
      return '';
    }).join('\n');

    return (
      <style dangerouslySetInnerHTML={{
        __html: `
            :root {
                ${css}
            }
        `}} />
    );
  };

  // Static fallback MAPPING from text to Monday var_name (not hex)
  // This ensures we simulate what the backend WOULD return via var_name
  const STATIC_VAR_NAME_MAP: Record<string, string> = {
    // Statuses
    'open': 'sky',
    'submitted': 'green-shadow',
    'won': 'lime-green',
    'in progress': 'orange',
    'interviewing': 'light-pink',
    'analysis': 'dark-purple',
    'closed - filled': 'red-shadow',
    'closed': 'old_rose',
    'hold': 'grey',
    'not pursuing': 'trolley-grey',
    'not won': 'dark-orange',
    'monitor': 'sunset',

    // Work Mode
    'onsite': 'orange',
    'remote': 'green-shadow',
    'hybrid': 'purple',
    'uk': 'blue-links',
    'europe': 'australia',
    'latin america': 'grass-green',

    // Employment Type
    'part-time': 'blue-links',
    'consultant': 'grey',
    'full-time': 'winter',
    'contract-to-hire': 'purple'
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

  // Fetch candidate counts for visible jobs to drive the R badge
  useEffect(() => {
    const missingJobIds = filteredJobs
      .map((job) => job.id)
      .filter((id) => resumeCounts[id] === undefined);

    if (missingJobIds.length === 0) return;

    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const results = await Promise.all(
          missingJobIds.map(async (jobId) => {
            try {
              const res = await apiService.getJobCandidates(jobId);
              return { jobId, count: res.candidates ? res.candidates.length : 0 };
            } catch (_err) {
              return { jobId, count: 0 };
            }
          })
        );

        if (!cancelled) {
          const updates: Record<string, number> = {};
          results.forEach(({ jobId, count }) => {
            updates[jobId] = count;
          });
          setResumeCounts((prev) => ({ ...prev, ...updates }));
        }
      } catch (_e) {
        // Swallow errors; counts will remain unset.
      }
    };

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [filteredJobs, resumeCounts]);

  return (
    <div className="h-full flex flex-col">
      <CustomColorStyles jobs={jobs} />
      <div className="board-toolbar p-4 bg-white dark:bg-[#30324e] border-b border-gray-200 dark:border-[#4b4e69] shadow-sm">
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
        <div className="p-4 border-b dark:border-[#4b4e69] bg-gray-50 dark:bg-[#30324e]">
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
                disabled={creating}
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
                kind="primary"
                size="small"
                className="px-4 py-1"
              >
                From file
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
        <div className="p-4 border-b dark:border-[#4b4e69] bg-green-50 dark:bg-green-900/30">
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
              <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">Optional - The system will extract job title from the file if not provided</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#d5d8df]">Job Description File *</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setPdfFormData({ ...pdfFormData, file: e.target.files?.[0] || null })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#4b4e69] dark:bg-[#30324e] dark:text-[#d5d8df] shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              />
              <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">Upload a PDF or DOCX file containing the job description</p>
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

      <div className="flex-1 overflow-y-scroll bg-gray-100 dark:bg-[#181b34] py-4">
        {filteredJobs.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-[#9699a6]">
            {hasActiveFilters ? (
              <p className="text-sm">No jobs match the selected filters.</p>
            ) : (
              <>
                <div className="text-2xl mb-2"></div>
                <p>No jobs yet</p>
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
                  className={`shadow-sm overflow-hidden rounded-l-[4px] ${isCollapsed ? 'bg-white dark:bg-[#30324e]' : 'bg-transparent'}`}
                >
                  <div
                    onClick={() => toggleGroup(groupId)}
                    className={`flex items-center gap-2 py-3 cursor-pointer transition-colors relative ${isCollapsed
                      ? 'bg-white dark:bg-[#30324e] hover:bg-gray-50 dark:hover:bg-[#3a3d5c]'
                      : 'bg-gray-50/70 dark:bg-[#252844] hover:bg-gray-100 dark:hover:bg-[#30324e]'
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
                        <div className="text-sm text-gray-500 dark:text-[#9699a6] mt-0.5">
                          {getJobTypeBreakdown(items)}
                        </div>
                      </div>

                      <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-[#3e4259] text-gray-700 dark:text-[#d5d8df]">
                        {items.length}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t border-gray-200 dark:border-[#4b4e69]">
                      {items.map((job, idx) => {
                        const dueInfo = getDueInfo(job.monday_metadata?.due_date);

                        const itemContent = (
                          <div
                            onClick={() => onJobSelect(job)}
                            className={`relative p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3a3d5c] transition-all duration-150 border-b border-gray-200 dark:border-[#4b4e69] last:border-b-0 ${selectedJob?.id === job.id
                              ? 'bg-blue-50 dark:bg-[#13377433] border-r-4 border-r-[#6161FF]'
                              : 'bg-white dark:bg-[#30324e]'
                              }`}
                            style={{
                              borderLeft: `6px solid ${groupColor}`,
                              borderBottomWidth: 1,
                              borderBottomStyle: 'solid'
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="text-[15px] font-normal text-gray-900 dark:text-[#d5d8df] whitespace-normal break-words pb-2" title={job.title ?? ''}>
                                  {job.title}
                                </h3>
                                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  {job.created_at && (
                                    <span>
                                      {new Date(job.created_at).toLocaleDateString()}
                                    </span>
                                  )}
                                  {dueInfo.text && dueInfo.text !== 'N/A' && (
                                    <span className={dueInfo.isSoon ? 'text-red-600 dark:text-red-400' : ''}>
                                      {dueInfo.text}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1 items-center justify-between">
                              <div className="flex flex-wrap gap-1">
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

                              <div className="flex items-center gap-1">
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

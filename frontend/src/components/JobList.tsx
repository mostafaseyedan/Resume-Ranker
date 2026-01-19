import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Button, Label } from '@vibe/core';
import '@vibe/core/tokens';
import { Job, apiService, CreateJobRequest } from '../services/apiService';

interface JobListProps {
  jobs: Job[];
  selectedJob: Job | null;
  onJobSelect: (job: Job) => void;
  onJobCreated: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
}

const JobList: React.FC<JobListProps> = ({ jobs, selectedJob, onJobSelect, onJobCreated, onJobDeleted }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPDFForm, setShowPDFForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingFromPDF, setCreatingFromPDF] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [syncingMonday, setSyncingMonday] = useState(false);
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
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [resumeCounts, setResumeCounts] = useState<Record<string, number>>({});

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
      return Array.from(map.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    [jobs]
  );

  const clientOptions = useMemo(
    () => {
      const clients = new Set<string>();
      jobs.forEach((job) => {
        const client = (job.monday_metadata as any)?.client;
        if (client && client.trim()) {
          clients.add(client.trim());
        }
      });
      return Array.from(clients).sort((a, b) => a.localeCompare(b));
    },
    [jobs]
  );

  const filteredJobs = useMemo(
    () => {
      let filtered = jobs;

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter((job) => normalizeStatus(job.monday_metadata?.status || '') === statusFilter);
      }

      // Filter by client
      if (clientFilter !== 'all') {
        filtered = filtered.filter((job) => (job.monday_metadata as any)?.client?.trim() === clientFilter);
      }

      return filtered;
    },
    [jobs, statusFilter, clientFilter]
  );

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

  const handleSyncMonday = async () => {
    try {
      setSyncingMonday(true);
      const response = await apiService.syncJobsFromMonday();

      if (response.success) {
        toast.success(`Successfully synced ${response.synced_jobs.length} jobs from Monday.com!`);

        // Refresh the job list by calling onJobCreated for each new job
        // In a real app, you might want to refresh the entire list instead
        if (response.synced_jobs.some(job => job.action === 'created')) {
          window.location.reload(); // Simple refresh for now
        }
      } else {
        toast.error('Failed to sync jobs from Monday.com');
      }
    } catch (error: any) {
      console.error('Monday sync error:', error);
      toast.error('Failed to sync jobs from Monday.com: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncingMonday(false);
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

    // Hardcoded Monday Hexes for the overrides we care about
    const MONDAY_HEXES: Record<string, string> = {
      'grey': '#c4c4c4',
      'trolley-grey': '#757575',
      'winter': '#9aadbd',
      'purple_gray': '#9d99b9',
      'old_rose': '#cd9282',
      'royal': '#784bd1', // mapped from dark-purple
      'stuck-red': '#df2f4a',
      'done-green': '#00c875',
      'river': '#007eb5',
      'sky': '#216edf',
      'working_orange': '#fdab3d',
      'berry': '#cd9282'
    };

    // Generate CSS
    const css = Object.entries(COLOR_OVERRIDES).map(([varName, token]) => {
      // Find hex for this var_name
      let hex = MONDAY_HEXES[varName];
      // Or mapping
      if (!hex && MONDAY_HEXES[token]) hex = MONDAY_HEXES[token];

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
    <div className="flex flex-col h-full bg-white shadow-sm border border-gray-200">
      <CustomColorStyles jobs={jobs} />
      {/* Header Section */}
      <div className="p-4 border-b">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center flex-wrap gap-2 text-sm text-gray-700">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              id="client-filter"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="text-sm border border-gray-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All clients</option>
              {clientOptions.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncMonday}
              disabled={syncingMonday}
              title={syncingMonday ? 'Syncing...' : 'Sync Monday jobs'}
              aria-label={syncingMonday ? 'Syncing Monday jobs' : 'Sync Monday jobs'}
              className="h-9 w-9 bg-white hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center"
            >
              {syncingMonday ? (
                <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
              ) : (
                <img src="/monday.svg" alt="" aria-hidden="true" className="h-6 w-6" />
              )}
            </button>
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
        <div className="p-4 border-b bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g. Senior Frontend Developer"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter detailed job description including required skills, experience, and responsibilities..."
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-1 bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Job'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPDFForm(true);
                  setShowCreateForm(false);
                }}
                className="px-4 py-1 bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                From file
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-1 bg-gray-300 text-gray-700 text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showPDFForm && (
        <div className="p-4 border-b bg-green-50">
          <form onSubmit={handlePDFSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Title</label>
              <input
                type="text"
                value={pdfFormData.title}
                onChange={(e) => setPdfFormData({ ...pdfFormData, title: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Leave empty to auto-extract from file"
              />
              <p className="text-xs text-gray-500 mt-1">Optional - The system will extract job title from the file if not provided</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Description File *</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setPdfFormData({ ...pdfFormData, file: e.target.files?.[0] || null })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Upload a PDF or DOCX file containing the job description</p>
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={creatingFromPDF}
                className="px-4 py-1 bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {creatingFromPDF ? 'Creating...' : 'Create from file'}
              </button>
              <button
                type="button"
                onClick={() => setShowPDFForm(false)}
                className="px-4 py-1 bg-gray-300 text-gray-700 text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="text-2xl mb-2"></div>
            <p>No jobs yet</p>
            <p className="text-sm">Create your first job position</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No jobs match the selected status.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onJobSelect(job)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedJob?.id === job.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 truncate">{job.title}</h3>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="mt-2 flex flex-wrap gap-1 items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {/* Employment Type Tag */}
                    {job.monday_metadata?.employment_type && (
                      <Label
                        id={`employment-${job.id}`}
                        text={job.monday_metadata.employment_type}
                        size="small"
                        color={getVibeLabelColor(job.monday_metadata.employment_type, job.monday_metadata.employment_type_color) as any}
                      />
                    )}

                    {/* Req Status Tag */}
                    {job.monday_metadata?.status && (
                      <Label
                        id={`status-${job.id}`}
                        text={job.monday_metadata.status}
                        size="small"
                        color={getVibeLabelColor(job.monday_metadata.status, job.monday_metadata.status_color) as any}
                      />
                    )}

                    {/* Work Mode Tag */}
                    {job.monday_metadata?.work_mode && (
                      <Label
                        id={`workmode-${job.id}`}
                        text={job.monday_metadata.work_mode}
                        size="small"
                        color={getVibeLabelColor(job.monday_metadata.work_mode, job.monday_metadata.work_mode_color) as any}
                      />
                    )}

                    {/* Client Tag */}
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

                {/* Created Date */}
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">
                    {(job.monday_metadata as any)?.client && (
                      <span className="font-medium mr-1">
                        {(job.monday_metadata as any).client} •
                      </span>
                    )}
                    Created: {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


export default JobList;

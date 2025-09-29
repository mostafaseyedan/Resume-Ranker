import React, { useState } from 'react';
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
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [formData, setFormData] = useState<CreateJobRequest>({
    title: '',
    description: '',
    status: 'active'
  });
  const [pdfFormData, setPdfFormData] = useState({
    title: '',
    file: null as File | null
  });

  const showNotification = (type: 'success' | 'error' | 'info', message: string, duration: number = 5000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), duration);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      showNotification('error', 'Please fill in all required fields');
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
      }
    } catch (err: any) {
      showNotification('error', 'Failed to create job: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handlePDFSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFormData.file) {
      showNotification('error', 'Please select a PDF file');
      return;
    }

    try {
      setCreatingFromPDF(true);
      const response = await apiService.createJobFromPDF(
        pdfFormData.title,
        '',
        pdfFormData.file
      );
      if (response.success) {
        // Get the created job details
        const jobResponse = await apiService.getJob(response.job_id);
        onJobCreated(jobResponse.job);
        setPdfFormData({ title: '', file: null });
        setShowPDFForm(false);
      }
    } catch (err: any) {
      showNotification('error', 'Failed to create job from PDF: ' + (err.response?.data?.error || err.message));
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
    } catch (error) {
      console.error('Failed to delete job:', error);
      showNotification('error', 'Failed to delete job. Please try again.');
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleSyncMonday = async () => {
    try {
      setSyncingMonday(true);
      const response = await apiService.syncJobsFromMonday();

      if (response.success) {
        showNotification('success', `Successfully synced ${response.synced_jobs.length} jobs from Monday.com!`, 8000);

        // Refresh the job list by calling onJobCreated for each new job
        // In a real app, you might want to refresh the entire list instead
        if (response.synced_jobs.some(job => job.action === 'created')) {
          window.location.reload(); // Simple refresh for now
        }
      } else {
        showNotification('error', 'Failed to sync jobs from Monday.com');
      }
    } catch (error: any) {
      console.error('Monday sync error:', error);
      showNotification('error', 'Failed to sync jobs from Monday.com: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncingMonday(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getReqStatusColor = (status: string) => {
    const normalizedStatus = (status || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const matchableStatus = (() => {
      if (normalizedStatus.includes('open')) return 'open';
      if (normalizedStatus.includes('submit')) return 'submitted';
      if (normalizedStatus.includes('interview')) return 'interviewing';
      if (normalizedStatus.includes('not pursuing')) return 'not pursuing';
      if (normalizedStatus.includes('closed')) return 'closed';
      return normalizedStatus;
    })();

    switch (matchableStatus) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'submitted':
        return 'bg-green-100 text-green-800';
      case 'interviewing':
        return 'bg-pink-100 text-pink-800';
      case 'not pursuing':
        return 'bg-gray-100 text-gray-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Notification Banner */}
      {notification && (
        <div className={`m-4 mb-0 p-3 rounded-lg border ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : notification.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">{jobs.length} Job{jobs.length !== 1 ? 's' : ''}</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleSyncMonday}
              disabled={syncingMonday}
              className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center space-x-1"
            >
              {syncingMonday ? (
                <>
                  <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span></span>
                  <span>Sync Monday</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + New Job
            </button>
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter detailed job description including required skills, experience, and responsibilities..."
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Job'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPDFForm(true);
                  setShowCreateForm(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                 From PDF
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Leave empty to auto-extract from PDF"
              />
              <p className="text-xs text-gray-500 mt-1">Optional - The system will extract job title from PDF if not provided</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Description PDF *</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFormData({ ...pdfFormData, file: e.target.files?.[0] || null })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Upload a PDF file containing the job description</p>
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={creatingFromPDF}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {creatingFromPDF ? 'Creating...' : 'Create from PDF'}
              </button>
              <button
                type="button"
                onClick={() => setShowPDFForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
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
        ) : (
          <div className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onJobSelect(job)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedJob?.id === job.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 truncate">{job.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-2 flex items-center space-x-1">
                    <button
                      onClick={(e) => handleDeleteJob(job.id, e)}
                      disabled={deletingJobId === job.id}
                      className="text-red-500 hover:text-red-700 p-1 rounded disabled:opacity-50"
                      title="Delete job"
                    >
                      {deletingJobId === job.id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {/* Req Status Tag */}
                  {job.monday_metadata?.status && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getReqStatusColor(job.monday_metadata.status)}`}>
                      {job.monday_metadata.status}
                    </span>
                  )}

                  {/* Work Mode Tag */}
                  {job.monday_metadata?.work_mode && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {job.monday_metadata.work_mode}
                    </span>
                  )}

                  {/* Employment Type Tag */}
                  {job.monday_metadata?.employment_type && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {job.monday_metadata.employment_type}
                    </span>
                  )}

                </div>

                <div className="mt-2 text-sm text-gray-600">
                  <div className="line-clamp-2">
                    {job.description.length > 100
                      ? `${job.description.substring(0, 100)}...`
                      : job.description
                    }
                  </div>
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

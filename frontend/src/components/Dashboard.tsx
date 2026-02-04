import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Job, Candidate, apiService } from '../services/apiService';
import JobList from './JobList';
import JobDetail from './JobDetail';
import CandidateSidebar from './CandidateSidebar';
import CandidateDashboardView from './CandidateDashboardView';
import ActivityLogs from './ActivityLogs';
import ActivityNotificationDropdown from './ActivityNotificationDropdown';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useMsal } from '@azure/msal-react';
import { ButtonGroup, Button, IconButton } from '@vibe/core';
import '@vibe/core/tokens';

// Type for grouped candidate (matching CandidateSidebar)
interface GroupedCandidate {
  name: string;
  candidates: Candidate[];
  bestScore: number;
  jobCount: number;
  jobTitles: string[];
  latestDate: string;
  verificationStatus: string | null;
  hasImproved: boolean;
}

const Dashboard: React.FC = () => {
  // View mode state
  const [viewMode, setViewMode] = useState<'jobs' | 'candidates'>('jobs');
  const viewModeOptions = [
    { value: 'jobs', text: 'Jobs' },
    { value: 'candidates', text: 'Candidates' }
  ];

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedGroupedCandidate, setSelectedGroupedCandidate] = useState<GroupedCandidate | null>(null);

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { instance } = useMsal();

  useEffect(() => {
    if (isAuthenticated) {
      loadJobs();
    }
  }, [isAuthenticated]);

  // Load candidates when switching to candidate view
  useEffect(() => {
    if (isAuthenticated && viewMode === 'candidates' && candidates.length === 0 && !candidatesLoading) {
      loadCandidates();
    }
  }, [isAuthenticated, viewMode]);

  const loadCandidates = async () => {
    try {
      setCandidatesLoading(true);
      setCandidatesError(null);
      const response = await apiService.getAllCandidates();
      setCandidates(response.candidates);
    } catch (err: any) {
      setCandidatesError('Failed to load candidates: ' + (err.response?.data?.error || err.message));
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      // Auto-sync with Monday.com first
      try {
        const syncResponse = await apiService.syncJobsFromMonday();
        if (syncResponse.synced_jobs?.length > 0) {
          toast.success(`Synced ${syncResponse.synced_jobs.length} jobs from Monday.com`);
        }
      } catch (syncErr) {
        // Silently fail sync - jobs will still load from database
        console.warn('Monday sync failed:', syncErr);
      }
      // Load jobs from database
      const response = await apiService.getAllJobs();
      setJobs(response.jobs);
      setError(null);
    } catch (err: any) {
      setError('Failed to load jobs: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleJobCreated = (newJob: Job) => {
    setJobs(prevJobs => [newJob, ...prevJobs]);
  };

  const handleJobDeleted = (jobId: string) => {
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
    // Clear selected job if it was deleted
    if (selectedJob?.id === jobId) {
      setSelectedJob(null);
    }
  };

  const handleJobUpdated = (updatedJob: Job) => {
    // Update the job in the jobs list
    setJobs(prevJobs =>
      prevJobs.map(job =>
        job.id === updatedJob.id ? updatedJob : job
      )
    );

    // Update the selected job if it's the one that was updated
    if (selectedJob?.id === updatedJob.id) {
      setSelectedJob(updatedJob);
    }
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin + '/login'
    });
  };

  const handleShowLogs = () => {
    setSelectedJob(null);
    setShowLogs(true);
  };

  const handleViewModeToggle = (mode: 'jobs' | 'candidates') => {
    setViewMode(mode);
    // Reset selections when switching views
    if (mode === 'jobs') {
      setSelectedGroupedCandidate(null);
    } else {
      setSelectedJob(null);
      setShowLogs(false);
    }
  };

  const handleCandidateDeleted = (candidateId: string) => {
    setCandidates(prevCandidates => prevCandidates.filter(c => c.id !== candidateId));
    // Update selected grouped candidate if needed
    if (selectedGroupedCandidate) {
      const updatedCandidates = selectedGroupedCandidate.candidates.filter(c => c.id !== candidateId);
      if (updatedCandidates.length === 0) {
        setSelectedGroupedCandidate(null);
      } else {
        setSelectedGroupedCandidate({
          ...selectedGroupedCandidate,
          candidates: updatedCandidates,
          bestScore: Math.max(...updatedCandidates.map(c => c.overall_score || 0))
        });
      }
    }
  };

  const handleJobSelectFromCandidateView = (job: Job) => {
    // Switch to jobs view and select the job
    setViewMode('jobs');
    setSelectedJob(job);
    setSelectedGroupedCandidate(null);
    setShowLogs(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 text-center">
          <div className="text-xl mb-2">Authentication Required</div>
          <div>Please log in to access the dashboard</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 text-center">
          <div className="text-xl mb-2">Error</div>
          <div>{error}</div>
          <Button
            onClick={loadJobs}
            kind="primary"
            size="small"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-[#181b34] flex flex-col overflow-hidden">
      <header className="bg-white dark:bg-[#30324e] shadow-sm border-b dark:border-[#4b4e69] flex-shrink-0">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0 flex items-center gap-4">
            <h1 className="text-base font-semibold text-gray-700 dark:text-[#d5d8df]">TalentMax</h1>
            {/* View Mode Toggle */}
            <ButtonGroup
              options={viewModeOptions}
              value={viewMode}
              onSelect={(value) => handleViewModeToggle(value as 'jobs' | 'candidates')}
              size="small"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-5">
            <nav className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#9699a6] sm:gap-5">
              <a
                href="https://reconrfp.cendien.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#3a3d5c] hover:text-gray-900 dark:hover:text-white"
              >
                RFPHub
              </a>
              <a
                href="https://sales.cendien.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#3a3d5c] hover:text-gray-900 dark:hover:text-white"
              >
                SalesIQ
              </a>
              <a
                href="https://cendien.monday.com/boards/18004940852"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#3a3d5c] hover:text-gray-900 dark:hover:text-white"
              >
                Monday
              </a>
              <a
                href="https://rag.cendien.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#3a3d5c] hover:text-gray-900 dark:hover:text-white"
              >
                RAG
              </a>
            </nav>
            <ActivityNotificationDropdown onViewAll={handleShowLogs} />
            <ThemeToggle />
            <IconButton
              onClick={handleLogout}
              tooltipContent="Logout"
              kind="tertiary"
              size="small"
              icon={() => (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              )}
              className="text-gray-600 dark:text-[#9699a6] hover:text-gray-900 dark:hover:text-white"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {viewMode === 'jobs' ? (
          <>
            {/* Job List Sidebar - Responsive width */}
            <div className="flex-shrink-0 basis-[60%] sm:basis-[52%] md:basis-[42%] lg:flex-[0_0_32%] xl:flex-[0_0_30%] 2xl:flex-[0_0_27%] min-w-[19rem] bg-white dark:bg-[#30324e] border-r border-gray-200 dark:border-[#4b4e69]">
              <JobList
                jobs={jobs}
                selectedJob={selectedJob}
                onJobSelect={(job) => {
                  setSelectedJob(job);
                  setShowLogs(false);
                }}
                onJobCreated={handleJobCreated}
                onJobDeleted={handleJobDeleted}
              />
            </div>

            {/* Job Detail Main Content - Takes remaining space */}
            <div className="flex-1 bg-gray-50 dark:bg-[#181b34] overflow-y-auto">
              <div className="p-6">
                {selectedJob ? (
                  <JobDetail job={selectedJob} onJobUpdated={handleJobUpdated} />
                ) : (
                  <ActivityLogs />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Candidate Sidebar - Responsive width */}
            <div className="flex-shrink-0 basis-[60%] sm:basis-[52%] md:basis-[42%] lg:flex-[0_0_32%] xl:flex-[0_0_30%] 2xl:flex-[0_0_27%] min-w-[19rem] bg-white dark:bg-[#30324e] border-r border-gray-200 dark:border-[#4b4e69]">
              <CandidateSidebar
                candidates={candidates}
                selectedCandidate={selectedGroupedCandidate}
                onCandidateSelect={(candidate) => {
                  setSelectedGroupedCandidate(candidate);
                }}
                loading={candidatesLoading}
              />
            </div>

            {/* Candidate Detail Main Content - Takes remaining space */}
            <div className="flex-1 bg-gray-50 dark:bg-[#181b34] overflow-y-auto">
              <div className="p-6">
                {candidatesError ? (
                  <div className="text-center py-12">
                    <div className="text-red-600 dark:text-red-400 mb-4">{candidatesError}</div>
                    <Button
                      onClick={loadCandidates}
                      kind="primary"
                      size="small"
                    >
                      Retry
                    </Button>
                  </div>
                ) : selectedGroupedCandidate ? (
                  <CandidateDashboardView
                    groupedCandidate={selectedGroupedCandidate}
                    jobs={jobs}
                    onJobSelect={handleJobSelectFromCandidateView}
                    onCandidateDeleted={handleCandidateDeleted}
                  />
                ) : (
                  <div className="text-center py-12">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400 dark:text-[#9699a6]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">Select a Candidate</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">
                      Choose a candidate from the sidebar to view their resumes, jobs, and verification details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

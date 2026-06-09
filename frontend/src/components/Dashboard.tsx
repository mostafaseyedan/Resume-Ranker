import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Job, JobListItem, MondayBoardGroup, Candidate, apiService } from '../services/apiService';
import JobList from './JobList';
import JobDetail from './JobDetail';
import CandidateSidebar from './CandidateSidebar';
import CandidateDashboardView from './CandidateDashboardView';
import ActivityLogs from './ActivityLogs';
import ActivityNotificationDropdown from './ActivityNotificationDropdown';
import SidebarViewTabs from './SidebarViewTabs';
import { DetailPanelSkeleton } from './Skeletons';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import CendienAppsNav from './CendienAppsNav';
import { useAuth } from '../hooks/useAuth';
import { useMsal } from '@azure/msal-react';
import { Button, IconButton } from '@vibe/core';
import '@vibe/core/tokens';
import { cn } from '@/lib/utils';
import { MondayColorStyles } from '../lib/mondayColors';
import { groupCandidatesByName, type GroupedCandidate } from '@/utils/groupCandidates';

type MobilePanel = 'list' | 'detail';

function jobToListItem(job: Job): JobListItem {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    created_at: job.created_at,
    created_by: job.created_by,
    monday_id: job.monday_id,
    has_job_details: Boolean(job.description || job.extracted_data),
    monday_metadata: job.monday_metadata,
  };
}

const Dashboard: React.FC = () => {
  // View mode state
  const [viewMode, setViewMode] = useState<'jobs' | 'candidates'>('jobs');

  // Jobs state
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [boardGroups, setBoardGroups] = useState<MondayBoardGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobLoading, setSelectedJobLoading] = useState(false);
  const [jobDetailInitialTab, setJobDetailInitialTab] = useState<'candidates' | 'job-details'>('job-details');
  const [showLogs, setShowLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesFetched, setCandidatesFetched] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedGroupedCandidate, setSelectedGroupedCandidate] = useState<GroupedCandidate | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list');

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { instance } = useMsal();

  const jobsCount = !jobsLoading || jobs.length > 0 ? jobs.length : null;
  const groupedCandidates = useMemo(
    () => groupCandidatesByName(candidates),
    [candidates]
  );
  const candidatesCount = candidatesFetched ? groupedCandidates.length : null;

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
      setCandidatesFetched(true);
    }
  };

  const refreshJobSummaries = async () => {
    const response = await apiService.getJobSummaries();
    setJobs(response.jobs);
  };

  const syncJobsInBackground = () => {
    apiService
      .syncJobsFromMonday()
      .then(async (syncResponse) => {
        if (syncResponse.synced_jobs?.length > 0) {
          toast.success(`Synced ${syncResponse.synced_jobs.length} jobs from Monday.com`);
        }
        await refreshJobSummaries();
        try {
          const groupsResponse = await apiService.getBoardGroups();
          setBoardGroups(groupsResponse.groups || []);
        } catch (groupsErr) {
          console.warn('Board groups refresh failed:', groupsErr);
        }
      })
      .catch((syncErr) => {
        console.warn('Monday sync failed:', syncErr);
      });
  };

  const loadJobs = async () => {
    setGroupsLoading(true);
    setJobsLoading(true);
    setError(null);

    const groupsPromise = apiService
      .getBoardGroups()
      .then((response) => {
        setBoardGroups(response.groups || []);
      })
      .catch((err) => {
        console.warn('Board groups unavailable:', err);
        setBoardGroups([]);
      })
      .finally(() => {
        setGroupsLoading(false);
      });

    const jobsPromise = refreshJobSummaries()
      .catch((err: any) => {
        setError('Failed to load jobs: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => {
        setJobsLoading(false);
      });

    await Promise.allSettled([groupsPromise, jobsPromise]);
    syncJobsInBackground();
  };

  const handleJobSelect = async (job: JobListItem) => {
    setJobDetailInitialTab('job-details');
    setShowLogs(false);
    openMobileDetail();
    setSelectedJobLoading(true);
    setSelectedJob(job as Job);

    try {
      const response = await apiService.getJob(job.id);
      setSelectedJob(response.job);
    } catch (err) {
      console.error('Failed to load job details:', err);
    } finally {
      setSelectedJobLoading(false);
    }
  };

  const handleJobCreated = (newJob: Job) => {
    setJobs((prevJobs) => [jobToListItem(newJob), ...prevJobs]);
  };

  const handleJobGenerated = (newJob: Job) => {
    setJobs((prevJobs) => [jobToListItem(newJob), ...prevJobs]);
    setSelectedJob(newJob);
    setJobDetailInitialTab('job-details');
    setShowLogs(false);
    setMobilePanel('detail');
  };

  const handleJobUpdated = (updatedJob: Job) => {
    const summary = jobToListItem(updatedJob);
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === updatedJob.id ? summary : job
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
    setMobilePanel('detail');
  };

  const handleViewModeToggle = (mode: 'jobs' | 'candidates') => {
    setViewMode(mode);
    setMobilePanel('list');
    // Reset selections when switching views
    if (mode === 'jobs') {
      setSelectedGroupedCandidate(null);
    } else {
      setSelectedJob(null);
      setShowLogs(false);
    }
  };

  const openMobileDetail = () => setMobilePanel('detail');

  const handleMobileBack = () => {
    setMobilePanel('list');
    if (viewMode === 'jobs') {
      setSelectedJob(null);
      setShowLogs(false);
    } else {
      setSelectedGroupedCandidate(null);
    }
  };

  const showMobileBack =
    mobilePanel === 'detail' &&
    (viewMode === 'jobs'
      ? selectedJob !== null || showLogs
      : selectedGroupedCandidate !== null);

  const mobileBackLabel =
    viewMode === 'jobs'
      ? selectedJob
        ? 'Jobs'
        : 'Activity'
      : 'Candidates';

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

  const handleJobSelectFromCandidateView = async (job: JobListItem) => {
    setViewMode('jobs');
    setSelectedGroupedCandidate(null);
    await handleJobSelect(job);
  };

  const showFatalJobsError =
    error && !groupsLoading && !jobsLoading && jobs.length === 0 && boardGroups.length === 0;

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 text-center">
          <div className="text-xl mb-2">Authentication Required</div>
          <div>Please log in to access the dashboard</div>
        </div>
      </div>
    );
  }

  if (showFatalJobsError) {
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
    <div className="h-screen bg-gray-50 dark:bg-canvas flex flex-col overflow-hidden">
      <MondayColorStyles />
      <header className="bg-white dark:bg-surface shadow-elev-1 border-b border-gray-200 dark:border-line flex-shrink-0 z-10">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0 flex items-center gap-5">
            {/* Brand lockup */}
            <BrandLogo size={32} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <CendienAppsNav />
            <div className="hidden h-6 w-px bg-gray-200 dark:bg-line sm:block" />
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
              className="text-gray-600 dark:text-ink-muted hover:text-gray-900 dark:hover:text-white"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar: full-width list on mobile; fixed fraction from lg up. */}
        <div
          className={cn(
            'flex flex-col min-h-0 bg-white dark:bg-surface border-r border-gray-200 dark:border-line',
            'w-full lg:flex-shrink-0 lg:min-w-[19rem] lg:flex-[0_0_32%] xl:flex-[0_0_30%] 2xl:flex-[0_0_27%]',
            mobilePanel === 'detail' ? 'hidden lg:flex' : 'flex flex-1 lg:flex-none'
          )}
        >
          <SidebarViewTabs
            value={viewMode}
            onChange={handleViewModeToggle}
            jobsCount={jobsCount}
            candidatesCount={candidatesCount}
            candidatesLoading={candidatesLoading}
          />

          <div
            className="flex-1 min-h-0 flex flex-col"
            role="tabpanel"
            id={`sidebar-panel-${viewMode}`}
            aria-labelledby={`sidebar-tab-${viewMode}`}
          >
            {viewMode === 'jobs' ? (
              <JobList
                jobs={jobs}
                boardGroups={boardGroups}
                groupsLoading={groupsLoading}
                jobsLoading={jobsLoading}
                selectedJob={selectedJob}
                onJobSelect={handleJobSelect}
                onJobCreated={handleJobCreated}
                onJobGenerated={handleJobGenerated}
              />
            ) : (
              <CandidateSidebar
                groupedCandidates={groupedCandidates}
                selectedCandidate={selectedGroupedCandidate}
                onCandidateSelect={(candidate) => {
                  setSelectedGroupedCandidate(candidate);
                  openMobileDetail();
                }}
                loading={candidatesLoading}
              />
            )}
          </div>
        </div>

        {/* Main content: hidden on mobile until a job/candidate/activity is opened */}
        <div
          className={cn(
            'flex-1 min-h-0 bg-gray-50 dark:bg-canvas overflow-y-auto',
            mobilePanel === 'list' ? 'hidden lg:block' : 'block w-full'
          )}
        >
          {showMobileBack && (
            <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-gray-200 dark:border-line bg-white dark:bg-surface px-4 py-2.5 lg:hidden">
              <button
                type="button"
                onClick={handleMobileBack}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-700 dark:text-ink hover:bg-gray-100 dark:hover:bg-surface-hover"
                aria-label={`Back to ${mobileBackLabel}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {mobileBackLabel}
              </button>
            </div>
          )}
          <div className="p-4 sm:p-6">
            {viewMode === 'jobs' ? (
              selectedJobLoading ? (
                <DetailPanelSkeleton />
              ) : selectedJob ? (
                <JobDetail key={selectedJob.id + jobDetailInitialTab} job={selectedJob} onJobUpdated={handleJobUpdated} initialTab={jobDetailInitialTab} />
              ) : (
                <ActivityLogs />
              )
            ) : candidatesError ? (
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
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-ink-muted"
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
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-ink">Select a Candidate</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-ink-muted">
                  Choose a candidate from the sidebar to view their resumes, jobs, and verification details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

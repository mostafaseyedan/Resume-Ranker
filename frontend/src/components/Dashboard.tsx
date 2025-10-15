import React, { useState, useEffect } from 'react';
import { Job, apiService } from '../services/apiService';
import JobList from './JobList';
import JobDetail from './JobDetail';
import ActivityLogs from './ActivityLogs';
import { useAuth } from '../hooks/useAuth';
import { useMsal } from '@azure/msal-react';

const Dashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { instance } = useMsal();

  useEffect(() => {
    if (isAuthenticated) {
      loadJobs();
    }
  }, [isAuthenticated]);

  const loadJobs = async () => {
    try {
      setLoading(true);
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
          <button
            onClick={loadJobs}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Resume Evaluator</h1>
            </div>
            <div className="flex space-x-10 text-sm">
              <a href="http://www.reconrfp.cendien.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-800">Recon</a>
              <a href="http://sales.cendien.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-800">RFP Analyzer</a>
              <a href="http://rag.cendien.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-800">Cendien RAG</a>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Job List Sidebar - Fixed width, flush left */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex-shrink-0">
          <JobList
            jobs={jobs}
            selectedJob={selectedJob}
            onJobSelect={(job) => {
              setSelectedJob(job);
              setShowLogs(false);
            }}
            onJobCreated={handleJobCreated}
            onJobDeleted={handleJobDeleted}
            onShowLogs={handleShowLogs}
          />
        </div>

        {/* Job Detail Main Content - Takes remaining space */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          <div className="p-6">
            {selectedJob ? (
              <JobDetail job={selectedJob} onJobUpdated={handleJobUpdated} />
            ) : (
              <ActivityLogs />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
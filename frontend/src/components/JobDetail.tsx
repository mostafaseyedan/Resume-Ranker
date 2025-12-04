import React, { useState, useEffect } from 'react';
import { Job, JobExtractedData, Candidate, apiService } from '../services/apiService';
import ResumeUpload from './ResumeUpload';
import CandidateList from './CandidateList';
import CandidateDetail from './CandidateDetail';
import CandidatesGroupedList from './CandidatesGroupedList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface JobDetailProps {
  job: Job;
  onJobUpdated?: (updatedJob: Job) => void;
}

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

const JobDetail: React.FC<JobDetailProps> = ({ job, onJobUpdated }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedCandidateName, setSelectedCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'resumes' | 'files' | 'job-details' | 'potential-candidates'>('candidates');
  const [sharepointFiles, setSharepointFiles] = useState<{ job_files: any[]; resume_files: any[]; sharepoint_link: string } | null>(null);
  const [loadingSharePoint, setLoadingSharePoint] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [processingFileType, setProcessingFileType] = useState<'job' | 'resume' | null>(null);
  const [fileProgress, setFileProgress] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [potentialCandidates, setPotentialCandidates] = useState<Array<{filename: string; sharepoint_url: string | null; download_url: string | null}>>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);

  useEffect(() => {
    loadCandidates();
    setSelectedCandidate(null); // Reset selected candidate when job changes
    setSelectedCandidateName(null); // Reset selected candidate name when job changes
    setSharepointFiles(null);
    setSuccessMessage(null);
    setProcessingFile(null);

    // Reset and load potential candidates from job if available
    setPotentialCandidates([]);
    setGeminiResponse(null);
    setSearchError(null);

    if ((job as any).potential_candidates) {
      setPotentialCandidates((job as any).potential_candidates);
    }

    // Load gemini response from job if available
    if ((job as any).potential_candidates_gemini_response) {
      setGeminiResponse((job as any).potential_candidates_gemini_response);
    }

    // Load SharePoint files if available
    if ((job as any).monday_metadata?.sharepoint_link) {
      loadSharePointFiles();
    }
  }, [job.id]);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const response = await apiService.getJobCandidates(job.id);
      setCandidates(response.candidates);
      setError(null);
    } catch (err: any) {
      setError('Failed to load candidates: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUploaded = (newCandidate: Candidate) => {
    setCandidates(prevCandidates => [newCandidate, ...prevCandidates]);
    setActiveTab('candidates'); // Switch back to candidates view
  };

  const handleCandidateSelect = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleCandidateNameSelect = (candidateName: string) => {
    setSelectedCandidateName(candidateName);
  };

  const handleBackToCandidates = () => {
    setSelectedCandidate(null);
  };

  const handleBackToCandidatesList = () => {
    setSelectedCandidateName(null);
  };

  const handleCandidateDeleted = (candidateId: string) => {
    setCandidates(prevCandidates => prevCandidates.filter(candidate => candidate.id !== candidateId));
    // Clear selected candidate if it was deleted
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate(null);
    }
  };

  const loadSharePointFiles = async () => {
    const currentJobId = job.id;
    try {
      setLoadingSharePoint(true);
      const response = await apiService.getJobSharePointFiles(job.id);
      if (currentJobId !== job.id) {
        return;
      }
      if (response.success) {
        setSharepointFiles(response);
      } else {
        setSharepointFiles(null);
      }
    } catch (err: any) {
      console.error('Failed to load SharePoint files:', err);
      if (currentJobId === job.id) {
        setSharepointFiles(null);
      }
      // Don't show error if SharePoint is just not available
    } finally {
      if (currentJobId === job.id) {
        setLoadingSharePoint(false);
      }
    }
  };

  const handleProcessJobFile = async (downloadUrl: string, fileName: string) => {
    let progressInterval: NodeJS.Timeout | null = null;
    try {
      setProcessingFile(fileName);
      setProcessingFileType('job');
      setFileProgress(0);
      setSuccessMessage(null);

      // Simulate progress
      progressInterval = setInterval(() => {
        setFileProgress(prev => Math.min(prev + 2, 90));
      }, 500);

      const response = await apiService.processSharePointJobFile(downloadUrl, fileName, job.id);

      if (progressInterval) clearInterval(progressInterval);
      setFileProgress(100);
      if (response.success) {
        // Refetch the updated job data
        const updatedJobResponse = await apiService.getJob(job.id);

        // Update the job in parent state
        if (onJobUpdated) {
          onJobUpdated(updatedJobResponse.job);
        }

        // Optionally refresh SharePoint files
        if (activeTab === 'files') {
          await loadSharePointFiles();
        }

        // Show success message inline
        setSuccessMessage(`Job file "${fileName}" processed successfully! The job description has been updated.`);

        // Switch to job-details tab to show the updated information
        setActiveTab('job-details');

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      setSuccessMessage(`Failed to process "${fileName}": ${err.response?.data?.error || err.message}`);
      setTimeout(() => setSuccessMessage(null), 8000);
    } finally {
      setProcessingFile(null);
      setProcessingFileType(null);
      setTimeout(() => setFileProgress(0), 1000);
    }
  };

  const handleProcessResumeFile = async (downloadUrl: string, fileName: string, fileId?: string, siteId?: string, driveId?: string) => {
    let progressInterval: NodeJS.Timeout | null = null;
    try {
      setProcessingFile(fileName);
      setProcessingFileType('resume');
      setFileProgress(0);
      setSuccessMessage(null);

      // Simulate progress
      progressInterval = setInterval(() => {
        setFileProgress(prev => Math.min(prev + 2, 90));
      }, 500);

      // Download the SharePoint resume file with metadata for URL refresh
      const response = await apiService.downloadSharePointFile(downloadUrl, true, fileId, siteId, driveId);
      if (!response.success) {
        throw new Error('Failed to download file from SharePoint');
      }

      // Convert to File object
      const content = atob(response.content);
      const bytes = new Uint8Array(content.length);
      for (let i = 0; i < content.length; i++) {
        bytes[i] = content.charCodeAt(i);
      }

      const mimeType = fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' :
                      fileName.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                      fileName.toLowerCase().endsWith('.doc') ? 'application/msword' : 'application/pdf';

      const blob = new Blob([bytes], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });

      // Upload as resume
      const uploadResponse = await apiService.uploadResume(job.id, file);

      if (progressInterval) clearInterval(progressInterval);
      setFileProgress(100);

      if (uploadResponse.success) {
        // Create candidate object to match expected format
        const candidateData: Candidate = {
          id: uploadResponse.candidate_id,
          name: uploadResponse.analysis.candidate_name || fileName.split('.')[0],
          email: uploadResponse.analysis.candidate_email || '',
          phone: uploadResponse.analysis.candidate_phone || '',
          resume_filename: fileName,
          job_id: job.id,
          overall_score: uploadResponse.analysis.overall_score,
          summary: uploadResponse.analysis.summary,
          strengths: uploadResponse.analysis.strengths,
          weaknesses: uploadResponse.analysis.weaknesses,
          skill_analysis: uploadResponse.analysis.skill_analysis,
          experience_match: uploadResponse.analysis.experience_match,
          education_match: uploadResponse.analysis.education_match,
          uploaded_by: 'sharepoint',
          created_at: new Date().toISOString(),
        };

        handleResumeUploaded(candidateData);
        setSuccessMessage(`Resume file "${fileName}" processed successfully! New candidate added.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      setSuccessMessage(`Failed to process resume "${fileName}": ${err.response?.data?.error || err.message}`);
      setTimeout(() => setSuccessMessage(null), 8000);
    } finally {
      setProcessingFile(null);
      setProcessingFileType(null);
      setTimeout(() => setFileProgress(0), 1000);
    }
  };

  const handleSearchPotentialCandidates = async () => {
    try {
      setSearchingCandidates(true);
      setSearchError(null);
      setGeminiResponse(null);

      const response = await apiService.searchPotentialCandidates(job.id);

      if (response.success) {
        setPotentialCandidates(response.candidates || []);
        setGeminiResponse(response.response_text || null);
        if (response.candidates.length === 0) {
          setSearchError('No matching candidates found in the knowledge base');
        }
      } else {
        setSearchError(response.error || 'Failed to search for potential candidates');
      }
    } catch (err: any) {
      console.error('Search potential candidates error:', err);
      setSearchError(err.response?.data?.error || err.message || 'Failed to search for potential candidates');
    } finally {
      setSearchingCandidates(false);
    }
  };

  const handleSkillClick = async (skill: string) => {
    try {
      toast.loading(`Searching for candidates with "${skill}"...`, { id: 'skill-search' });

      const response = await apiService.searchBySkill(job.id, skill);

      if (response.success && response.response_text) {
        toast.success(
          <div className="max-w-md">
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({children, ...props}) => (
                    <p className="my-1 whitespace-pre-wrap" {...props}>
                      {children}
                    </p>
                  ),
                }}
              >
                {response.response_text}
              </ReactMarkdown>
            </div>
          </div>,
          { id: 'skill-search', duration: Infinity }
        );
      } else {
        toast.error(response.error || 'No candidates found', { id: 'skill-search', duration: Infinity });
      }
    } catch (err: any) {
      console.error('Search by skill error:', err);
      toast.error('Failed to search for candidates', { id: 'skill-search', duration: Infinity });
    }
  };

  if (selectedCandidate) {
    return (
      <CandidateDetail
        candidate={selectedCandidate}
        onBack={handleBackToCandidates}
        job={job}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
            <div className="flex items-center mt-2 space-x-4">
              {(job.monday_metadata?.status || job.status) && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    getReqStatusColor(job.monday_metadata?.status || job.status || '')
                  }`}
                >
                  {job.monday_metadata?.status || job.status}
                </span>
              )}
              {job.monday_metadata?.work_mode && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {job.monday_metadata.work_mode}
                </span>
              )}
              {job.monday_metadata?.employment_type && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {job.monday_metadata.employment_type}
                </span>
              )}
              {job.monday_metadata?.open_date && (
                <span className="text-xs text-gray-500">
                  Open: {job.monday_metadata.open_date}
                </span>
              )}
              {job.monday_metadata?.close_date && (
                <span className="text-xs text-gray-500">
                  Close: {job.monday_metadata.close_date}
                </span>
              )}
              {!job.monday_metadata?.open_date && !job.monday_metadata?.close_date && (
                <span className="text-xs text-gray-500">
                  Created: {new Date(job.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{candidates.length}</div>
            <div className="text-sm text-gray-500">Candidate{candidates.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          <button
            onClick={() => {
              setActiveTab('files');
              if (!sharepointFiles && !loadingSharePoint) {
                loadSharePointFiles();
              }
            }}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'files'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => {
              setActiveTab('candidates');
              setSelectedCandidateName(null);
            }}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'candidates'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Candidates
          </button>
          <button
            onClick={() => setActiveTab('resumes')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'resumes'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Resumes ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('potential-candidates')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'potential-candidates'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Internal Candidates
          </button>
          <button
            onClick={() => {
              setActiveTab('job-details');
              if (!sharepointFiles && !loadingSharePoint) {
                loadSharePointFiles();
              }
            }}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'job-details'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Job Details
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'candidates' && (
          <div>
            {loading ? (
              <div className="text-center py-8">
                <div className="text-lg">Loading candidates...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                <div className="text-lg mb-2">Error</div>
                <div>{error}</div>
                <button
                  onClick={loadCandidates}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : selectedCandidateName ? (
              <div>
                <button
                  onClick={handleBackToCandidatesList}
                  className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Candidates
                </button>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Resumes for {selectedCandidateName}
                </h3>
                <CandidateList
                  candidates={candidates.filter(c =>
                    (c.name || '').toLowerCase().trim() === selectedCandidateName.toLowerCase().trim()
                  )}
                  onCandidateSelect={handleCandidateSelect}
                  onCandidateDeleted={handleCandidateDeleted}
                  sharepointFiles={sharepointFiles}
                />
              </div>
            ) : (
              <CandidatesGroupedList
                candidates={candidates}
                onCandidateSelect={handleCandidateNameSelect}
              />
            )}
          </div>
        )}

        {activeTab === 'resumes' && (
          <div>
            {loading ? (
              <div className="text-center py-8">
                <div className="text-lg">Loading resumes...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                <div className="text-lg mb-2">Error</div>
                <div>{error}</div>
                <button
                  onClick={loadCandidates}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <CandidateList
                candidates={candidates}
                onCandidateSelect={handleCandidateSelect}
                onCandidateDeleted={handleCandidateDeleted}
                sharepointFiles={sharepointFiles}
              />
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6">
            {/* SharePoint Files Section */}
            {(job as any).monday_metadata?.sharepoint_link && (
              <div>
                {loadingSharePoint ? (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span className="text-blue-700">Loading SharePoint files...</span>
                    </div>
                  </div>
                ) : sharepointFiles ? (
                  <div className="space-y-4">
                    {/* All Files - Single List */}
                    {(() => {
                      const allFiles = [
                        ...(sharepointFiles.job_files || []),
                        ...(sharepointFiles.resume_files || [])
                      ];

                      // Remove duplicates based on file name
                      const uniqueFiles = allFiles.filter((file, index, self) =>
                        index === self.findIndex((f) => f.name === file.name)
                      );

                      return uniqueFiles.length > 0 ? (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-3">SharePoint Files</h4>
                          <div className="space-y-2">
                            {uniqueFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                                <div className="flex items-center space-x-2 flex-1">
                                  <span className="text-gray-600"></span>
                                  <div className="flex-1">
                                    <a
                                      href={file.web_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {file.name}
                                    </a>
                                    <div className="text-xs text-gray-500">
                                      {file.path} • {Math.round(file.size / 1024)} KB
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  {processingFile === file.name ? (
                                    <div className={`flex items-center rounded px-3 py-1 space-x-2 ${processingFileType === 'job' ? 'bg-green-600' : 'bg-blue-600'}`} style={{ minWidth: '200px' }}>
                                      <div className={`flex-1 rounded overflow-hidden ${processingFileType === 'job' ? 'bg-green-600' : 'bg-blue-600'}`} style={{ height: '8px' }}>
                                        <div
                                          className="h-full bg-white transition-all duration-500"
                                          style={{ width: `${fileProgress}%` }}
                                        />
                                      </div>
                                      <div className="text-xs text-white whitespace-nowrap">{fileProgress}%</div>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleProcessJobFile(file.download_url, file.name)}
                                        disabled={processingFile !== null}
                                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                      >
                                        <span>Job Description</span>
                                      </button>
                                      <button
                                        onClick={() => handleProcessResumeFile(file.download_url, file.name, file.id, file.site_id, file.drive_id)}
                                        disabled={processingFile !== null}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                      >
                                        <span>Resume</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                          No files found in SharePoint folder
                        </div>
                      );
                    })()}

                    <div className="text-xs text-gray-500 mt-2">
                      <a href={sharepointFiles.sharepoint_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Open SharePoint folder
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <button
                      onClick={loadSharePointFiles}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Load SharePoint files →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resume Upload Section */}
            <div>
              <ResumeUpload
                job={job}
                onResumeUploaded={handleResumeUploaded}
              />
            </div>
          </div>
        )}

        {activeTab === 'job-details' && (
          <div className="space-y-6">
            {/* Success/Error Message */}
            {successMessage && (
              <div className={`p-4 rounded-lg border ${
                successMessage.startsWith('Failed')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                <p className="text-sm font-medium">{successMessage}</p>
              </div>
            )}

            {/* Job Description */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3"> Job Description</h3>
              <div className="prose prose-sm max-w-none">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="whitespace-pre-wrap text-gray-700">{job.description}</p>
                </div>
              </div>
            </div>


            {/* Structured Data from PDF Extraction */}
            {job.extracted_data && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Required Skills */}
                {job.extracted_data.required_skills && job.extracted_data.required_skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Required Skills
                    </h3>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.required_skills.map((skill, index) => (
                          <button
                            key={index}
                            onClick={() => handleSkillClick(skill)}
                            className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full hover:bg-red-200 hover:shadow-sm transition-all cursor-pointer"
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preferred Skills */}
                {job.extracted_data.preferred_skills && job.extracted_data.preferred_skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Preferred Skills
                    </h3>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.preferred_skills.map((skill, index) => (
                          <button
                            key={index}
                            onClick={() => handleSkillClick(skill)}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full hover:bg-blue-200 hover:shadow-sm transition-all cursor-pointer"
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Experience Requirements */}
                {job.extracted_data.experience_requirements && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Experience Requirements
                    </h3>
                    <div
                      className="bg-green-50 p-4 rounded-lg cursor-pointer hover:bg-green-100 hover:shadow-sm transition-all"
                      onClick={() => handleSkillClick(job.extracted_data.experience_requirements)}
                    >
                      <p className="text-gray-700">{job.extracted_data.experience_requirements}</p>
                    </div>
                  </div>
                )}

                {/* Education Requirements */}
                {job.extracted_data.education_requirements && job.extracted_data.education_requirements.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Education Requirements
                    </h3>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <ul className="list-disc list-inside space-y-1">
                        {job.extracted_data.education_requirements.map((edu, index) => (
                          <li
                            key={index}
                            onClick={() => handleSkillClick(edu)}
                            className="text-gray-700 cursor-pointer hover:text-purple-800 hover:font-medium transition-all"
                          >
                            {edu}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {job.extracted_data.certifications && job.extracted_data.certifications.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Certifications
                    </h3>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.certifications.map((cert, index) => (
                          <button
                            key={index}
                            onClick={() => handleSkillClick(cert)}
                            className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full hover:bg-yellow-200 hover:shadow-sm transition-all cursor-pointer"
                          >
                            {cert}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Responsibilities */}
                {job.extracted_data.key_responsibilities && job.extracted_data.key_responsibilities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Key Responsibilities
                    </h3>
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <ul className="list-disc list-inside space-y-2">
                        {job.extracted_data.key_responsibilities.map((responsibility, index) => (
                          <li key={index} className="text-gray-700">{responsibility}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Soft Skills */}
                {job.extracted_data.soft_skills && job.extracted_data.soft_skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Soft Skills
                    </h3>
                    <div className="bg-pink-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.soft_skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-pink-100 text-pink-800 text-sm font-medium rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Other Information */}
                {job.extracted_data.other && job.extracted_data.other.length > 0 && (
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      Additional Information
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <ul className="list-disc list-inside space-y-1">
                        {job.extracted_data.other.map((item, index) => (
                          <li key={index} className="text-gray-700">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* AI Generated Analysis */}
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Analysis</h2>

              {/* Traditional Requirements */}
              {job.requirements && Object.keys(job.requirements).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Requirements Analysis</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    {Object.entries(job.requirements).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row">
                        <span className="font-medium text-gray-600 capitalize sm:w-32 mb-1 sm:mb-0">
                          {key.replace('_', ' ')}:
                        </span>
                        <span className="text-gray-700">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skill Weights */}
              {job.skill_weights && Object.keys(job.skill_weights).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Skill Importance Weights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(job.skill_weights).map(([skill, weight]) => (
                      <div key={skill} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">{skill}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(Number(weight) / 10) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-gray-600 min-w-[40px]">{weight}/10</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'potential-candidates' && (
          <div>
            {potentialCandidates.length === 0 && !searchingCandidates && !searchError ? (
              <div className="text-center py-16 px-4">
                <div className="mb-6">
                  <div className="mx-auto h-24 w-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                    <svg className="h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Discover Internal Candidates</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Let AI search through the knowledge base to find candidates whose skills and experience match this position
                </p>
                <button
                  onClick={handleSearchPotentialCandidates}
                  disabled={!job.description}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {!job.description ? 'Add Job Description First' : 'Start AI Search'}
                </button>
              </div>
            ) : (
              <div>
                {searchingCandidates ? (
                  <div className="text-center py-16">
                    <div className="relative mb-6">
                      <div className="animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Searching Knowledge Base</h4>
                    <p className="text-gray-600">AI is analyzing resumes to find the best matches...</p>
                  </div>
                ) : searchError ? (
                  <div className="text-center py-12">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                      <p className="text-red-800 mb-4">{searchError}</p>
                      <button
                        onClick={handleSearchPotentialCandidates}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">Internal Candidates</h3>
                      <button
                        onClick={handleSearchPotentialCandidates}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Refresh search"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    {geminiResponse && (
                      <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="prose prose-sm max-w-none text-gray-700">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              ol: ({node, ...props}) => (
                                <ol className="list-decimal list-outside ml-6 space-y-4 my-4" {...props} />
                              ),
                              ul: ({node, ...props}) => (
                                <ul className="list-disc list-outside ml-6 space-y-2 my-4" {...props} />
                              ),
                              li: ({node, ...props}) => (
                                <li className="pl-2" {...props} />
                              ),
                              p: ({node, ...props}) => (
                                <p className="my-2" {...props} />
                              ),
                              strong: ({node, ...props}) => (
                                <strong className="font-bold text-gray-900" {...props} />
                              ),
                              table: ({node, ...props}) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                                </div>
                              ),
                              thead: ({node, ...props}) => (
                                <thead className="bg-gray-100" {...props} />
                              ),
                              tbody: ({node, ...props}) => (
                                <tbody className="divide-y divide-gray-200 bg-white" {...props} />
                              ),
                              tr: ({node, ...props}) => (
                                <tr className="hover:bg-gray-50" {...props} />
                              ),
                              th: ({node, ...props}) => (
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900 border-r border-gray-300 last:border-r-0" {...props} />
                              ),
                              td: ({node, ...props}) => (
                                <td className="px-4 py-2 text-sm text-gray-700 border-r border-gray-300 last:border-r-0" {...props} />
                              ),
                            }}
                          >
                            {geminiResponse}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="space-y-2">
                        {potentialCandidates.map((candidate, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                            <div className="flex items-center space-x-2 flex-1">
                              <span className="text-gray-600"></span>
                              <div className="flex-1">
                                {candidate.sharepoint_url ? (
                                  <a
                                    href={candidate.sharepoint_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {candidate.filename}
                                  </a>
                                ) : (
                                  <span className="text-sm font-medium text-gray-700">{candidate.filename}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              {candidate.download_url && (
                                processingFile === candidate.filename ? (
                                  <div className="flex items-center rounded px-3 py-1 space-x-2 bg-blue-600" style={{ minWidth: '200px' }}>
                                    <div className="flex-1 rounded overflow-hidden bg-blue-600" style={{ height: '8px' }}>
                                      <div
                                        className="h-full bg-white transition-all duration-500"
                                        style={{ width: `${fileProgress}%` }}
                                      />
                                    </div>
                                    <div className="text-xs text-white whitespace-nowrap">{fileProgress}%</div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleProcessResumeFile(candidate.download_url!, candidate.filename, (candidate as any).id, (candidate as any).site_id, (candidate as any).drive_id)}
                                    disabled={processingFile !== null}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                  >
                                    <span>Analyze</span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetail;

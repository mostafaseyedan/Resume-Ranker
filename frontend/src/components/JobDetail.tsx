import React, { useState, useEffect } from 'react';
import { Job, JobExtractedData, Candidate, apiService } from '../services/apiService';
import ResumeUpload from './ResumeUpload';
import CandidateList from './CandidateList';
import CandidateDetail from './CandidateDetail';

interface JobDetailProps {
  job: Job;
  onJobUpdated?: (updatedJob: Job) => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onJobUpdated }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'files' | 'job-details'>('candidates');
  const [sharepointFiles, setSharepointFiles] = useState<{ job_files: any[]; resume_files: any[]; sharepoint_link: string } | null>(null);
  const [loadingSharePoint, setLoadingSharePoint] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCandidates();
    setSelectedCandidate(null); // Reset selected candidate when job changes
    setSharepointFiles(null);
    setSuccessMessage(null);
    setProcessingFile(null);
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

  const handleBackToCandidates = () => {
    setSelectedCandidate(null);
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
    try {
      setProcessingFile(fileName);
      setSuccessMessage(null);

      const response = await apiService.processSharePointJobFile(downloadUrl, fileName, job.id);
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
        setSuccessMessage(`✅ Job file "${fileName}" processed successfully! The job description has been updated.`);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setSuccessMessage(`❌ Failed to process "${fileName}": ${err.response?.data?.error || err.message}`);
      setTimeout(() => setSuccessMessage(null), 8000);
    } finally {
      setProcessingFile(null);
    }
  };

  const handleProcessResumeFile = async (downloadUrl: string, fileName: string) => {
    try {
      setProcessingFile(fileName);
      setSuccessMessage(null);

      // Download the SharePoint resume file
      const response = await apiService.downloadSharePointFile(downloadUrl, true);
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
        setSuccessMessage(`✅ Resume file "${fileName}" processed successfully! New candidate added.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setSuccessMessage(`❌ Failed to process resume "${fileName}": ${err.response?.data?.error || err.message}`);
      setTimeout(() => setSuccessMessage(null), 8000);
    } finally {
      setProcessingFile(null);
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
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                job.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {job.status}
              </span>
              <span className="text-xs text-gray-500">
                Created: {new Date(job.created_at).toLocaleDateString()}
              </span>
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
            onClick={() => setActiveTab('candidates')}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === 'candidates'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Candidates ({candidates.length})
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
            ) : (
              <CandidateList
                candidates={candidates}
                onCandidateSelect={handleCandidateSelect}
                onCandidateDeleted={handleCandidateDeleted}
              />
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6">
            {/* SharePoint Files Section */}
            {(job as any).monday_metadata?.sharepoint_link && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">📁</span> SharePoint Files
                </h3>

                {loadingSharePoint ? (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span className="text-blue-700">Loading SharePoint files...</span>
                    </div>
                  </div>
                ) : sharepointFiles ? (
                  <div className="space-y-4">
                    {/* Job Description Files */}
                    {sharepointFiles.job_files && sharepointFiles.job_files.length > 0 && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-3">Files - Process as Job Description</h4>
                        <div className="space-y-2">
                          {sharepointFiles.job_files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                              <div className="flex items-center space-x-2">
                                <span className="text-green-600">📄</span>
                                <span className="text-sm font-medium">{file.name}</span>
                                <span className="text-xs text-gray-500">({Math.round(file.size / 1024)} KB)</span>
                              </div>
                              <button
                                onClick={() => handleProcessJobFile(file.download_url, file.name)}
                                disabled={processingFile === file.name}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                              >
                                {processingFile === file.name ? (
                                  <>
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                  </>
                                ) : (
                                  <span>Process with AI</span>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resume Files */}
                    {sharepointFiles.resume_files && sharepointFiles.resume_files.length > 0 && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-3">Files - Process as Resume</h4>
                        <div className="space-y-2">
                          {sharepointFiles.resume_files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                              <div className="flex items-center space-x-2">
                                <span className="text-blue-600">📄</span>
                                <span className="text-sm font-medium">{file.name}</span>
                                <span className="text-xs text-gray-500">({Math.round(file.size / 1024)} KB)</span>
                              </div>
                              <button
                                onClick={() => handleProcessResumeFile(file.download_url, file.name)}
                                disabled={processingFile === file.name}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                              >
                                {processingFile === file.name ? (
                                  <>
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                  </>
                                ) : (
                                  <span>Process with AI</span>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-2">
                      🔗 <a href={sharepointFiles.sharepoint_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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
                successMessage.startsWith('✅')
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
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
                      <span className="mr-2"></span> Required Skills
                    </h3>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.required_skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preferred Skills */}
                {job.extracted_data.preferred_skills && job.extracted_data.preferred_skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <span className="mr-2"></span> Preferred Skills
                    </h3>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.preferred_skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Experience Requirements */}
                {job.extracted_data.experience_requirements && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <span className="mr-2"></span> Experience Requirements
                    </h3>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-gray-700">{job.extracted_data.experience_requirements}</p>
                    </div>
                  </div>
                )}

                {/* Education Requirements */}
                {job.extracted_data.education_requirements && job.extracted_data.education_requirements.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <span className="mr-2"></span> Education Requirements
                    </h3>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <ul className="list-disc list-inside space-y-1">
                        {job.extracted_data.education_requirements.map((edu, index) => (
                          <li key={index} className="text-gray-700">{edu}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {job.extracted_data.certifications && job.extracted_data.certifications.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <span className="mr-2"></span> Certifications
                    </h3>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {job.extracted_data.certifications.map((cert, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full"
                          >
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Responsibilities */}
                {job.extracted_data.key_responsibilities && job.extracted_data.key_responsibilities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <span className="mr-2"></span> Key Responsibilities
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
                      <span className="mr-2"></span> Soft Skills
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
                      <span className="mr-2"></span> Additional Information
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
      </div>
    </div>
  );
};

export default JobDetail;

import React, { useState, useEffect } from 'react';
import { Job, Candidate, apiService } from '../services/apiService';

interface ResumeUploadProps {
  job: Job;
  onResumeUploaded: (candidate: Candidate) => void;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ job, onResumeUploaded }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string, duration: number = 5000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), duration);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isValidFileType(file)) {
        setSelectedFile(file);
      } else {
        showNotification('error', 'Please select a PDF or DOCX file');
      }
    }
  };

  const isValidFileType = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    return validTypes.includes(file.type) ||
           file.name.toLowerCase().endsWith('.pdf') ||
           file.name.toLowerCase().endsWith('.docx') ||
           file.name.toLowerCase().endsWith('.doc');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      showNotification('error', 'Please select a resume file');
      return;
    }

    if (!isValidFileType(selectedFile)) {
      showNotification('error', 'Please select a valid PDF or DOCX file');
      return;
    }

    try {
      setUploading(true);

      const response = await apiService.uploadResume(job.id, selectedFile);

      if (response.success) {
        // Create candidate object to match expected format
        const candidateData: Candidate = {
          id: response.candidate_id,
          name: response.analysis.candidate_name || selectedFile.name.split('.')[0],
          email: response.analysis.candidate_email || '',
          phone: response.analysis.candidate_phone || '',
          resume_filename: selectedFile.name,
          job_id: job.id,
          analysis: response.analysis,
          uploaded_by: 'current-user', // This should come from auth context
          created_at: new Date().toISOString(),
        };

        onResumeUploaded(candidateData);
        setSelectedFile(null);

        // Reset file input
        const fileInput = document.getElementById('resume-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        showNotification('success', 'Resume uploaded and analyzed successfully!');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      showNotification('error', 'Failed to upload resume: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-2xl">
      {/* Notification Banner */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg border ${
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
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-base font-medium text-gray-900 mb-2">Upload Files</h3>
        <p className="text-sm text-gray-600">
          Upload a PDF or DOCX file and our system will automatically analyze the candidate's qualifications
          against this job position: <strong>{job.title}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : selectedFile
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            {selectedFile ? (
              <div className="space-y-2">
                <div className="text-green-600">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-sm text-red-600 hover:text-red-500"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <label htmlFor="resume-file" className="cursor-pointer">
                    <span className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                      Click to upload
                    </span>
                    <span className="text-sm text-gray-500"> or drag and drop</span>
                  </label>
                  <input
                    id="resume-file"
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-xs text-gray-500">PDF, DOCX files up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        {/* SharePoint Resume Files Section */}
        {sharepointFiles && sharepointFiles.resume_files.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900"> Available Resume Files from SharePoint</h4>
              {loadingSharepoint && (
                <div className="flex items-center text-sm text-gray-500">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </div>
              )}
            </div>

            <div className="grid gap-2 max-h-40 overflow-y-auto">
              {sharepointFiles.resume_files.map((file: any, index: number) => (
                <div
                  key={index}
                  onClick={() => handleSharepointFileSelect(file)}
                  className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all duration-200 ${
                    selectedSharepointFile?.downloadUrl === file.downloadUrl
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <div className="text-red-500">
                      
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.size && `${Math.round(file.size / 1024)} KB`}
                        {file.lastModified && ` • Modified ${new Date(file.lastModified).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedSharepointFile?.downloadUrl === file.downloadUrl ? (
                      <div className="flex items-center space-x-1">
                        <div className="text-blue-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs text-blue-600 font-medium">Selected</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Click to select</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {selectedSharepointFile ? (
                  <>Click the selected file again to deselect, or upload a new file below.</>
                ) : (
                  <>Click on a resume file above to select it, or upload a new file below.</>
                )}
              </div>
              {selectedSharepointFile && (
                <button
                  type="button"
                  onClick={() => setSelectedSharepointFile(null)}
                  className="text-xs text-red-600 hover:text-red-500 font-medium"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {sharepointFiles.sharepoint_link && (
              <div className="mt-2">
                <a
                  href={sharepointFiles.sharepoint_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-500"
                >
                   Open SharePoint folder in browser
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={(!selectedFile && !selectedSharepointFile) || uploading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing Resume...
              </div>
            ) : selectedSharepointFile ? (
              'Download & Analyze Resume from SharePoint'
            ) : (
              'Upload & Analyze Resume'
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• The system analyzes the resume against job requirements</li>
          <li>• Candidate receives an overall compatibility score (0-100)</li>
          <li>• Strengths and weaknesses are identified</li>
          <li>• Improvement recommendations are generated</li>
          <li>• Results appear in the candidates list automatically</li>
        </ul>
      </div>
    </div>
  );
};

export default ResumeUpload;

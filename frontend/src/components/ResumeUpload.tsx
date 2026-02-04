import React, { useState } from 'react';
import { toast } from 'sonner';
import { Job, Candidate, apiService } from '../services/apiService';
import { Button } from '@vibe/core';
import '@vibe/core/tokens';

interface ResumeUploadProps {
  job: Job;
  onResumeUploaded: (candidate: Candidate) => void;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ job, onResumeUploaded }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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
        toast.error('Please select a PDF or DOCX file');
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
      toast.error('Please select a resume file');
      return;
    }

    if (!isValidFileType(selectedFile)) {
      toast.error('Please select a valid PDF or DOCX file');
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
          overall_score: response.analysis.overall_score,
          summary: response.analysis.summary,
          strengths: response.analysis.strengths,
          weaknesses: response.analysis.weaknesses,
          skill_analysis: response.analysis.skill_analysis,
          experience_match: response.analysis.experience_match,
          education_match: response.analysis.education_match,
          uploaded_by: 'current-user',
          created_at: new Date().toISOString(),
        };

        onResumeUploaded(candidateData);
        setSelectedFile(null);

        // Reset file input
        const fileInput = document.getElementById('resume-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        toast.success('Resume uploaded and analyzed successfully!');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Failed to upload resume: ' + (err.response?.data?.error || err.message));
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
    <div>
      <div className="mb-6">
        <h3 className="text-base font-medium text-gray-900 dark:text-[#d5d8df] mb-2">Upload Files</h3>
        <p className="text-sm text-gray-600 dark:text-[#9699a6]">
          Upload a PDF or DOCX file and our system will automatically analyze the candidate's qualifications
          against this job position: <strong>{job.title}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={`relative border-2 border-dashed p-6 transition-colors ${
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
                  <p className="text-sm font-medium text-gray-900 dark:text-[#d5d8df]">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#9699a6]">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  kind="tertiary"
                  color="negative"
                  size="xs"
                >
                  Remove file
                </Button>
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
                    <span className="text-sm text-gray-500 dark:text-[#9699a6]"> or drag and drop</span>
                  </label>
                  <input
                    id="resume-file"
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-[#9699a6]">PDF, DOCX files up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Only show button when file is selected */}
        {selectedFile && (
          <div className="flex space-x-3">
            <Button
              type="submit"
              disabled={uploading}
              loading={uploading}
              kind="primary"
              size="small"
              className="flex-1"
            >
              {uploading ? 'Analyzing Resume...' : 'Upload & Analyze Resume'}
            </Button>
          </div>
        )}
      </form>

    </div>
  );
};

export default ResumeUpload;

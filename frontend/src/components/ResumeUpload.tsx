import React, { useState } from 'react';
import { toast } from 'sonner';
import { Job, Candidate, apiService } from '../services/apiService';
import { Button } from '@vibe/core';
import { cn } from '@/lib/utils';
import { radiusSurface } from '@/lib/radius';
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
      'application/msword',
    ];
    return (
      validTypes.includes(file.type) ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.name.toLowerCase().endsWith('.doc')
    );
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div
        className={cn(
          radiusSurface,
          'border border-dashed px-4 py-3 transition-colors',
          dragActive
            ? 'border-brand bg-brand-soft/40 dark:border-brand-on-dark dark:bg-brand/10'
            : selectedFile
              ? 'border-gray-300 dark:border-line bg-gray-50 dark:bg-canvas-deep'
              : 'border-gray-300 dark:border-line bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surface-hover'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-ink">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-ink-muted">{formatFileSize(selectedFile.size)}</p>
            </div>
            <Button type="button" onClick={() => setSelectedFile(null)} kind="tertiary" size="xs">
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <label htmlFor="resume-file" className="cursor-pointer font-medium text-brand dark:text-brand-on-dark hover:underline">
              Choose file
            </label>
            <span className="text-gray-400 dark:text-ink-faint">·</span>
            <span className="text-gray-500 dark:text-ink-muted">or drop PDF/DOCX here</span>
            <input
              id="resume-file"
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {selectedFile && (
        <Button type="submit" disabled={uploading} loading={uploading} kind="primary" size="small">
          {uploading ? 'Analyzing…' : 'Upload & analyze'}
        </Button>
      )}
    </form>
  );
};

export default ResumeUpload;

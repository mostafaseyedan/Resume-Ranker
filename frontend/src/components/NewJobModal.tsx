import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, TextField, TextArea } from '@vibe/core';
import { Upload, FileText, X } from 'lucide-react';
import { Job, apiService, CreateJobRequest } from '../services/apiService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { radiusSurface, radiusControl } from '@/lib/radius';
import { tabActive, tabInactive, textLink } from '@/lib/semanticColors';

interface NewJobModalProps {
  open: boolean;
  onClose: () => void;
  onJobCreated: (job: Job) => void;
  onJobGenerated: (job: Job) => void;
}

type Mode = 'write' | 'file';

const NewJobModal: React.FC<NewJobModalProps> = ({ open, onClose, onJobCreated, onJobGenerated }) => {
  const [mode, setMode] = useState<Mode>('write');
  const [formData, setFormData] = useState<CreateJobRequest>({ title: '', description: '', status: 'active' });
  const [fileTitle, setFileTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creatingFromFile, setCreatingFromFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const busy = creating || generating || creatingFromFile;

  const reset = () => {
    setMode('write');
    setFormData({ title: '', description: '', status: 'active' });
    setFileTitle('');
    setFile(null);
    setIsDragging(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in the job title and description');
      return;
    }
    try {
      setCreating(true);
      const response = await apiService.createJob(formData);
      if (response.success) {
        const jobResponse = await apiService.getJob(response.job_id);
        onJobCreated(jobResponse.job);
        toast.success('Job created successfully');
        reset();
        onClose();
      }
    } catch (err: any) {
      toast.error('Failed to create job: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.title.trim()) return;
    try {
      setGenerating(true);
      const response = await apiService.generateJobRequisition(formData.title.trim());
      if (response.success) {
        const jobResponse = await apiService.getJob(response.job_id);
        onJobGenerated(jobResponse.job);
        toast.success('Job requisition generated successfully');
        reset();
        onClose();
      }
    } catch (err: any) {
      toast.error('Failed to generate job: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateFromFile = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    try {
      setCreatingFromFile(true);
      const response = await apiService.createJobFromPDF(fileTitle, file);
      if (response.success) {
        const jobResponse = await apiService.getJob(response.job_id);
        onJobCreated(jobResponse.job);
        toast.success('Job created from file successfully');
        reset();
        onClose();
      }
    } catch (err: any) {
      toast.error('Failed to create job from file: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreatingFromFile(false);
    }
  };

  const acceptFile = (incoming: File | null | undefined) => {
    if (!incoming) return;
    const ext = incoming.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      toast.error('Unsupported file type', { description: 'Upload a PDF, DOC, or DOCX file.' });
      return;
    }
    setFile(incoming);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col" hideClose={busy}>
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
          <DialogDescription className="mt-1">
            Write a job manually, create one from a file, or generate a requisition with AI.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3">
          {([
            { id: 'write', label: 'Write' },
            { id: 'file', label: 'From file' },
          ] as Array<{ id: Mode; label: string }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              disabled={busy}
              aria-pressed={mode === tab.id}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60',
                mode === tab.id ? tabActive : tabInactive
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {mode === 'write' ? (
            <>
              <TextField
                id="new-job-title"
                title="Job Title"
                value={formData.title}
                onChange={(value) => setFormData({ ...formData, title: value })}
                placeholder="e.g. Senior Frontend Developer"
                size="small"
                wrapperClassName="w-full"
              />
              <TextArea
                label="Job Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter detailed job description including required skills, experience, and responsibilities..."
                size="small"
                rows={8}
              />
              <p className="text-xs text-gray-500 dark:text-ink-muted">
                No description yet? Enter a title and use <span className={textLink}>Generate with AI</span> to draft a full requisition.
              </p>
            </>
          ) : (
            <>
              <TextField
                id="new-job-file-title"
                title="Job Title"
                value={fileTitle}
                onChange={(value) => setFileTitle(value)}
                placeholder="Leave empty to auto-extract from file"
                size="small"
                wrapperClassName="w-full"
              />
              <div
                className={cn(
                  'border-2 border-dashed p-6 text-center text-sm transition-colors',
                  radiusSurface,
                  isDragging
                    ? 'border-brand bg-brand-soft/40 text-brand-ink dark:bg-brand/10 dark:text-brand-on-dark'
                    : 'border-gray-300 dark:border-line text-gray-500 dark:text-ink-muted'
                )}
                onDragEnter={() => !busy && setIsDragging(true)}
                onDragOver={(e) => { e.preventDefault(); if (!busy) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!busy) acceptFile(e.dataTransfer.files?.[0]); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => { acceptFile(e.target.files?.[0]); if (e.target) e.target.value = ''; }}
                  disabled={busy}
                />
                <Upload className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                <p className="mb-2">Drag and drop a file here, or</p>
                <Button kind="secondary" size="small" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  Browse files
                </Button>
                <p className="mt-2 text-xs text-gray-400 dark:text-ink-faint">PDF, DOC, or DOCX</p>
              </div>

              {file && (
                <div className={cn('flex items-center justify-between gap-3 border border-gray-200 dark:border-line bg-white dark:bg-surface px-3 py-2', radiusControl)}>
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-gray-500 dark:text-ink-muted" aria-hidden="true" />
                    <span className="truncate text-sm text-gray-900 dark:text-ink" title={file.name}>{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={busy}
                    className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-ink-muted dark:hover:text-ink disabled:opacity-50"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button kind="tertiary" size="small" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          {mode === 'write' ? (
            <>
              <Button
                kind="primary"
                size="small"
                onClick={handleGenerate}
                disabled={!formData.title.trim() || busy}
                loading={generating}
              >
                {generating ? 'Generating...' : 'Generate with AI'}
              </Button>
              <Button
                kind="primary"
                color="positive"
                size="small"
                onClick={handleCreate}
                disabled={!formData.title.trim() || !formData.description.trim() || busy}
                loading={creating}
              >
                {creating ? 'Creating...' : 'Create Job'}
              </Button>
            </>
          ) : (
            <Button
              kind="primary"
              color="positive"
              size="small"
              onClick={handleCreateFromFile}
              disabled={!file || busy}
              loading={creatingFromFile}
            >
              {creatingFromFile ? 'Creating...' : 'Create from file'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewJobModal;

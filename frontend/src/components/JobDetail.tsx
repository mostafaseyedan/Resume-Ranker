import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, Candidate, apiService, ExternalCandidateProfile, EmailThreadMessage } from '../services/apiService';
import ResumeUpload from './ResumeUpload';
import JobChatTab from './JobChatTab';
import CandidateList from './CandidateList';
import CandidateDetail from './CandidateDetail';
import CandidatesGroupedList from './CandidatesGroupedList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Button, SplitButton, SplitButtonMenu, MenuItem, Icon, Label, TextField } from '@vibe/core';
import '@vibe/core/tokens';
import { PDF, File as FileIcon, Check } from '@vibe/icons';
import { Button as UiButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronDown, RotateCw, X } from 'lucide-react';
import { getVibeLabelColor } from '../lib/mondayColors';
import SharePointFilesExplorer from './SharePointFilesExplorer';
import EmptyState from './common/EmptyState';
import { ListRowsSkeleton, CardGridSkeleton, FileListSkeleton } from './Skeletons';
import { getSharePointFileKey } from '../utils/sharepointFolderNav';
import { panelShellClass, radiusSurface, radiusPill } from '@/lib/radius';
import { DetailPanelBack } from './common/DetailPanelBack';
import UserAvatar from './common/UserAvatar';
import {
  bgSelection,
  chipPrimary,
  emailSentBorder,
  emailSentText,
  externalCardDefault,
  externalCardSelected,
  focusWithinRing,
  jobSectionBrand,
  jobSectionBrandChip,
  jobSectionBrandTitle,
  jobSectionNeutral,
  jobSectionNeutralTitle,
  progressFill,
  spinner,
  tabActive,
  tabInactive,
  textLink,
  textMetric,
  textPrimary,
} from '@/lib/semanticColors';
import { cn } from '@/lib/utils';
import { useJobInfographic } from '../hooks/useJobInfographic';
import { JobInfographicDialog, JobInfographicHeaderActions } from './job/JobInfographicDialog';

interface JobDetailProps {
  job: Job;
  onJobUpdated?: (updatedJob: Job) => void;
  initialTab?: 'candidates' | 'resumes' | 'files' | 'job-details' | 'potential-candidates' | 'external-candidates' | 'ai-chat';
}

const JOB_TAB_ACTIVE = tabActive;
const JOB_TAB_INACTIVE = tabInactive;
const CENDIEN_DOMAIN = 'cendien.com';
const RECRUITING_EMAIL = `recruiting@${CENDIEN_DOMAIN}`;

const senderFromAuthEmail = (email?: string | null): string | null => {
  const trimmed = (email || '').trim().toLowerCase();
  const username = trimmed.split('@')[0];
  if (!username || !/^[a-z0-9._%+-]+$/.test(username)) return null;
  return `${username}@${CENDIEN_DOMAIN}`;
};

const getEmailUsername = (email: string) => email.split('@')[0] || email;

function EmailTagInput({ emails, onChange }: { emails: string[]; onChange: (emails: string[]) => void }) {
  const [input, setInput] = useState('');

  const addEmail = (email: string) => {
    const trimmed = email.trim().replace(/,$/, '');
    if (trimmed && !emails.includes(trimmed)) onChange([...emails, trimmed]);
    setInput('');
  };

  const removeEmail = (index: number) => onChange(emails.filter((_, i) => i !== index));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addEmail(input);
    } else if (e.key === 'Backspace' && !input && emails.length > 0) {
      removeEmail(emails.length - 1);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5 p-2 border border-gray-300 dark:border-line rounded-md bg-white dark:bg-canvas-deep min-h-[38px] transition-colors', focusWithinRing)}>
      {emails.map((email, i) => (
        <span key={i} className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', chipPrimary)}>
          {email}
          <button type="button" onClick={() => removeEmail(i)} className="hover:text-brand-hover dark:hover:text-brand-on-dark ml-0.5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="email"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input && addEmail(input)}
        placeholder={emails.length === 0 ? 'Add email address...' : ''}
        className="flex-1 min-w-[160px] bg-transparent outline-none text-sm text-gray-900 dark:text-ink placeholder:text-gray-400 dark:placeholder:text-ink-muted"
      />
    </div>
  );
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onJobUpdated, initialTab }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedGroupCandidates, setSelectedGroupCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'resumes' | 'files' | 'job-details' | 'potential-candidates' | 'external-candidates' | 'ai-chat'>(initialTab || 'candidates');
  const [sharepointFiles, setSharepointFiles] = useState<{ job_files: any[]; resume_files: any[]; sharepoint_link: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingSharePoint, setLoadingSharePoint] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [processingFileType, setProcessingFileType] = useState<'job' | 'resume' | null>(null);
  const [fileProgress, setFileProgress] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [potentialCandidates, setPotentialCandidates] = useState<Array<{ filename: string; sharepoint_url: string | null; download_url: string | null }>>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  // External candidates state (LinkedIn search via Serper.dev)
  const [externalCandidates, setExternalCandidates] = useState<ExternalCandidateProfile[]>([]);
  const [searchingExternalCandidates, setSearchingExternalCandidates] = useState(false);
  const [externalSearchError, setExternalSearchError] = useState<string | null>(null);
  const [externalParsedQuery, setExternalParsedQuery] = useState<{ googleQuery?: string; role?: string | null; location?: string | null } | null>(null);
  const [externalCandidatesCount, setExternalCandidatesCount] = useState<number>(10);
  const [externalSearchRole, setExternalSearchRole] = useState<string>('');
  const [externalSearchLocation, setExternalSearchLocation] = useState<string>('');
  const [extractingSearchQuery, setExtractingSearchQuery] = useState(false);
  // Email outreach state
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());
  const [findingEmails, setFindingEmails] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCandidate, setComposeCandidate] = useState<ExternalCandidateProfile | null>(null);
  const [emailToAddresses, setEmailToAddresses] = useState<string[]>([]);
  const [emailFromAddress, setEmailFromAddress] = useState(RECRUITING_EMAIL);
  const [senderMenuOpen, setSenderMenuOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadCandidate, setThreadCandidate] = useState<ExternalCandidateProfile | null>(null);
  const [threadMessages, setThreadMessages] = useState<EmailThreadMessage[]>([]);
  const [fetchingThread, setFetchingThread] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Files Tab State
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [resumeProvider, setResumeProvider] = useState<'gemini' | 'openai' | 'both'>('gemini');
  const [jobProvider, setJobProvider] = useState<'gemini' | 'openai' | 'both'>('gemini');
  const [providerModels, setProviderModels] = useState<{
    resume: { gemini: string | null; openai: string | null };
    job: { gemini: string | null; openai: string | null };
  } | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Preview Provider State (null = default/root job data)
  const [previewProvider, setPreviewProvider] = useState<string | null>(null);

  const infographic = useJobInfographic(job, onJobUpdated);
  const senderMenuRef = useRef<HTMLDivElement | null>(null);

  const senderOptions = useMemo(() => {
    const options = [
      { value: RECRUITING_EMAIL, label: getEmailUsername(RECRUITING_EMAIL) },
    ];
    const userEmail = senderFromAuthEmail(currentUser?.email);
    if (userEmail && userEmail !== RECRUITING_EMAIL) {
      options.push({ value: userEmail, label: getEmailUsername(userEmail) });
    }
    return options;
  }, [currentUser?.email]);

  useEffect(() => {
    if (!senderOptions.some(option => option.value === emailFromAddress)) {
      setEmailFromAddress(RECRUITING_EMAIL);
    }
  }, [emailFromAddress, senderOptions]);

  const selectedSender = senderOptions.find(option => option.value === emailFromAddress) || senderOptions[0];

  useEffect(() => {
    if (!senderMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!senderMenuRef.current?.contains(event.target as Node)) {
        setSenderMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [senderMenuOpen]);

  const fileNameSets = useMemo(() => {
    const jobNames = new Set<string>();
    const resumeNames = new Set<string>();
    (sharepointFiles?.job_files || []).forEach((file: any) => {
      const name = String(file?.name || '').toLowerCase().trim();
      if (name) jobNames.add(name);
    });
    (sharepointFiles?.resume_files || []).forEach((file: any) => {
      const name = String(file?.name || '').toLowerCase().trim();
      if (name) resumeNames.add(name);
    });
    // A file should not be both; if overlap occurs, prefer job description.
    jobNames.forEach((name) => resumeNames.delete(name));
    return { jobNames, resumeNames };
  }, [sharepointFiles]);

  // Derived job object to display based on selection
  const displayedJob = useMemo(() => {
    if (previewProvider === 'gemini' && (job as any).gemini_analysis) {
      return { ...job, ...(job as any).gemini_analysis };
    }
    if (previewProvider === 'openai' && (job as any).openai_analysis) {
      return { ...job, ...(job as any).openai_analysis };
    }
    return job; // Default to root (most recent)
  }, [job, previewProvider]);

  // Sync previewProvider with job's current provider when job loads/changes
  useEffect(() => {
    setPreviewProvider(job.review_provider || null);
  }, [job.id, job.review_provider]);

  // Job Details Sub-tabs state
  type JobDetailSection = 'description' | 'requirements' | 'additional' | 'weights' | 'questions';
  const [activeJobDetailSection, setActiveJobDetailSection] = useState<JobDetailSection>('description');

  const JOB_DETAIL_SECTIONS: { key: JobDetailSection; label: string }[] = [
    { key: 'description', label: 'Job Description' },
    { key: 'requirements', label: 'Requirements Analysis' },
    { key: 'additional', label: 'Additional Information' },
    { key: 'weights', label: 'Skill Importance Weights' },
    { key: 'questions', label: 'Questions for Candidate' },
  ];

  // Internal Candidates Tab selection state
  const [selectedPotentialFiles, setSelectedPotentialFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCandidates();
    setSelectedCandidate(null); // Reset selected candidate when job changes
    setSelectedGroupCandidates(null); // Reset selected group when job changes
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

    // Reset and load external candidates from job if available
    setExternalCandidates([]);
    setExternalSearchError(null);
    setExternalParsedQuery(null);

    if ((job as any).external_candidates) {
      setExternalCandidates((job as any).external_candidates);
    }
    if ((job as any).external_candidates_parsed_query) {
      setExternalParsedQuery((job as any).external_candidates_parsed_query);
    }

    // Load SharePoint files if available
    if ((job as any).monday_metadata?.sharepoint_link) {
      loadSharePointFiles();
    }

    // Load current user
    const loadUser = async () => {
      try {
        const response = await apiService.getUser();
        setCurrentUser((response as any).user ?? response);
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };
    loadUser();
  }, [job.id]);

  // Load model names mapped from backend env vars (no hardcoded model labels)
  useEffect(() => {
    let cancelled = false;
    apiService.getAnalysisProviders()
      .then((models) => { if (!cancelled) setProviderModels(models); })
      .catch((err) => console.error('Failed to load analysis provider models:', err));
    return () => { cancelled = true; };
  }, []);

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

  const handleCandidateGroupSelect = (groupCandidates: Candidate[]) => {
    setSelectedGroupCandidates(groupCandidates);
  };

  const handleBackToCandidates = () => {
    setSelectedCandidate(null);
  };

  const handleBackToCandidatesList = () => {
    setSelectedGroupCandidates(null);
  };

  const handleCandidateDeleted = async (candidateId: string) => {
    await apiService.deleteCandidate(candidateId);
    setCandidates(prevCandidates => prevCandidates.filter(candidate => candidate.id !== candidateId));
    // Clear selected candidate if it was deleted
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate(null);
    }
    // Also clear from grouped candidates if present
    if (selectedGroupCandidates) {
      const updatedGroup = selectedGroupCandidates.filter(c => c.id !== candidateId);
      if (updatedGroup.length === 0) {
        setSelectedGroupCandidates(null);
      } else {
        setSelectedGroupCandidates(updatedGroup);
      }
    }
    toast.success('Candidate deleted successfully');
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
        const message =
          err?.response?.data?.error ||
          err?.message ||
          'Failed to load SharePoint files';
        toast.error(message);
      }
    } finally {
      if (currentJobId === job.id) {
        setLoadingSharePoint(false);
      }
    }
  };

  const handleProcessJobFile = async (downloadUrl: string, fileName: string, providerOverride?: 'gemini' | 'openai') => {
    const provider = providerOverride || (jobProvider === 'both' ? 'gemini' : jobProvider);
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

      const response = await apiService.processSharePointJobFile(
        downloadUrl,
        fileName,
        job.id,
        provider
      );

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

  const handleProcessResumeFile = async (downloadUrl: string, fileName: string, fileId?: string, siteId?: string, driveId?: string, providerOverride?: 'gemini' | 'openai') => {
    const provider = providerOverride || (resumeProvider === 'both' ? 'gemini' : resumeProvider);
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
      const uploadResponse = await apiService.uploadResume(job.id, file, provider);

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
          analysis_provider: provider,
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

  const handleExtractSearchQuery = async () => {
    try {
      setExtractingSearchQuery(true);
      setExternalSearchError(null);

      const response = await apiService.extractSearchQuery(job.id);

      if (response.success) {
        setExternalSearchRole(response.role || '');
        setExternalSearchLocation(response.location || '');
      } else {
        setExternalSearchError(response.error || 'Failed to extract search query');
      }
    } catch (err: any) {
      console.error('Extract search query error:', err);
      setExternalSearchError(err.response?.data?.error || err.message || 'Failed to extract search query');
    } finally {
      setExtractingSearchQuery(false);
    }
  };

  const handleSearchExternalCandidates = async () => {
    // If role is empty, extract first
    if (!externalSearchRole.trim()) {
      setExternalSearchError('Please extract or enter a role title first');
      return;
    }

    try {
      setSearchingExternalCandidates(true);
      setExternalSearchError(null);
      setExternalParsedQuery(null);

      const response = await apiService.searchExternalCandidates(job.id, {
        count: externalCandidatesCount,
        role: externalSearchRole.trim(),
        location: externalSearchLocation.trim() || undefined
      });

      if (response.success) {
        setExternalCandidates(response.results || []);
        setExternalParsedQuery(response.parsedQuery || null);
        if (response.results.length === 0) {
          setExternalSearchError('No matching LinkedIn profiles found');
        }
      } else {
        setExternalSearchError(response.error || 'Failed to search for external candidates');
      }
    } catch (err: any) {
      console.error('Search external candidates error:', err);
      setExternalSearchError(err.response?.data?.error || err.message || 'Failed to search for external candidates');
    } finally {
      setSearchingExternalCandidates(false);
    }
  };

  const handleExternalIdToggle = (linkedinId: string) => {
    setSelectedExternalIds(prev => {
      const next = new Set(prev);
      if (next.has(linkedinId)) next.delete(linkedinId);
      else next.add(linkedinId);
      return next;
    });
  };

  const handleFindEmails = async () => {
    if (selectedExternalIds.size === 0) return;
    const eligibleIds = Array.from(selectedExternalIds).filter(id => {
      const candidate = externalCandidates.find(c => c.linkedinId === id);
      const status = candidate?.email_status || 'none';
      return status !== 'sent' && status !== 'replied';
    });
    if (eligibleIds.length === 0) {
      toast.info('Selected candidates have already been contacted');
      setSelectedExternalIds(new Set());
      return;
    }

    try {
      setFindingEmails(true);
      const response = await apiService.findCandidateEmails(job.id, eligibleIds);
      if (response.success) {
        setExternalCandidates(prev =>
          prev.map(c => {
            const r = response.results[c.linkedinId];
            return r ? { ...c, email: r.email ?? undefined, email_status: r.email_status } : c;
          })
        );
        toast.success(`Emails found for ${Object.values(response.results).filter(r => r.email_status === 'found').length} of ${eligibleIds.length} candidates`);
        setSelectedExternalIds(new Set());
      } else {
        toast.error(response.error || 'Failed to find emails');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to find emails');
    } finally {
      setFindingEmails(false);
    }
  };

  const handleOpenCompose = async (profile: ExternalCandidateProfile) => {
    setComposeCandidate(profile);
    setEmailToAddresses(profile.email ? [profile.email] : []);
    setSenderMenuOpen(false);
    setEmailSubject('');
    setEmailBody('');
    setComposeOpen(true);
    setGeneratingEmail(true);
    try {
      const result = await apiService.generateCandidateEmail(job.id, profile.linkedinId);
      if (result.success) {
        setEmailSubject(result.subject);
        setEmailBody(result.body);
      } else {
        toast.error(result.error || 'Failed to generate email');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to generate email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleRegenerateEmail = async () => {
    if (!composeCandidate) return;
    setGeneratingEmail(true);
    try {
      const result = await apiService.generateCandidateEmail(job.id, composeCandidate.linkedinId);
      if (result.success) {
        setEmailSubject(result.subject);
        setEmailBody(result.body);
      } else {
        toast.error(result.error || 'Failed to regenerate email');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to regenerate email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!composeCandidate || !emailSubject.trim() || !emailBody.trim() || emailToAddresses.length === 0) return;
    try {
      setSendingEmail(true);
      const result = await apiService.sendCandidateEmail(job.id, composeCandidate.linkedinId, emailSubject.trim(), emailBody.trim(), emailToAddresses, emailFromAddress);
      if (result.success) {
        setExternalCandidates(prev =>
          prev.map(c => c.linkedinId === composeCandidate.linkedinId ? { ...c, email_status: 'sent', sent_from_address: emailFromAddress } : c)
        );
        setSelectedExternalIds(prev => {
          const next = new Set(prev);
          next.delete(composeCandidate.linkedinId);
          return next;
        });
        toast.success('Email sent successfully');
        setComposeOpen(false);
        setComposeCandidate(null);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenThread = async (profile: ExternalCandidateProfile) => {
    setThreadCandidate(profile);
    setThreadMessages([]);
    setReplySubject('');
    setReplyBody('');
    setThreadOpen(true);
    setFetchingThread(true);
    try {
      const result = await apiService.getCandidateEmailThread(job.id, profile.linkedinId);
      if (result.success) {
        setThreadMessages(result.messages);
        // If a reply is detected, update status
        const hasReply = result.messages.some(m => m.direction === 'received');
        if (hasReply && profile.email_status !== 'replied') {
          setExternalCandidates(prev =>
            prev.map(c => c.linkedinId === profile.linkedinId ? { ...c, email_status: 'replied' } : c)
          );
        }
      } else {
        toast.error(result.error || 'Failed to load thread');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to load thread');
    } finally {
      setFetchingThread(false);
    }
  };

  const handleRefreshThread = async () => {
    if (!threadCandidate) return;
    await handleOpenThread(threadCandidate);
  };

  const handleSendReply = async () => {
    if (!threadCandidate || !replySubject.trim() || !replyBody.trim()) return;
    try {
      setSendingReply(true);
      const result = await apiService.sendCandidateReply(job.id, threadCandidate.linkedinId, replySubject.trim(), replyBody.trim());
      if (result.success) {
        toast.success('Reply sent');
        setReplyBody('');
        await handleRefreshThread();
      } else {
        toast.error(result.error || 'Failed to send reply');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSkillClick = async (skill: string) => {
    try {
      toast.loading(`Searching for candidates with "${skill}"...`, { id: 'skill-search' });

      const response = await apiService.searchBySkill(job.id, skill);

      if (response.success && response.response_text) {
        toast.success(
          <div className="max-w-md">
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-ink whitespace-pre-wrap">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children, ...props }) => (
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

  const handleDeleteJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!confirm('Are you sure you want to delete this job? This will also delete all associated candidates.')) {
      return;
    }
    try {
      setDeletingJobId(jobId);
      await apiService.deleteJob(jobId);
      toast.success('Job deleted successfully');
      // After deletion, navigate away by clearing selection
      if (onJobUpdated) {
        onJobUpdated({ ...job, id: jobId } as any);
      }
    } catch (error: any) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job. Please try again.');
    } finally {
      setDeletingJobId(null);
    }
  };

  // Helper to get unique files
  const getUniqueFiles = () => {
    if (!sharepointFiles) return [];
    const allFiles = [
      ...(sharepointFiles.job_files || []),
      ...(sharepointFiles.resume_files || [])
    ];
    const seen = new Set<string>();
    return allFiles.filter((file) => {
      const key =
        String(file?.id || '') ||
        String(file?.web_url || '') ||
        String(file?.download_url || '') ||
        `${String(file?.name || '')}::${String(file?.path || '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleFileToggle = (fileKey: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileKey)) {
        newSet.delete(fileKey);
      } else {
        newSet.add(fileKey);
      }
      return newSet;
    });
  };

  const handleBatchResume = async () => {
    if (selectedFiles.size === 0) return;
    setBatchProcessing(true);
    toast.info(`Starting batch resume analysis for ${selectedFiles.size} files...`);

    const uniqueFiles = getUniqueFiles();
    const filesToProcess = uniqueFiles.filter((f) => selectedFiles.has(getSharePointFileKey(f)));
    const providers: ('gemini' | 'openai')[] = resumeProvider === 'both' ? ['gemini', 'openai'] : [resumeProvider];

    try {
      for (const file of filesToProcess) {
        // We await each one to avoid overwhelming the server, or we could Promise.all for parallel
        // Sequential is safer for now given the complexity of analysis
        for (const provider of providers) {
          await handleProcessResumeFile(file.download_url, file.name, file.id, file.site_id, file.drive_id, provider);
        }
      }
      toast.success("Batch resume analysis completed!");
      setSelectedFiles(new Set());
    } catch (err) {
      console.error("Batch processing error:", err);
      toast.error("Some files failed to process.");
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchJob = async () => {
    if (selectedFiles.size === 0) return;
    setBatchProcessing(true);
    toast.info(`Updating job description from ${selectedFiles.size} files...`);

    const uniqueFiles = getUniqueFiles();
    const filesToProcess = uniqueFiles.filter((f) => selectedFiles.has(getSharePointFileKey(f)));
    const providers: ('gemini' | 'openai')[] = jobProvider === 'both' ? ['gemini', 'openai'] : [jobProvider];

    try {
      for (const file of filesToProcess) {
        for (const provider of providers) {
          await handleProcessJobFile(file.download_url, file.name, provider);
        }
      }
      toast.success("Job description updated!");
      setSelectedFiles(new Set());
    } catch (err) {
      console.error("Batch processing error:", err);
      toast.error("Failed to update job description.");
    } finally {
      setBatchProcessing(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconProps = { className: "w-5 h-5 flex-shrink-0" };

    switch (ext) {
      case 'pdf':
        return <Icon icon={PDF} iconSize={20} className="text-red-600 dark:text-red-400" />;
      case 'doc':
      case 'docx':
        return <Icon icon={FileIcon} iconSize={20} className={textPrimary} />;
      case 'xls':
      case 'xlsx':
        return <Icon icon={FileIcon} iconSize={20} className="text-green-600" />;
      default:
        return <Icon icon={FileIcon} iconSize={20} className="text-gray-400" />;
    }
  };

  // Build a menu title from the provider label plus the model name configured in env vars.
  const providerMenuTitle = (label: string, model: string | null | undefined) =>
    model ? `${label} — ${model}` : label;

  // Helper for Internal Candidates selection
  const handlePotentialFileToggle = (fileName: string) => {
    setSelectedPotentialFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const handleSelectAllPotential = () => {
    if (selectedPotentialFiles.size === potentialCandidates.length) {
      setSelectedPotentialFiles(new Set());
    } else {
      setSelectedPotentialFiles(new Set(potentialCandidates.map(c => c.filename)));
    }
  };

  const handleBatchPotentialResume = async () => {
    if (selectedPotentialFiles.size === 0) return;
    setBatchProcessing(true);
    toast.info(`Starting batch analysis for ${selectedPotentialFiles.size} candidates...`);

    const filesToProcess = potentialCandidates.filter(c => selectedPotentialFiles.has(c.filename));
    const providers: ('gemini' | 'openai')[] = resumeProvider === 'both' ? ['gemini', 'openai'] : [resumeProvider];

    try {
      for (const file of filesToProcess) {
        if (!file.download_url) continue;
        for (const provider of providers) {
          await handleProcessResumeFile(
            file.download_url,
            file.filename,
            (file as any).id,
            (file as any).site_id,
            (file as any).drive_id,
            provider
          );
        }
      }
      toast.success("Batch analysis completed!");
      setSelectedPotentialFiles(new Set());
    } catch (err) {
      console.error("Batch processing error:", err);
      toast.error("Some files failed to process.");
    } finally {
      setBatchProcessing(false);
    }
  };

  // Helper to calculate unique candidates (grouping by name)
  // This logic mirrors CandidatesGroupedList grouping to ensure consistent counts
  const getUniqueCandidateCount = () => {
    const grouped = new Set<string>();

    candidates.forEach(candidate => {
      const originalName = candidate.name || 'Unnamed Candidate';
      const normalizedName = originalName.toLowerCase().trim();

      // Simple exact match logic for now, or match on name parts if we want to be fancy.
      // For the tab count, a set of normalized names is a good approximation of unique "people".
      // Note: CandidatesGroupedList has more complex logic (checking overlapping name parts).
      // If we want exact parity without duplicating code, we might need to hoist that logic.
      // But for a tab label, grouping by exact normalized name is usually sufficient "uniqueness".
      // Let's use a slightly better heuristic:

      let foundGroup = false;
      // Check if this name is already represented
      for (const existingGroup of Array.from(grouped)) {
        // If the existing group name contains this name or vice versa (e.g. "John Smith" and "John")
        if (existingGroup.includes(normalizedName) || normalizedName.includes(existingGroup)) {
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        grouped.add(normalizedName);
      }
    });

    return grouped.size;
  };

  if (selectedCandidate) {
    const selectedName = (selectedCandidate.name || '').toLowerCase().trim();
    const nameParts = selectedName.split(/\s+/).filter(p => p.length > 2);
    const hasImprovedVersion =
      candidates.some(
        c => (c.name || '').toLowerCase().trim() === selectedName &&
          (c.resume_filename || '').toLowerCase().includes('improved')
      ) ||
      (sharepointFiles?.resume_files || []).some((f: any) => {
        const fname = (f.name || '').toLowerCase();
        return fname.includes('improved') && nameParts.some(part => fname.includes(part));
      });
    return (
      <CandidateDetail
        candidate={selectedCandidate}
        backLabel="Resumes"
        onBack={handleBackToCandidates}
        job={job}
        hasImprovedVersion={hasImprovedVersion}
      />
    );
  }

  return (
    <div className={panelShellClass}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-line dark:border-line px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-ink dark:text-ink">{job.title}</h2>
            <div className="flex flex-wrap gap-1 items-center mt-2">
              {/* Employment Type Tag */}
              {job.monday_metadata?.employment_type && (
                <Label
                  id={`employment-${job.id}`}
                  text={job.monday_metadata.employment_type}
                  size="small"
                  color={getVibeLabelColor(job.monday_metadata.employment_type, job.monday_metadata.employment_type_color) as any}
                />
              )}

              {/* Req Status Tag */}
              {job.monday_metadata?.status && (
                <Label
                  id={`status-${job.id}`}
                  text={job.monday_metadata.status}
                  size="small"
                  color={getVibeLabelColor(job.monday_metadata.status, job.monday_metadata.status_color) as any}
                />
              )}

              {/* Work Mode Tag */}
              {job.monday_metadata?.work_mode && (
                <Label
                  id={`workmode-${job.id}`}
                  text={job.monday_metadata.work_mode}
                  size="small"
                  color={getVibeLabelColor(job.monday_metadata.work_mode, job.monday_metadata.work_mode_color) as any}
                />
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={cn('text-2xl font-bold', textMetric)}>{getUniqueCandidateCount()}</div>
            <div className="text-sm text-gray-500 dark:text-ink-muted">Candidate{getUniqueCandidateCount() !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-line">
        <nav className="-mb-px flex items-center justify-between overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('files');
              if (!sharepointFiles && !loadingSharePoint) {
                loadSharePointFiles();
              }
            }}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'files' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            Files
          </button>
          <button
            onClick={() => {
              setActiveTab('candidates');
              setSelectedGroupCandidates(null);
            }}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'candidates' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            Candidates
          </button>
          <button
            onClick={() => setActiveTab('resumes')}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'resumes' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            Resumes
          </button>
          <button
            onClick={() => setActiveTab('potential-candidates')}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'potential-candidates' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            Internal Candidates
          </button>
          <button
            onClick={() => setActiveTab('external-candidates')}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'external-candidates' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            External Candidates
          </button>
          <button
            onClick={() => {
              setActiveTab('job-details');
              if (!sharepointFiles && !loadingSharePoint) {
                loadSharePointFiles();
              }
            }}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'job-details' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            Job Details
          </button>
          <button
            onClick={() => setActiveTab('ai-chat')}
            className={`shrink-0 py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'ai-chat' ? JOB_TAB_ACTIVE : JOB_TAB_INACTIVE}`}
          >
            Chat
          </button>
          <button
            onClick={(e) => handleDeleteJob(job.id, e as any)}
            className="ml-auto mr-4 text-gray-400 dark:text-ink-muted hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 p-2"
            title="Delete job"
            aria-label="Delete job"
          >
            {deletingJobId === job.id ? (
              <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="">
        {activeTab === 'candidates' && (
          <>
            {selectedGroupCandidates && (
              <div className="border-b border-gray-200 dark:border-line px-6 py-2.5">
                <DetailPanelBack label="Candidates" onClick={handleBackToCandidatesList} />
              </div>
            )}
            <div className="p-6">
              {loading ? (
                <ListRowsSkeleton />
              ) : error ? (
                <EmptyState
                  title="Couldn't load candidates"
                  description={error}
                  action={<Button onClick={loadCandidates} size="small" kind="primary">Retry</Button>}
                />
              ) : selectedGroupCandidates ? (
                <CandidateList
                  candidates={selectedGroupCandidates}
                  onCandidateSelect={handleCandidateSelect}
                  onCandidateDeleted={handleCandidateDeleted}
                  sharepointFiles={sharepointFiles}
                />
              ) : (
                <CandidatesGroupedList
                  candidates={candidates}
                  onCandidateSelect={handleCandidateGroupSelect}
                  onCandidateDeleted={handleCandidateDeleted}
                />
              )}
            </div>
          </>
        )}

        {activeTab === 'resumes' && (
          <div className="p-6">
            {loading ? (
              <ListRowsSkeleton />
            ) : error ? (
              <EmptyState
                title="Couldn't load resumes"
                description={error}
                action={<Button onClick={loadCandidates} size="small" kind="primary">Retry</Button>}
              />
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
          <div className="space-y-6 p-6">
            {(job as any).monday_metadata?.sharepoint_link && (
              <div>
                {loadingSharePoint ? (
                  <FileListSkeleton />
                ) : sharepointFiles ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-ink">SharePoint Files</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <SplitButton
                          id="resume-split-button"
                          ariaLabel="Analyze Resume split button"
                          onClick={handleBatchResume}
                          disabled={selectedFiles.size === 0 || batchProcessing || processingFile !== null}
                          size="small"
                          kind="primary"
                          secondaryDialogPosition="bottom-start"
                          secondaryDialogContent={
                            <SplitButtonMenu id="resume-menu">
                              <MenuItem
                                id="resume-gemini"
                                title={providerMenuTitle('Gemini', providerModels?.resume.gemini)}
                                onClick={() => setResumeProvider('gemini')}
                                rightIcon={resumeProvider === 'gemini' ? Check : undefined}
                              />
                              <MenuItem
                                id="resume-openai"
                                title={providerMenuTitle('ChatGPT', providerModels?.resume.openai)}
                                onClick={() => setResumeProvider('openai')}
                                rightIcon={resumeProvider === 'openai' ? Check : undefined}
                              />
                              <MenuItem
                                id="resume-both"
                                title="Both"
                                onClick={() => setResumeProvider('both')}
                                rightIcon={resumeProvider === 'both' ? Check : undefined}
                              />
                            </SplitButtonMenu>
                          }
                        >
                          {batchProcessing ? 'Processing...' : 'Analyze Resume'}
                        </SplitButton>
                        <SplitButton
                          id="job-split-button"
                          ariaLabel="Review Job split button"
                          onClick={handleBatchJob}
                          disabled={selectedFiles.size === 0 || batchProcessing || processingFile !== null}
                          size="small"
                          kind="primary"
                          color="positive"
                          secondaryDialogPosition="bottom-start"
                          secondaryDialogContent={
                            <SplitButtonMenu id="job-menu">
                              <MenuItem
                                id="job-gemini"
                                title={providerMenuTitle('Gemini', providerModels?.job.gemini)}
                                onClick={() => setJobProvider('gemini')}
                                rightIcon={jobProvider === 'gemini' ? Check : undefined}
                              />
                              <MenuItem
                                id="job-openai"
                                title={providerMenuTitle('ChatGPT', providerModels?.job.openai)}
                                onClick={() => setJobProvider('openai')}
                                rightIcon={jobProvider === 'openai' ? Check : undefined}
                              />
                              <MenuItem
                                id="job-both"
                                title="Both"
                                onClick={() => setJobProvider('both')}
                                rightIcon={jobProvider === 'both' ? Check : undefined}
                              />
                            </SplitButtonMenu>
                          }
                        >
                          {batchProcessing ? 'Processing...' : 'Review Job'}
                        </SplitButton>
                      </div>
                    </div>

                    {processingFile && (
                      <div
                        className={cn(
                          radiusSurface,
                          'border p-4',
                          processingFileType === 'job'
                            ? 'border-green-200 bg-green-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                            : 'border-brand/25 bg-brand-soft/40 dark:border-brand/35 dark:bg-brand/10'
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span
                            className={cn(
                              'truncate pr-2',
                              processingFileType === 'job'
                                ? 'text-green-800 dark:text-emerald-300'
                                : 'text-brand-ink dark:text-brand-on-dark'
                            )}
                          >
                            {processingFileType === 'job'
                              ? `Reviewing job description from "${processingFile}"...`
                              : `Analyzing resume "${processingFile}"...`}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 font-medium tabular-nums',
                              processingFileType === 'job'
                                ? 'text-green-800 dark:text-emerald-300'
                                : 'text-brand-ink dark:text-brand-on-dark'
                            )}
                          >
                            {fileProgress}%
                          </span>
                        </div>
                        <div
                          className={cn(
                            'h-2 w-full overflow-hidden',
                            radiusPill,
                            processingFileType === 'job' ? 'bg-green-200 dark:bg-emerald-900/60' : 'bg-brand-soft dark:bg-brand/20'
                          )}
                        >
                          <div
                            className={cn('h-2 transition-all duration-300', processingFileType === 'job' ? 'bg-green-600' : 'bg-brand')}
                            style={{ width: `${fileProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <SharePointFilesExplorer
                      key={job.id}
                      files={getUniqueFiles()}
                      selectedKeys={selectedFiles}
                      onToggleFile={handleFileToggle}
                      getFileKind={(file) => {
                        const normalizedName = String(file?.name || '').toLowerCase().trim();
                        const pathLower = String(file?.path || '').toLowerCase();
                        if (pathLower.includes('resume')) return 'resume';
                        if (
                          pathLower.includes('job') ||
                          pathLower.includes('jd') ||
                          pathLower.includes('description')
                        ) {
                          return 'job';
                        }
                        if (fileNameSets.jobNames.has(normalizedName)) return 'job';
                        if (fileNameSets.resumeNames.has(normalizedName)) return 'resume';
                        return null;
                      }}
                      navigationDisabled={batchProcessing || processingFile !== null}
                    />

                    <div className="text-right text-sm">
                      <a
                        href={sharepointFiles.sharepoint_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={textLink}
                      >
                        Open SharePoint folder
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className={cn(radiusSurface, 'border border-dashed border-gray-300 dark:border-line bg-gray-50 dark:bg-canvas')}>
                    <EmptyState
                      title="SharePoint files not loaded"
                      description="Load the files linked to this job to analyze resumes or review the job description."
                      action={<Button onClick={loadSharePointFiles} size="small" kind="primary">Load SharePoint files</Button>}
                      className="py-10"
                    />
                  </div>
                )}
              </div>
            )}

            <ResumeUpload job={job} onResumeUploaded={handleResumeUploaded} />
          </div>
        )}

        {activeTab === 'job-details' && (
          <div className="flex flex-col">

            {/* Context Header (between tabs) */}
            <div className="border-b border-gray-200 dark:border-line py-3 px-6 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-ink">
                  {job.source_filename || sharepointFiles?.job_files?.[0]?.name}
                </h2>
                {job.reviewed_by && (
                  <div className="flex items-center gap-2 mt-1 text-gray-500 dark:text-ink-muted text-xs">
                    <UserAvatar userId={job.reviewed_by} name={job.reviewed_by} size="xs" />
                    <span>•</span>
                    <span>Updated {(job as any).updated_at ? new Date((job as any).updated_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <JobInfographicHeaderActions
                  hasInfographic={infographic.hasInfographic}
                  canGenerate={infographic.canGenerate}
                  generating={infographic.generatingInfographic}
                  onRegenerate={() => infographic.openDialog('generate')}
                  onView={() => infographic.openDialog('view')}
                />
                <button
                  title="Copy for LinkedIn"
                  onClick={() => {
                    const d = displayedJob?.extracted_data;
                    if (!d) return;
                    const lines: string[] = [];
                    lines.push(job.title);
                    lines.push('');
                    if (job.description) {
                      lines.push(job.description);
                      lines.push('');
                    }
                    if (d.key_responsibilities?.length) {
                      lines.push('Key Responsibilities:');
                      d.key_responsibilities.forEach((r: string) => lines.push(`• ${r}`));
                      lines.push('');
                    }
                    if (d.required_skills?.length) {
                      lines.push('Required Skills:');
                      d.required_skills.forEach((s: string) => lines.push(`• ${s}`));
                      lines.push('');
                    }
                    if (d.preferred_skills?.length) {
                      lines.push('Preferred Skills:');
                      d.preferred_skills.forEach((s: string) => lines.push(`• ${s}`));
                      lines.push('');
                    }
                    if (d.experience_requirements) {
                      lines.push(`Experience: ${d.experience_requirements}`);
                      lines.push('');
                    }
                    if (d.education_requirements?.length) {
                      lines.push('Education:');
                      d.education_requirements.forEach((e: string) => lines.push(`• ${e}`));
                      lines.push('');
                    }
                    if (d.certifications?.length) {
                      lines.push('Certifications:');
                      d.certifications.forEach((c: string) => lines.push(`• ${c}`));
                      lines.push('');
                    }
                    if (d.soft_skills?.length) {
                      lines.push('Soft Skills:');
                      d.soft_skills.forEach((s: string) => lines.push(`• ${s}`));
                    }
                    navigator.clipboard.writeText(lines.join('\n'));
                    toast.success('Job details copied to clipboard');
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-ink-muted dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-hover rounded transition-colors"
                >
                  <svg viewBox="0 0 105.02 122.88" className="w-4 h-4" fill="currentColor">
                    <path d="M5.32,14.64h20.51V5.32v0h0.01c0-1.47,0.6-2.8,1.56-3.76c0.95-0.95,2.28-1.55,3.75-1.55V0h0h39.61h1.22l0.88,0.88 l31.29,31.41l0.87,2.09v69.2v0h-0.01c0,1.47-0.59,2.8-1.55,3.76h-0.01c-0.95,0.96-2.28,1.55-3.75,1.55v0.01h0H79.19v8.65v0h-0.01 c0,1.47-0.59,2.8-1.55,3.76h-0.01c-0.96,0.95-2.28,1.55-3.75,1.55v0.01h0H5.32h0v-0.01c-1.47,0-2.8-0.6-3.76-1.56 c-0.95-0.96-1.55-2.28-1.55-3.75H0v0V19.97v0h0.01c0-1.47,0.6-2.8,1.56-3.76c0.95-0.95,2.28-1.55,3.75-1.55L5.32,14.64L5.32,14.64 L5.32,14.64z M31.76,14.64h13.17h1.22l0.88,0.88l31.29,31.41l0.87,2.09v53.95h19.89V36.24H74.73h0v0c-1.78,0-3.39-0.74-4.56-1.94 c-1.17-1.19-1.9-2.84-1.9-4.65h0v0V5.94H31.76V14.64L31.76,14.64z M68.39,2.97h2.37l31.29,31.41v1.74H74.73 c-3.49,0-6.35-2.92-6.35-6.48V2.97L68.39,2.97z M73.26,50.88H48.91h0v0c-1.78,0-3.39-0.74-4.56-1.94c-1.17-1.19-1.9-2.84-1.9-4.65 h0v0V20.58H25.83H5.94v96.36h67.32v-8.04v-2.97V50.88L73.26,50.88z"/>
                  </svg>
                </button>
                {/* Provider Toggles */}
                <div className="flex items-center gap-2">
                  {/* Gemini Toggle */}
                  {((job as any).gemini_analysis || (!job.review_provider || job.review_provider === 'gemini')) && (
                    <button
                      onClick={() => setPreviewProvider('gemini')}
                      className={`transition-opacity ${previewProvider === 'gemini' ? 'opacity-100' : 'opacity-40 hover:opacity-100 grayscale'}`}
                      title="View Gemini Analysis"
                    >
                      <img
                        src="/gemini-icon.svg"
                        alt="Gemini"
                        className="h-6 w-auto"
                      />
                    </button>
                  )}

                  {/* OpenAI Toggle */}
                  {((job as any).openai_analysis || job.review_provider === 'openai') && (
                    <button
                      onClick={() => setPreviewProvider('openai')}
                      className={`transition-opacity ${previewProvider === 'openai' ? 'opacity-100' : 'opacity-40 hover:opacity-100 grayscale'}`}
                      title="View ChatGPT Analysis"
                    >
                      <img
                        src="/chatgpt.png"
                        alt="ChatGPT"
                        className="h-5 w-auto"
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Tabs Navigation */}
            <div className="border-b border-gray-200 dark:border-line px-6">
              <nav className="flex w-full items-center gap-6" aria-label="Job Detail Sections">
                {JOB_DETAIL_SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    onClick={() => setActiveJobDetailSection(section.key)}
                    className={`whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${activeJobDetailSection === section.key ? tabActive : tabInactive}`}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-6 px-6">
              {/* Success/Error Message */}
              {successMessage && (
                <div className={`mb-6 p-4 rounded-lg border ${successMessage.startsWith('Failed')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
                  }`}>
                  <p className="text-sm font-medium">{successMessage}</p>
                </div>
              )}

              {/* Content Sections */}
              {activeJobDetailSection === 'description' && (
                <div>
                  <div className="border border-gray-300 dark:border-line p-4 mb-3 bg-gray-50 dark:bg-canvas shadow-sm">

                    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 dark:text-ink">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          ol: ({ ...props }) => (
                            <ol className="list-decimal list-outside ml-6 space-y-4 my-4" {...props} />
                          ),
                          ul: ({ ...props }) => (
                            <ul className="list-disc list-outside ml-6 space-y-2 my-4" {...props} />
                          ),
                          li: ({ ...props }) => (
                            <li className="pl-2" {...props} />
                          ),
                          p: ({ ...props }) => (
                            <p className="my-2 whitespace-pre-wrap" {...props} />
                          ),
                          strong: ({ ...props }) => (
                            <strong className="font-bold text-gray-900 dark:text-ink" {...props} />
                          ),
                          table: ({ ...props }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                            </div>
                          ),
                          thead: ({ ...props }) => (
                            <thead className="bg-gray-100 dark:bg-surface" {...props} />
                          ),
                          tbody: ({ ...props }) => (
                            <tbody className="divide-y divide-gray-200 bg-white" {...props} />
                          ),
                          tr: ({ ...props }) => (
                            <tr className="hover:bg-gray-50 dark:hover:bg-surface-hover dark:bg-canvas" {...props} />
                          ),
                          th: ({ ...props }) => (
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900 dark:text-ink border-r border-gray-300 last:border-r-0" {...props} />
                          ),
                          td: ({ ...props }) => (
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-ink border-r border-gray-300 last:border-r-0" {...props} />
                          ),
                        }}
                      >
                        {displayedJob.description || ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {activeJobDetailSection === 'requirements' && (
                <div className="space-y-6">
                  {/* Requirements Analysis from job.requirements */}
                  {displayedJob.requirements && Object.keys(displayedJob.requirements).length > 0 && (
                    <div className="border border-gray-300 dark:border-line p-4 mb-3 bg-gray-50 dark:bg-canvas shadow-sm">
                      <div className="mb-3">
                        <h3 className="m-0 font-semibold text-gray-900 dark:text-ink">Analysis Summary</h3>
                      </div>
                      <div className="space-y-2 text-sm leading-normal text-gray-700 dark:text-ink">
                        {Object.entries(displayedJob.requirements).map(([key, value]) => (
                          <div key={key} className="flex flex-col sm:flex-row">
                            <span className="font-medium text-gray-600 dark:text-ink-muted capitalize sm:w-32 mb-1 sm:mb-0">
                              {key.replace('_', ' ')}:
                            </span>
                            <span className="text-gray-700 dark:text-ink">
                              {Array.isArray(value) ? value.join(', ') : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {displayedJob.extracted_data && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Required Skills */}
                      {displayedJob.extracted_data.required_skills && displayedJob.extracted_data.required_skills.length > 0 && (
                        <div className="border border-red-200 dark:border-red-700 p-4 mb-3 bg-red-50 dark:bg-red-900/20 shadow-sm">
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-red-800 dark:text-red-300">Required Skills</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {displayedJob.extracted_data.required_skills.map((skill: string, index: number) => (
                              <button
                                key={index}
                                onClick={() => handleSkillClick(skill)}
                                className="px-3 py-1 bg-white dark:bg-surface border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 hover:shadow-sm transition-all cursor-pointer"
                              >
                                {skill}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preferred Skills */}
                      {displayedJob.extracted_data.preferred_skills && displayedJob.extracted_data.preferred_skills.length > 0 && (
                        <div className={jobSectionBrand}>
                          <div className="mb-3">
                            <h3 className={jobSectionBrandTitle}>Preferred Skills</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {displayedJob.extracted_data.preferred_skills.map((skill: string, index: number) => (
                              <button
                                key={index}
                                onClick={() => handleSkillClick(skill)}
                                className={jobSectionBrandChip}
                              >
                                {skill}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Experience Requirements */}
                      {displayedJob.extracted_data.experience_requirements && (
                        <div
                          className="border border-green-300 dark:border-green-700 p-4 mb-3 bg-green-50 dark:bg-green-900/20 shadow-sm cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                          onClick={() => handleSkillClick(displayedJob.extracted_data.experience_requirements!)}
                        >
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-green-800 dark:text-green-300">Experience Requirements</h3>
                          </div>
                          <p className="text-sm leading-normal text-gray-700 dark:text-ink">
                            {displayedJob.extracted_data.experience_requirements}
                          </p>
                        </div>
                      )}

                      {/* Education Requirements */}
                      {displayedJob.extracted_data && displayedJob.extracted_data.education_requirements && displayedJob.extracted_data.education_requirements.length > 0 && (
                        <div className="border border-purple-200 dark:border-purple-700 p-4 mb-3 bg-purple-50 dark:bg-purple-900/20 shadow-sm">
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-purple-800 dark:text-purple-300">Education Requirements</h3>
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-sm leading-normal text-gray-700 dark:text-ink">
                            {displayedJob.extracted_data.education_requirements.map((edu: string, index: number) => (
                              <li
                                key={index}
                                onClick={() => handleSkillClick(edu)}
                                className="cursor-pointer hover:text-purple-800 dark:hover:text-purple-300 hover:font-medium transition-all"
                              >
                                {edu}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Certifications */}
                      {displayedJob.extracted_data.certifications && displayedJob.extracted_data.certifications.length > 0 && (
                        <div className="border border-yellow-200 dark:border-yellow-700 p-4 mb-3 bg-yellow-50 dark:bg-yellow-900/20 shadow-sm">
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-yellow-800 dark:text-yellow-300">Certifications</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {displayedJob.extracted_data.certifications.map((cert: string, index: number) => (
                              <button
                                key={index}
                                onClick={() => handleSkillClick(cert)}
                                className="px-3 py-1 bg-white dark:bg-surface border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 text-sm font-medium hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:shadow-sm transition-all cursor-pointer"
                              >
                                {cert}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key Responsibilities */}
                      {displayedJob.extracted_data.key_responsibilities && displayedJob.extracted_data.key_responsibilities.length > 0 && (
                        <div className={jobSectionNeutral}>
                          <div className="mb-3">
                            <h3 className={jobSectionNeutralTitle}>Key Responsibilities</h3>
                          </div>
                          <ul className="list-disc list-inside space-y-2 text-sm leading-normal text-gray-700 dark:text-ink">
                            {displayedJob.extracted_data.key_responsibilities.map((responsibility: string, index: number) => (
                              <li key={index}>{responsibility}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Soft Skills */}
                      {displayedJob.extracted_data.soft_skills && displayedJob.extracted_data.soft_skills.length > 0 && (
                        <div className="border border-pink-200 dark:border-pink-700 p-4 mb-3 bg-pink-50 dark:bg-pink-900/20 shadow-sm">
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-pink-800 dark:text-pink-300">Soft Skills</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {displayedJob.extracted_data.soft_skills.map((skill: string, index: number) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-white dark:bg-surface border border-pink-200 dark:border-pink-700 text-pink-800 dark:text-pink-300 text-sm font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeJobDetailSection === 'additional' && (
                <div>
                  {displayedJob.extracted_data && displayedJob.extracted_data.other && displayedJob.extracted_data.other.length > 0 ? (
                    <div className="border border-gray-300 dark:border-line p-4 mb-3 bg-gray-50 dark:bg-canvas shadow-sm">

                      <ul className="list-disc list-inside space-y-1 text-sm leading-normal text-gray-700 dark:text-ink">
                        {displayedJob.extracted_data.other.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-ink-muted italic">No additional information extracted.</div>
                  )}
                </div>
              )}

              {activeJobDetailSection === 'weights' && (
                <div>
                  {displayedJob.skill_weights && Object.keys(displayedJob.skill_weights).length > 0 ? (
                    <div className="border border-gray-300 dark:border-line p-4 mb-3 bg-gray-50 dark:bg-canvas shadow-sm">

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(displayedJob.skill_weights).map(([skill, weight]) => (
                          <div key={skill} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-canvas border border-gray-100">
                            <span className="text-sm font-medium text-gray-700 dark:text-ink">{skill}</span>
                            <div className="flex items-center space-x-3">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div
                                  className={cn('h-2 rounded-full transition-all duration-300', progressFill)}
                                  style={{ width: `${(Number(weight) / 10) * 100}%` }}
                                ></div>
                              </div>
                              <div className="text-sm text-gray-900 dark:text-ink">{Number(displayedJob.skill_weights![skill] || 0)}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-ink-muted italic">No skill weights available.</div>
                  )}
                </div>
              )}

              {activeJobDetailSection === 'questions' && (
                <div>
                  {displayedJob.extracted_data && displayedJob.extracted_data.questions_for_candidate && displayedJob.extracted_data.questions_for_candidate.length > 0 ? (
                    <div className="border border-gray-300 dark:border-line p-4 mb-3 bg-gray-50 dark:bg-canvas shadow-sm">
                      <div className="mb-4">
                        <h3 className="m-0 font-semibold text-base text-gray-900 dark:text-ink">
                          Questions for Candidate
                        </h3>
                        <p className="mt-2 text-xs text-gray-600 dark:text-ink-muted">
                          Key questions to assess candidate suitability
                        </p>
                      </div>
                      <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed text-gray-700 dark:text-ink">
                        {displayedJob.extracted_data.questions_for_candidate.map((question: string, index: number) => (
                          <li key={index} className="pl-2">{question}</li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-ink-muted italic">No interview questions generated for this position.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai-chat' && (
          // Bound the height to the viewport so the chat scrolls internally and the
          // composer floats at the visible bottom (the panel itself is auto-height).
          <div className="w-full h-[calc(100vh-15rem)] min-h-[420px]">
            <JobChatTab job={job} />
          </div>
        )}

        {activeTab === 'potential-candidates' && (
          <div className="p-6">
            {potentialCandidates.length === 0 && !searchingCandidates && !searchError ? (
              <EmptyState
                icon={
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                title="Internal Candidates"
                description="Search the knowledge base to find candidates whose skills and experience match this position."
                action={
                  <Button onClick={handleSearchPotentialCandidates} disabled={!job.description} size="small" kind="primary">
                    {!job.description ? 'Add Job Description First' : 'Start AI Search'}
                  </Button>
                }
              />
            ) : (
              <div>
                {searchingCandidates ? (
                  <ListRowsSkeleton rows={6} />
                ) : searchError ? (
                  <EmptyState
                    icon={
                      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    title="Search Failed"
                    description={searchError}
                    action={<Button onClick={handleSearchPotentialCandidates} size="small" kind="primary">Try Again</Button>}
                  />
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-ink">Internal Candidates</h3>
                      <button
                        onClick={handleSearchPotentialCandidates}
                        className={cn('inline-flex items-center px-4 py-2 text-sm font-medium transition-colors', textLink, 'hover:bg-brand-soft dark:hover:bg-brand/10')}
                        title="Refresh search"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    {geminiResponse && (
                      <div className="border border-gray-300 dark:border-line p-4 mb-6 bg-gray-50 dark:bg-canvas shadow-sm">
                        <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 dark:text-ink">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              ol: ({ ...props }) => (
                                <ol className="list-decimal list-outside ml-6 space-y-4 my-4" {...props} />
                              ),
                              ul: ({ ...props }) => (
                                <ul className="list-disc list-outside ml-6 space-y-2 my-4" {...props} />
                              ),
                              li: ({ ...props }) => (
                                <li className="pl-2" {...props} />
                              ),
                              p: ({ ...props }) => (
                                <p className="my-2" {...props} />
                              ),
                              strong: ({ ...props }) => (
                                <strong className="font-bold text-gray-900 dark:text-ink" {...props} />
                              ),
                              table: ({ ...props }) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                                </div>
                              ),
                              thead: ({ ...props }) => (
                                <thead className="bg-gray-100 dark:bg-surface" {...props} />
                              ),
                              tbody: ({ ...props }) => (
                                <tbody className="divide-y divide-gray-200 bg-white" {...props} />
                              ),
                              tr: ({ ...props }) => (
                                <tr className="hover:bg-gray-50 dark:hover:bg-surface-hover dark:bg-canvas" {...props} />
                              ),
                              th: ({ ...props }) => (
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900 dark:text-ink border-r border-gray-300 last:border-r-0" {...props} />
                              ),
                              td: ({ ...props }) => (
                                <td className="px-4 py-2 text-sm text-gray-700 dark:text-ink border-r border-gray-300 last:border-r-0" {...props} />
                              ),
                            }}
                          >
                            {geminiResponse}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Action Bar */}
                      <div className="flex flex-wrap items-start justify-between gap-3 bg-gray-50 dark:bg-canvas p-3 border border-gray-200 dark:border-line">
                        <div className="flex items-center space-x-4 text-sm mt-1">
                          <button
                            onClick={handleSelectAllPotential}
                            className={cn('font-medium', textLink)}
                          >
                            {selectedPotentialFiles.size === potentialCandidates.length && potentialCandidates.length > 0 ? 'Deselect All' : 'Select All'}
                          </button>
                          <span className="text-gray-600 dark:text-ink-muted">
                            {selectedPotentialFiles.size} selected
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <SplitButton
                            id="potential-resume-split-button"
                            ariaLabel="Analyze Resume split button"
                            onClick={handleBatchPotentialResume}
                            disabled={selectedPotentialFiles.size === 0 || batchProcessing || processingFile !== null}
                            size="small"
                            kind="primary"
                            secondaryDialogPosition="bottom-start"
                            secondaryDialogContent={
                              <SplitButtonMenu id="potential-resume-menu">
                                <MenuItem
                                  id="potential-resume-gemini"
                                  title="Gemini Flash"
                                  onClick={() => setResumeProvider('gemini')}
                                  rightIcon={resumeProvider === 'gemini' ? Check : undefined}
                                />
                                <MenuItem
                                  id="potential-resume-openai"
                                  title="ChatGPT 5.1"
                                  onClick={() => setResumeProvider('openai')}
                                  rightIcon={resumeProvider === 'openai' ? Check : undefined}
                                />
                              </SplitButtonMenu>
                            }
                          >
                            {batchProcessing ? 'Processing...' : 'Analyze Resume'}
                          </SplitButton>
                        </div>
                      </div>

                      {/* File List */}
                      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-line overflow-hidden">
                        {potentialCandidates.map((candidate, index) => {
                          const isSelected = selectedPotentialFiles.has(candidate.filename);
                          return (
                            <div
                              key={index}
                              onClick={() => handlePotentialFileToggle(candidate.filename)}
                              className={cn('flex items-center justify-between p-3 transition-colors cursor-pointer border-b border-gray-100 last:border-0', isSelected ? bgSelection : 'hover:bg-gray-50 dark:hover:bg-surface-hover dark:bg-canvas')}
                            >
                              <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                                <div className="flex-shrink-0 pointer-events-none">
                                  <Checkbox
                                    checked={isSelected}
                                  // onChange is handled by row click
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {candidate.sharepoint_url ? (
                                      <a
                                        href={candidate.sharepoint_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn('text-sm font-medium text-gray-900 dark:text-ink hover:underline truncate', 'hover:text-brand dark:hover:text-brand-on-dark')}
                                        title={candidate.filename}
                                      >
                                        {candidate.filename}
                                      </a>
                                    ) : (
                                      <span className="text-sm font-medium text-gray-900 dark:text-ink truncate" title={candidate.filename}>{candidate.filename}</span>
                                    )}
                                    {getFileIcon(candidate.filename)}
                                  </div>
                                  {/* Placeholder for metadata to match height/spacing if needed, or actual metadata if we have it */}
                                  <div className="text-xs text-gray-500 dark:text-ink-muted flex items-center gap-2">
                                    <span>Potential Match</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 ml-4">
                                {candidate.download_url && processingFile === candidate.filename && (
                                  <div className="flex items-center rounded px-3 py-1 space-x-2 bg-brand" style={{ minWidth: '140px' }}>
                                    <div className="flex-1 rounded overflow-hidden bg-black/20" style={{ height: '6px' }}>
                                      <div
                                        className="h-full bg-white transition-all duration-500"
                                        style={{ width: `${fileProgress}%` }}
                                      />
                                    </div>
                                    <div className="text-xs text-white whitespace-nowrap font-medium">{fileProgress}%</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'external-candidates' && (
          <div className="p-6">
            {/* Search Form */}
            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
                <Button
                  kind="secondary"
                  size="small"
                  onClick={handleExtractSearchQuery}
                  disabled={!job.description || extractingSearchQuery}
                  loading={extractingSearchQuery}
                >
                  Extract from job
                </Button>
              </div>
              <div className="grid items-end gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,16rem)_5.5rem_auto]">
                <TextField
                  id="external-search-role"
                  title="Role Title"
                  placeholder="e.g., Software Engineer"
                  value={externalSearchRole}
                  onChange={(value) => setExternalSearchRole(value)}
                  size="small"
                  wrapperClassName="w-full"
                />
                <TextField
                  id="external-search-location"
                  title="Location (optional)"
                  placeholder="e.g., San Francisco, CA"
                  value={externalSearchLocation}
                  onChange={(value) => setExternalSearchLocation(value)}
                  size="small"
                  wrapperClassName="w-full"
                />
                <TextField
                  id="external-candidates-count"
                  title="Count"
                  type="number"
                  value={String(externalCandidatesCount)}
                  onChange={(value) => {
                    const next = Number(value);
                    setExternalCandidatesCount(Number.isFinite(next) ? Math.min(50, Math.max(1, next)) : 10);
                  }}
                  size="small"
                  wrapperClassName="w-full"
                />
                <Button
                  kind="primary"
                  size="small"
                  onClick={handleSearchExternalCandidates}
                  disabled={!externalSearchRole.trim() || searchingExternalCandidates}
                  loading={searchingExternalCandidates}
                  className="w-full md:w-auto"
                >
                  Search LinkedIn
                </Button>
              </div>
              {externalSearchRole && (
                <p className="mt-3 text-xs text-gray-500 dark:text-ink-muted">
                  Query: site:linkedin.com/in "{externalSearchRole}"{externalSearchLocation ? ` ${externalSearchLocation}` : ''}
                </p>
              )}
            </div>

            {/* Results Section */}
            {externalCandidates.length === 0 && !searchingExternalCandidates && !externalSearchError ? (
              <EmptyState
                icon={
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                }
                title="External Candidates"
                description="Extract a suggested role and location from the job description, then search LinkedIn for matching profiles."
              />
            ) : (
              <div>
                {searchingExternalCandidates ? (
                  <CardGridSkeleton count={6} />
                ) : externalSearchError && externalCandidates.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    title="Search Failed"
                    description={externalSearchError}
                    action={<Button onClick={handleSearchExternalCandidates} size="small" kind="primary">Try Again</Button>}
                  />
                ) : (
                  <div>
                    {/* Results header with bulk actions */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600 dark:text-ink-muted">
                        {externalCandidates.length} profile{externalCandidates.length !== 1 ? 's' : ''}
                        {selectedExternalIds.size > 0 && ` · ${selectedExternalIds.size} selected`}
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedExternalIds.size > 0 && (
                          <Button
                            kind="primary"
                            size="small"
                            onClick={handleFindEmails}
                            disabled={findingEmails}
                            loading={findingEmails}
                          >
                            {findingEmails ? 'Finding...' : `Find Emails (${selectedExternalIds.size})`}
                          </Button>
                        )}
                        <button
                          onClick={handleSearchExternalCandidates}
                          disabled={searchingExternalCandidates}
                          className={cn('inline-flex items-center px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50', textLink, 'hover:bg-brand-soft dark:hover:bg-brand/10')}
                          title="Refresh email statuses"
                        >
                          <RotateCw className={cn('w-4 h-4 mr-2', searchingExternalCandidates && 'animate-spin')} />
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Profile Cards */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {externalCandidates.map((profile, index) => {
                        const emailStatus = profile.email_status || 'none';
                        const canFindEmail = emailStatus !== 'sent' && emailStatus !== 'replied';
                        const isSelected = canFindEmail && selectedExternalIds.has(profile.linkedinId);
                        const canCompose = emailStatus === 'found';
                        const canViewThread = emailStatus === 'sent' || emailStatus === 'replied';
                        const linkedinUrl = profile.linkedinUrl?.trim();

                        const handleExternalCardClick = () => {
                          if (canCompose) {
                            handleOpenCompose(profile);
                          } else if (canViewThread) {
                            handleOpenThread(profile);
                          } else if (linkedinUrl) {
                            window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
                          }
                        };

                        const isCardClickable = Boolean(
                          canCompose || canViewThread || linkedinUrl
                        );

                        const emailLabelColor =
                          emailStatus === 'found' ? 'positive' :
                          emailStatus === 'not_found' ? 'warning' :
                          emailStatus === 'sent' ? 'bright-blue' :
                          emailStatus === 'replied' ? 'purple' :
                          emailStatus === 'failed' ? 'negative' :
                          'dark';

                        const emailBadgeText =
                          emailStatus === 'found' ? profile.email || 'Email found' :
                          emailStatus === 'not_found' ? 'Email not found' :
                          emailStatus === 'sent' ? 'Email sent' :
                          emailStatus === 'replied' ? 'Replied' :
                          emailStatus === 'failed' ? 'Failed' :
                          'No email';

                        return (
                          <div
                            key={profile.linkedinId || index}
                            role={isCardClickable ? 'button' : undefined}
                            tabIndex={isCardClickable ? 0 : undefined}
                            className={cn(
                              radiusSurface,
                              'bg-white dark:bg-canvas-deep border border-gray-200 dark:border-line p-4 transition-all shadow-sm flex flex-col gap-2',
                              isSelected ? externalCardSelected : externalCardDefault,
                              isCardClickable &&
                                'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'
                            )}
                            onClick={isCardClickable ? handleExternalCardClick : undefined}
                            onKeyDown={
                              isCardClickable
                                ? (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleExternalCardClick();
                                    }
                                  }
                                : undefined
                            }
                          >
                            {/* Header: checkbox + name + LinkedIn icon */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    disabled={!canFindEmail}
                                    onCheckedChange={() => {
                                      if (canFindEmail) handleExternalIdToggle(profile.linkedinId);
                                    }}
                                  />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-ink text-sm leading-snug truncate" title={profile.name || profile.title}>
                                  {profile.name || profile.linkedinId}
                                </h4>
                              </div>
                              {linkedinUrl ? (
                                <a
                                  href={linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn('flex-shrink-0 mt-0.5', textPrimary)}
                                  title="Open LinkedIn profile"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                  </svg>
                                </a>
                              ) : null}
                            </div>

                            {profile.headline && (
                              <p className="text-xs text-gray-600 dark:text-ink-muted line-clamp-2 leading-relaxed" title={profile.headline}>
                                {profile.headline}
                              </p>
                            )}

                            {profile.location && (
                              <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-ink-muted">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{profile.location}</span>
                              </div>
                            )}

                            {profile.snippet && (
                              <p className="text-xs text-gray-400 dark:text-ink-muted line-clamp-2 flex-grow italic" title={profile.snippet}>
                                {profile.snippet}
                              </p>
                            )}

                            {/* Footer */}
                            <div className="border-t border-gray-100 dark:border-line pt-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Label
                                  text={emailBadgeText}
                                  color={emailLabelColor as any}
                                  size="small"
                                  className="!min-w-0 max-w-[130px] shrink-0"
                                />
                                <div className="ml-auto flex shrink-0 items-center gap-3">
                                  {canCompose && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCompose(profile)}
                                      className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline dark:text-green-400"
                                    >
                                      Compose
                                    </button>
                                  )}
                                  {canViewThread && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenThread(profile)}
                                      className={cn('text-xs font-medium hover:underline', textLink)}
                                    >
                                      Thread
                                    </button>
                                  )}
                                  {linkedinUrl && (
                                    <button
                                      type="button"
                                      onClick={() => window.open(linkedinUrl, '_blank', 'noopener,noreferrer')}
                                      className={cn('text-xs font-medium hover:underline', textLink)}
                                    >
                                      Profile
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compose Email Modal */}
      <Dialog open={composeOpen} onOpenChange={(open) => { if (!open) { setComposeOpen(false); setComposeCandidate(null); } }}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>
              Email {composeCandidate?.name || composeCandidate?.linkedinId}
            </DialogTitle>
            {composeCandidate?.headline && (
              <p className="text-xs text-gray-400 dark:text-ink-muted mt-0.5">{composeCandidate.headline}</p>
            )}
          </DialogHeader>

          {composeCandidate && (
            <div className="px-5 py-4 space-y-3">
              {/* From field */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-ink-muted">From</label>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,1fr)_auto] gap-2">
                  <div ref={senderMenuRef} className="relative">
                    <button
                      id="email-from-username"
                      type="button"
                      onClick={() => setSenderMenuOpen(open => !open)}
                      className={cn(
                        'h-8 w-full rounded-md border bg-white dark:bg-canvas-deep px-3 text-sm text-gray-900 dark:text-ink outline-none transition-colors flex items-center justify-between gap-2',
                        senderMenuOpen ? 'border-brand ring-2 ring-brand/20' : 'border-gray-300 dark:border-line hover:border-gray-400 dark:hover:border-ink-muted'
                      )}
                      aria-haspopup="listbox"
                      aria-expanded={senderMenuOpen}
                    >
                      <span className="truncate">{selectedSender.label}</span>
                      <ChevronDown className={cn('h-4 w-4 text-gray-500 dark:text-ink-muted transition-transform', senderMenuOpen && 'rotate-180')} />
                    </button>
                    {senderMenuOpen && (
                      <div
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-[80] mt-1 overflow-hidden rounded-md border border-gray-200 dark:border-line bg-white dark:bg-canvas-deep shadow-lg"
                      >
                        {senderOptions.map(option => {
                          const isSelected = option.value === emailFromAddress;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setEmailFromAddress(option.value);
                                setSenderMenuOpen(false);
                              }}
                              className={cn(
                                'h-8 w-full px-3 text-left text-sm transition-colors flex items-center justify-between gap-2',
                                isSelected
                                  ? 'bg-brand-soft text-gray-900 dark:bg-brand/20 dark:text-ink'
                                  : 'text-gray-700 hover:bg-gray-50 dark:text-ink dark:hover:bg-surface-hover'
                              )}
                            >
                              <span className="truncate">{option.label}</span>
                              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="h-8 px-3 rounded-md border border-gray-200 dark:border-line bg-gray-50 dark:bg-canvas-deep text-sm text-gray-600 dark:text-ink-muted flex items-center">
                    @{CENDIEN_DOMAIN}
                  </div>
                </div>
              </div>

              {/* To field */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-ink-muted">To</label>
                <EmailTagInput emails={emailToAddresses} onChange={setEmailToAddresses} />
              </div>

              {generatingEmail ? (
                <div className="flex items-center gap-2 py-10 justify-center text-sm text-gray-500 dark:text-ink-muted">
                  <div className={cn('animate-spin h-4 w-4 border-2 rounded-full', spinner)} />
                  Generating personalized email...
                </div>
              ) : (
                <>
                  <Input
                    id="email-subject"
                    label="Subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject line..."
                  />
                  <Textarea
                    id="email-body"
                    label="Body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={14}
                    placeholder="Your message..."
                  />
                </>
              )}
            </div>
          )}

          <DialogFooter className="justify-between">
            <Button kind="tertiary" size="small" onClick={handleRegenerateEmail} disabled={generatingEmail || !composeCandidate}>
              Regenerate
            </Button>
            <div className="flex gap-2">
              <Button kind="tertiary" size="small" onClick={() => { setComposeOpen(false); setComposeCandidate(null); }}>
                Cancel
              </Button>
              <Button
                kind="primary"
                size="small"
                onClick={handleSendEmail}
                loading={sendingEmail}
                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim() || emailToAddresses.length === 0}
              >
                {sendingEmail ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Thread Modal */}
      <Dialog open={threadOpen} onOpenChange={(open) => { if (!open) { setThreadOpen(false); setThreadCandidate(null); setThreadMessages([]); } }}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>
                Thread · {threadCandidate?.name || threadCandidate?.linkedinId}
              </DialogTitle>
              <UiButton
                variant="ghost"
                size="icon"
                onClick={handleRefreshThread}
                disabled={fetchingThread}
                title="Refresh thread"
              >
                <RotateCw className={`h-4 w-4 ${fetchingThread ? 'animate-spin' : ''}`} />
              </UiButton>
            </div>
          </DialogHeader>

          {/* Thread messages — single scroll area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-4">
            {fetchingThread && (
              <div className="flex items-center gap-2 py-10 justify-center text-sm text-gray-500 dark:text-ink-muted">
                <div className={cn('animate-spin h-4 w-4 border-2 rounded-full', spinner)} />
                Loading thread...
              </div>
            )}
            {!fetchingThread && threadMessages.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-ink-muted text-center py-10">No messages yet.</div>
            )}
            {!fetchingThread && threadMessages.map((msg, i) => {
              const isSent = msg.direction === 'sent';
              const isHtml = msg.body.trimStart().startsWith('<');
              // Wrap HTML in a minimal document that disables the iframe's own scrollbar.
              // CSP meta blocks script execution; no sandbox so images/fonts/styles load freely (same as email clients).
              const iframeSrcDoc = isHtml
                ? `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline' *; font-src *; media-src *;"><style>html,body{margin:0;padding:12px 16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;}a{color:#2563eb;}</style></head><body>${msg.body}</body></html>`
                : null;
              return (
                <div key={i} className={`flex flex-col gap-1 ${isSent ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-ink-muted">
                    <span className={cn('font-medium', isSent ? emailSentText : 'text-gray-600 dark:text-ink')}>
                      {isSent ? 'You' : threadCandidate?.name || 'Candidate'}
                    </span>
                    {msg.received_at && <span>{new Date(msg.received_at).toLocaleString()}</span>}
                    {msg.subject && <span className="font-medium text-gray-500 dark:text-ink-muted">· {msg.subject}</span>}
                  </div>
                  <div className={cn('rounded-lg border w-full overflow-hidden', isSent ? emailSentBorder : 'border-gray-200 dark:border-line')}>
                    {iframeSrcDoc ? (
                      <iframe
                        key={i}
                        srcDoc={iframeSrcDoc}
                        referrerPolicy="no-referrer"
                        className="w-full border-0 block"
                        style={{ height: '0' }}
                        onLoad={(e) => {
                          const doc = e.currentTarget.contentDocument;
                          if (doc) {
                            const h = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 0;
                            e.currentTarget.style.height = `${h}px`;
                          }
                        }}
                        title={`Email from ${isSent ? 'you' : threadCandidate?.name || 'candidate'}`}
                      />
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-900 dark:text-ink whitespace-pre-wrap leading-relaxed">
                        {msg.body.replace(/<[^>]+>/g, '').trim()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply box */}
          <div className="border-t border-gray-200 dark:border-line px-5 py-3 space-y-2.5">
            <Input
              id="reply-subject"
              label="Subject"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              placeholder="Re: ..."
            />
            <Textarea
              id="reply-body"
              label="Message"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              placeholder="Type your reply..."
            />
            <div className="flex justify-end gap-2">
              <Button
                kind="tertiary"
                size="small"
                loading={generatingEmail}
                onClick={async () => {
                  if (!threadCandidate) return;
                  setGeneratingEmail(true);
                  try {
                    const latestSentBody = [...threadMessages].reverse().find(m => m.direction === 'sent')?.body || '';
                    const result = await apiService.generateCandidateEmail(job.id, threadCandidate.linkedinId, {
                      isFollowup: true,
                      previousBody: latestSentBody,
                    });
                    if (result.success) {
                      setReplySubject(result.subject);
                      setReplyBody(result.body);
                    }
                  } catch { /* ignore */ } finally {
                    setGeneratingEmail(false);
                  }
                }}
                disabled={generatingEmail}
              >
                {generatingEmail ? 'Generating...' : 'Generate follow-up'}
              </Button>
              <Button
                kind="primary"
                size="small"
                onClick={handleSendReply}
                loading={sendingReply}
                disabled={sendingReply || !replySubject.trim() || !replyBody.trim()}
              >
                {sendingReply ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <JobInfographicDialog
        job={job}
        open={infographic.dialogOpen}
        mode={infographic.dialogMode}
        onSwitchToView={() => infographic.switchDialogMode('view')}
        onOpenChange={(open) => {
          if (!open) {
            infographic.closeDialog();
          }
        }}
        previewUrl={infographic.previewUrl}
        loadingPreview={infographic.loadingPreview}
        generating={infographic.generatingInfographic}
        canGenerate={infographic.canGenerate}
        selectedInfographic={infographic.selectedInfographic}
        activeFileId={infographic.activeFileId}
        onSelectVersion={infographic.selectVersion}
        aspectRatio={infographic.aspectRatio}
        onAspectRatioChange={infographic.setAspectRatio}
        imageQuality={infographic.imageQuality}
        onImageQualityChange={infographic.setImageQuality}
        visualTheme={infographic.visualTheme}
        onVisualThemeChange={infographic.setVisualTheme}
        onDownload={infographic.handleDownload}
        onDeleteVersion={infographic.handleDeleteVersion}
        deleting={infographic.deleting}
        onGenerate={infographic.handleGenerate}
      />
    </div>
  );
};

export default JobDetail;

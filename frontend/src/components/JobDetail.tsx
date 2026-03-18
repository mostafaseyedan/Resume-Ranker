import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, Candidate, ChatMessage, apiService, ExternalCandidateProfile, EmailThreadMessage } from '../services/apiService';
import { API_BASE_URL, API_ENDPOINTS } from '../config/apiConfig';
import { useChat } from 'ai/react';
import ResumeUpload from './ResumeUpload';
import CandidateList from './CandidateList';
import CandidateDetail from './CandidateDetail';
import CandidatesGroupedList from './CandidatesGroupedList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { ReactMultiEmail } from 'react-multi-email';
import 'react-multi-email/dist/style.css';
import { Button, SplitButton, SplitButtonMenu, MenuItem, Checkbox, Label, NumberField, TextField, TextArea, IconButton, Icon } from '@vibe/core';
import { Modal as NextModal, ModalHeader as NextModalHeader, ModalContent as NextModalContent, ModalBasicLayout as NextModalBasicLayout } from '@vibe/core/next';
import '@vibe/core/tokens';
import { Retry, PDF, File as FileIcon, Check } from '@vibe/icons';

interface JobDetailProps {
  job: Job;
  onJobUpdated?: (updatedJob: Job) => void;
  initialTab?: 'candidates' | 'resumes' | 'files' | 'job-details' | 'potential-candidates' | 'external-candidates' | 'ai-chat';
}

// Map Monday.com var_name colors to Vibe Label colors (copied from JobList.tsx)
const MONDAY_TO_VIBE_COLOR_MAP: Record<string, string> = {
  // Green variants (done/success)
  'green-shadow': 'done-green',
  'grass-green': 'grass_green',
  'lime-green': 'saladish',

  // Orange/Yellow variants (working/in-progress)
  'orange': 'working_orange',
  'dark-orange': 'dark-orange',
  'yellow': 'egg_yolk',
  'mustered': 'tan',

  // Red variants (stuck/error)
  'red-shadow': 'stuck-red',
  'dark-red': 'dark-red',

  // Pink variants
  'dark-pink': 'sofia_pink',
  'light-pink': 'pink',

  // Purple/Indigo variants
  'dark-purple': 'dark_purple',
  'dark_indigo': 'dark_indigo',
  'purple': 'purple',

  // Blue variants
  'bright-blue': 'bright-blue',
  'blue-links': 'river',
  'sky': 'sky',
  'navy': 'navy',
  'australia': 'aquamarine',

  // Gray/Neutral variants
  'grey': 'american_gray',
  'trolley-grey': 'american_gray',
  'soft-black': 'blackish',
  'dark-grey': 'american_gray',
  'gray': 'american_gray',
  'wolf-gray': 'american_gray',
  'stone': 'american_gray',

  // Special colors
  'sunset': 'sunset',
  'winter': 'winter',
  'sail': 'winter',
  'eden': 'teal',
  'old_rose': 'berry'
};

const COLOR_OVERRIDES: Record<string, string> = {
  'grey': 'american_gray',
  'trolley-grey': 'steel',
  'winter': 'winter',
  'purple_gray': 'lavender',
  'old_rose': 'berry',
  'dark-purple': 'royal',
  'red-shadow': 'stuck-red',
  'green-shadow': 'done-green',
  'blue-links': 'river',
  'sky': 'sky',
  'orange': 'working_orange'
};

const STATIC_VAR_NAME_MAP: Record<string, string> = {
  // Statuses
  'open': 'sky',
  'submitted': 'green-shadow',
  'won': 'lime-green',
  'in progress': 'orange',
  'interviewing': 'light-pink',
  'analysis': 'dark-purple',
  'closed - filled': 'red-shadow',
  'closed': 'old_rose',
  'hold': 'grey',
  'not pursuing': 'trolley-grey',
  'not won': 'dark-orange',
  'monitor': 'sunset',

  // Work Mode
  'onsite': 'orange',
  'remote': 'green-shadow',
  'hybrid': 'purple',
  'uk': 'blue-links',
  'europe': 'australia',
  'latin america': 'grass-green',

  // Employment Type
  'part-time': 'blue-links',
  'consultant': 'grey',
  'full-time': 'winter',
  'contract-to-hire': 'purple'
};

const getVibeLabelColor = (text: string, dynamicVarName?: string): string => {
  // 1. Try dynamic var_name from backend
  if (dynamicVarName) {
    const normalizedVar = dynamicVarName.toLowerCase().replace(/_/g, '-');
    if (COLOR_OVERRIDES[normalizedVar]) return COLOR_OVERRIDES[normalizedVar];
    if (MONDAY_TO_VIBE_COLOR_MAP[normalizedVar]) return MONDAY_TO_VIBE_COLOR_MAP[normalizedVar];
  }

  // 2. Try static fallback based on text content
  if (!text) return 'american_gray';
  const normalizedText = text.toLowerCase().trim();

  let varName = STATIC_VAR_NAME_MAP[normalizedText];

  // Partial matches
  if (!varName) {
    if (normalizedText.includes('open')) varName = 'sky';
    else if (normalizedText.includes('submit')) varName = 'green-shadow';
    else if (normalizedText.includes('won') && !normalizedText.includes('not')) varName = 'lime-green';
    else if (normalizedText.includes('interview')) varName = 'light-pink';
    else if (normalizedText.includes('hold')) varName = 'grey';
    else if (normalizedText.includes('not pursuing')) varName = 'trolley-grey';
    else if (normalizedText.includes('closed')) varName = 'old_rose';
  }

  if (varName) {
    if (COLOR_OVERRIDES[varName]) return COLOR_OVERRIDES[varName];
    if (MONDAY_TO_VIBE_COLOR_MAP[varName]) return MONDAY_TO_VIBE_COLOR_MAP[varName];
  }

  return 'american_gray';
};

// Component to inject CSS variables for custom colors
const CustomColorStyles = () => {
  // Hardcoded Monday Hexes for the overrides we care about
  const MONDAY_HEXES: Record<string, string> = {
    'grey': '#c4c4c4',
    'trolley-grey': '#757575',
    'winter': '#9aadbd',
    'purple_gray': '#9d99b9',
    'old_rose': '#cd9282',
    'royal': '#784bd1',
    'stuck-red': '#df2f4a',
    'done-green': '#00c875',
    'river': '#007eb5',
    'sky': '#216edf',
    'working_orange': '#fdab3d',
    'berry': '#cd9282'
  };

  // Generate CSS
  const css = Object.entries(COLOR_OVERRIDES).map(([varName, token]) => {
    let hex = MONDAY_HEXES[varName];
    if (!hex && MONDAY_HEXES[token]) hex = MONDAY_HEXES[token];

    if (hex) {
      return `--color-${token}: ${hex}; --color-${token}-hover: ${hex}; --color-${token}-selected: ${hex};`;
    }
    return '';
  }).join('\n');

  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        :root {
          ${css}
        }
      `}} />
  );
};

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
  const [chatInitialized, setChatInitialized] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Files Tab State
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [resumeProvider, setResumeProvider] = useState<'gemini' | 'openai'>('gemini');
  const [jobProvider, setJobProvider] = useState<'gemini' | 'openai'>('gemini');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Preview Provider State (null = default/root job data)
  const [previewProvider, setPreviewProvider] = useState<string | null>(null);

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

  const chatApiUrl = useMemo(
    () => `${API_BASE_URL}${API_ENDPOINTS.JOB_CHAT(job.id)}`,
    [job.id]
  );

  const {
    messages: chatMessages,
    input: chatInput,
    handleInputChange: handleChatInputChange,
    handleSubmit: handleChatSubmit,
    isLoading: chatStreaming,
    setMessages: setChatMessages
  } = useChat({
    api: chatApiUrl,
    streamProtocol: 'data',
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        credentials: 'include'
      })
  });

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
    setChatInitialized(false);
    setChatError(null);
    setChatLoading(false);
    setChatMessages([]);

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
        const user = await apiService.getUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };
    loadUser();
  }, [job.id]);

  useEffect(() => {
    if (activeTab !== 'ai-chat' || chatInitialized) {
      return;
    }
    let cancelled = false;
    setChatLoading(true);
    setChatError(null);
    apiService.getJobChat(job.id)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const messages = (response.messages || []) as ChatMessage[];
        setChatMessages(messages);
        setChatInitialized(true);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setChatError(err?.response?.data?.error || err.message || 'Failed to load chat history');
      })
      .finally(() => {
        if (!cancelled) {
          setChatLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, chatInitialized, job.id, setChatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatStreaming]);

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

      const response = await apiService.processSharePointJobFile(
        downloadUrl,
        fileName,
        job.id,
        jobProvider
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
      const uploadResponse = await apiService.uploadResume(job.id, file, resumeProvider);

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
    try {
      setFindingEmails(true);
      const response = await apiService.findCandidateEmails(job.id, Array.from(selectedExternalIds));
      if (response.success) {
        setExternalCandidates(prev =>
          prev.map(c => {
            const r = response.results[c.linkedinId];
            return r ? { ...c, email: r.email ?? undefined, email_status: r.email_status } : c;
          })
        );
        toast.success(`Emails found for ${Object.values(response.results).filter(r => r.email_status === 'found').length} of ${selectedExternalIds.size} candidates`);
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
      const result = await apiService.sendCandidateEmail(job.id, composeCandidate.linkedinId, emailSubject.trim(), emailBody.trim(), emailToAddresses);
      if (result.success) {
        setExternalCandidates(prev =>
          prev.map(c => c.linkedinId === composeCandidate.linkedinId ? { ...c, email_status: 'sent' } : c)
        );
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
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-[#d5d8df] whitespace-pre-wrap">
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

  const handleFileToggle = (fileName: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const uniqueFiles = getUniqueFiles();
    if (selectedFiles.size === uniqueFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(uniqueFiles.map(f => f.name)));
    }
  };

  const handleBatchResume = async () => {
    if (selectedFiles.size === 0) return;
    setBatchProcessing(true);
    toast.info(`Starting batch resume analysis for ${selectedFiles.size} files...`);

    const uniqueFiles = getUniqueFiles();
    const filesToProcess = uniqueFiles.filter(f => selectedFiles.has(f.name));

    try {
      for (const file of filesToProcess) {
        // We await each one to avoid overwhelming the server, or we could Promise.all for parallel
        // Sequential is safer for now given the complexity of analysis
        await handleProcessResumeFile(file.download_url, file.name, file.id, file.site_id, file.drive_id);
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
    const filesToProcess = uniqueFiles.filter(f => selectedFiles.has(f.name));

    try {
      for (const file of filesToProcess) {
        await handleProcessJobFile(file.download_url, file.name);
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
        return <Icon icon={FileIcon} iconSize={20} className="text-blue-600" />;
      case 'xls':
      case 'xlsx':
        return <Icon icon={FileIcon} iconSize={20} className="text-green-600" />;
      default:
        return <Icon icon={FileIcon} iconSize={20} className="text-gray-400" />;
    }
  };

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

    try {
      for (const file of filesToProcess) {
        if (!file.download_url) continue;
        await handleProcessResumeFile(
          file.download_url,
          file.filename,
          (file as any).id,
          (file as any).site_id,
          (file as any).drive_id
        );
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
        onBack={handleBackToCandidates}
        job={job}
        hasImprovedVersion={hasImprovedVersion}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-[#30324e] shadow">
      <CustomColorStyles />
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] dark:border-[#4b4e69] px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#d5d8df] dark:text-[#d5d8df]">{job.title}</h2>
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
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{getUniqueCandidateCount()}</div>
            <div className="text-sm text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6]">Candidate{getUniqueCandidateCount() !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] dark:border-[#4b4e69]">
        <nav className="-mb-px flex items-center justify-between">
          <button
            onClick={() => {
              setActiveTab('files');
              if (!sharepointFiles && !loadingSharePoint) {
                loadSharePointFiles();
              }
            }}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'files'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#797e93]'
              }`}
          >
            Files
          </button>
	          <button
	            onClick={() => {
	              setActiveTab('candidates');
	              setSelectedGroupCandidates(null);
	            }}
	            className={`py-2 px-4 text-sm font-medium ${activeTab === 'candidates'
	              ? 'border-b-2 border-blue-500 text-blue-600'
	              : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] hover:border-gray-300'
	              }`}
	          >
	            Candidates ({getUniqueCandidateCount()})
	          </button>
          <button
            onClick={() => setActiveTab('resumes')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'resumes'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#797e93]'
              }`}
          >
            Resumes ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('potential-candidates')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'potential-candidates'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#797e93]'
              }`}
          >
            Internal Candidates
          </button>
          <button
            onClick={() => setActiveTab('external-candidates')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'external-candidates'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#797e93]'
              }`}
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
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'job-details'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#797e93]'
              }`}
          >
            Job Details
          </button>
          <button
            onClick={() => setActiveTab('ai-chat')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'ai-chat'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-[#9699a6] dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#797e93]'
              }`}
          >
            Chat
          </button>
          <button
            onClick={(e) => handleDeleteJob(job.id, e as any)}
            className="ml-auto mr-4 text-gray-400 dark:text-[#9699a6] hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 p-2"
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
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-lg">Loading candidates...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400">
                <div className="text-lg mb-2">Error</div>
                <div>{error}</div>
                <button
                  onClick={loadCandidates}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : selectedGroupCandidates ? (
              <div>
                <button
                  onClick={handleBackToCandidatesList}
                  className="mb-4 flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Candidates
                </button>
                <CandidateList
                  candidates={selectedGroupCandidates}
                  onCandidateSelect={handleCandidateSelect}
                  onCandidateDeleted={handleCandidateDeleted}
                  sharepointFiles={sharepointFiles}
                />
              </div>
            ) : (
              <CandidatesGroupedList
                candidates={candidates}
                onCandidateSelect={handleCandidateGroupSelect}
                onCandidateDeleted={handleCandidateDeleted}
              />
            )}
          </div>
        )}

        {activeTab === 'resumes' && (
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-lg">Loading resumes...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400">
                <div className="text-lg mb-2">Error</div>
                <div>{error}</div>
                <button
                  onClick={loadCandidates}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
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
          <div className="space-y-6 p-6">
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
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-start justify-between gap-3 bg-gray-50 dark:bg-[#181b34] p-3 border border-gray-200 dark:border-[#4b4e69]">
                      <div className="flex items-center space-x-4 text-sm mt-1">
                        <button
                          onClick={handleSelectAll}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedFiles.size === getUniqueFiles().length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-gray-600 dark:text-[#9699a6]">
                          {selectedFiles.size} selected
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Resume Split Button */}
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
                                title="Gemini Flash"
                                onClick={() => setResumeProvider('gemini')}
                                rightIcon={resumeProvider === 'gemini' ? Check : undefined}
                              />
                              <MenuItem
                                id="resume-openai"
                                title="ChatGPT 5.1"
                                onClick={() => setResumeProvider('openai')}
                                rightIcon={resumeProvider === 'openai' ? Check : undefined}
                              />
                            </SplitButtonMenu>
                          }
                        >
                          {batchProcessing ? 'Processing...' : 'Analyze Resume'}
                        </SplitButton>

                        {/* Job Description Split Button */}
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
                                title="Gemini Flash"
                                onClick={() => setJobProvider('gemini')}
                                rightIcon={jobProvider === 'gemini' ? Check : undefined}
                              />
                              <MenuItem
                                id="job-openai"
                                title="ChatGPT 5.1"
                                onClick={() => setJobProvider('openai')}
                                rightIcon={jobProvider === 'openai' ? Check : undefined}
                              />
                            </SplitButtonMenu>
                          }
                        >
                          {batchProcessing ? 'Processing...' : 'Review Job'}
                        </SplitButton>
                      </div>
                    </div>

                    {/* File List */}
                    {(() => {
                      const uniqueFiles = getUniqueFiles();
                      const getKind = (file: any): 'job' | 'resume' | 'unknown' => {
                        const normalizedName = String(file?.name || '').toLowerCase().trim();
                        const pathLower = String(file?.path || '').toLowerCase();
                        if (pathLower.includes('resume')) return 'resume';
                        if (pathLower.includes('job') || pathLower.includes('jd') || pathLower.includes('description')) return 'job';
                        if (fileNameSets.jobNames.has(normalizedName)) return 'job';
                        if (fileNameSets.resumeNames.has(normalizedName)) return 'resume';
                        return 'unknown';
                      };
                      const kindRank = (kind: 'job' | 'resume' | 'unknown') => (kind === 'job' ? 0 : kind === 'resume' ? 1 : 2);
                      const sortedFiles = [...uniqueFiles].sort((a: any, b: any) => {
                        const rank = kindRank(getKind(a)) - kindRank(getKind(b));
                        if (rank !== 0) return rank;
                        return String(a?.name || '').localeCompare(String(b?.name || ''));
                      });

                      return sortedFiles.length > 0 ? (

                        <div className="bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#4b4e69] overflow-hidden">
                          {sortedFiles.map((file, index) => {
                            const isSelected = selectedFiles.has(file.name);
                            const normalizedName = String(file?.name || '').toLowerCase().trim();
                            const pathLower = String(file?.path || '').toLowerCase();
                            const fileKind: 'job' | 'resume' | null =
                              pathLower.includes('resume')
                                ? 'resume'
                                : pathLower.includes('job') || pathLower.includes('jd') || pathLower.includes('description')
                                  ? 'job'
                                  : fileNameSets.jobNames.has(normalizedName)
                                    ? 'job'
                                    : fileNameSets.resumeNames.has(normalizedName)
                                      ? 'resume'
                                      : null;
                            return (
                              <div
                                key={index}
                                onClick={() => handleFileToggle(file.name)}
                                className={`flex items-center justify-between p-3 transition-colors cursor-pointer border-b border-gray-100 last:border-0 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-[#3a3d5c] dark:bg-[#181b34]'
                                  }`}
                              >
                                <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                                  <div className="flex-shrink-0 pointer-events-none">
                                    <Checkbox
                                      checked={isSelected}
                                    // onChange is handled by row click
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0 flex items-start gap-2">
                                    {(fileKind === 'job' || fileKind === 'resume') && (
                                      <Label
                                        id={`file-kind-${fileKind}-${index}`}
                                        text={fileKind === 'job' ? 'Job' : 'Resume'}
                                        size="medium"
                                        color={fileKind === 'job' ? 'positive' : 'bright-blue'}
                                        className="flex-shrink-0 mt-0.5"
                                      />
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <a
                                          href={file.web_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-sm font-medium text-gray-900 dark:text-[#d5d8df] hover:text-blue-600 hover:underline truncate"
                                          title={file.name}
                                        >
                                          {file.name}
                                        </a>
                                        {getFileIcon(file.name)}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-[#9699a6] flex items-center gap-2">
                                        <span className="truncate">{file.path}</span>
                                        <span>•</span>
                                        <span>{Math.round(file.size / 1024)} KB</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 ml-4">
                                  {processingFile === file.name && (
                                    <div className={`flex items-center rounded px-3 py-1 space-x-2 ${processingFileType === 'job' ? 'bg-green-600' : 'bg-blue-600'}`} style={{ minWidth: '140px' }}>
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
                      ) : (
                        <div className="bg-gray-50 dark:bg-[#181b34] p-8 text-center text-gray-500 dark:text-[#9699a6] border border-dashed border-gray-300">
                          No files found in SharePoint folder
                        </div>
                      );
                    })()}

                    <div className="text-xs text-gray-500 dark:text-[#9699a6] mt-2 text-right">
                      <a href={sharepointFiles.sharepoint_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        Open SharePoint folder
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-[#181b34] p-4">
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
          <div className="flex flex-col">

            {/* Context Header (between tabs) */}
            <div className="border-b border-gray-200 dark:border-[#4b4e69] py-3 px-6 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">
                  {job.source_filename || sharepointFiles?.job_files?.[0]?.name}
                </h2>
                {job.reviewed_by && (
                  <div className="flex items-center gap-2 mt-1 text-gray-500 dark:text-[#9699a6] text-xs">
                    <span>{job.reviewed_by}</span>
                    <span>•</span>
                    <span>Updated {(job as any).updated_at ? new Date((job as any).updated_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3">
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
                  className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-[#9699a6] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#3a3d5c] rounded transition-colors"
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
            <div className="border-b border-gray-200 dark:border-[#4b4e69] px-6">
              <nav className="flex w-full items-center gap-6" aria-label="Job Detail Sections">
                {JOB_DETAIL_SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    onClick={() => setActiveJobDetailSection(section.key)}
                    className={`whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${activeJobDetailSection === section.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:text-[#d5d8df] hover:border-gray-300'
                      }`}
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
                  <div className="border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-gray-50 dark:bg-[#181b34] shadow-sm">

                    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 dark:text-[#d5d8df]">
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
                            <strong className="font-bold text-gray-900 dark:text-[#d5d8df]" {...props} />
                          ),
                          table: ({ ...props }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                            </div>
                          ),
                          thead: ({ ...props }) => (
                            <thead className="bg-gray-100 dark:bg-[#30324e]" {...props} />
                          ),
                          tbody: ({ ...props }) => (
                            <tbody className="divide-y divide-gray-200 bg-white" {...props} />
                          ),
                          tr: ({ ...props }) => (
                            <tr className="hover:bg-gray-50 dark:hover:bg-[#3a3d5c] dark:bg-[#181b34]" {...props} />
                          ),
                          th: ({ ...props }) => (
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900 dark:text-[#d5d8df] border-r border-gray-300 last:border-r-0" {...props} />
                          ),
                          td: ({ ...props }) => (
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-[#d5d8df] border-r border-gray-300 last:border-r-0" {...props} />
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
                    <div className="border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-gray-50 dark:bg-[#181b34] shadow-sm">
                      <div className="mb-3">
                        <h3 className="m-0 font-semibold text-gray-900 dark:text-[#d5d8df]">Analysis Summary</h3>
                      </div>
                      <div className="space-y-2 text-sm leading-normal text-gray-700 dark:text-[#d5d8df]">
                        {Object.entries(displayedJob.requirements).map(([key, value]) => (
                          <div key={key} className="flex flex-col sm:flex-row">
                            <span className="font-medium text-gray-600 dark:text-[#9699a6] capitalize sm:w-32 mb-1 sm:mb-0">
                              {key.replace('_', ' ')}:
                            </span>
                            <span className="text-gray-700 dark:text-[#d5d8df]">
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
                                className="px-3 py-1 bg-white dark:bg-[#30324e] border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 hover:shadow-sm transition-all cursor-pointer"
                              >
                                {skill}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preferred Skills */}
                      {displayedJob.extracted_data.preferred_skills && displayedJob.extracted_data.preferred_skills.length > 0 && (
                        <div className="border border-blue-200 dark:border-blue-700 p-4 mb-3 bg-blue-50 dark:bg-blue-900/20 shadow-sm">
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-blue-800 dark:text-blue-300">Preferred Skills</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {displayedJob.extracted_data.preferred_skills.map((skill: string, index: number) => (
                              <button
                                key={index}
                                onClick={() => handleSkillClick(skill)}
                                className="px-3 py-1 bg-white dark:bg-[#30324e] border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:shadow-sm transition-all cursor-pointer"
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
                          <p className="text-sm leading-normal text-gray-700 dark:text-[#d5d8df]">
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
                          <ul className="list-disc list-inside space-y-1 text-sm leading-normal text-gray-700 dark:text-[#d5d8df]">
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
                                className="px-3 py-1 bg-white dark:bg-[#30324e] border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 text-sm font-medium hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:shadow-sm transition-all cursor-pointer"
                              >
                                {cert}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key Responsibilities */}
                      {displayedJob.extracted_data.key_responsibilities && displayedJob.extracted_data.key_responsibilities.length > 0 && (
                        <div className="border border-indigo-200 dark:border-indigo-700 p-4 mb-3 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm">
                          <div className="mb-3">
                            <h3 className="m-0 font-semibold text-indigo-800 dark:text-indigo-300">Key Responsibilities</h3>
                          </div>
                          <ul className="list-disc list-inside space-y-2 text-sm leading-normal text-gray-700 dark:text-[#d5d8df]">
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
                                className="px-3 py-1 bg-white dark:bg-[#30324e] border border-pink-200 dark:border-pink-700 text-pink-800 dark:text-pink-300 text-sm font-medium"
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
                    <div className="border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-gray-50 dark:bg-[#181b34] shadow-sm">

                      <ul className="list-disc list-inside space-y-1 text-sm leading-normal text-gray-700 dark:text-[#d5d8df]">
                        {displayedJob.extracted_data.other.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-[#9699a6] italic">No additional information extracted.</div>
                  )}
                </div>
              )}

              {activeJobDetailSection === 'weights' && (
                <div>
                  {displayedJob.skill_weights && Object.keys(displayedJob.skill_weights).length > 0 ? (
                    <div className="border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-gray-50 dark:bg-[#181b34] shadow-sm">

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(displayedJob.skill_weights).map(([skill, weight]) => (
                          <div key={skill} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#181b34] border border-gray-100">
                            <span className="text-sm font-medium text-gray-700 dark:text-[#d5d8df]">{skill}</span>
                            <div className="flex items-center space-x-3">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${(Number(weight) / 10) * 100}%` }}
                                ></div>
                              </div>
                              <div className="text-sm text-gray-900 dark:text-[#d5d8df]">{Number(displayedJob.skill_weights![skill] || 0)}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-[#9699a6] italic">No skill weights available.</div>
                  )}
                </div>
              )}

              {activeJobDetailSection === 'questions' && (
                <div>
                  {displayedJob.extracted_data && displayedJob.extracted_data.questions_for_candidate && displayedJob.extracted_data.questions_for_candidate.length > 0 ? (
                    <div className="border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-gray-50 dark:bg-[#181b34] shadow-sm">
                      <div className="mb-4">
                        <h3 className="m-0 font-semibold text-base text-gray-900 dark:text-[#d5d8df]">
                          Questions for Candidate
                        </h3>
                        <p className="mt-2 text-xs text-gray-600 dark:text-[#9699a6]">
                          Key questions to assess candidate suitability
                        </p>
                      </div>
                      <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed text-gray-700 dark:text-[#d5d8df]">
                        {displayedJob.extracted_data.questions_for_candidate.map((question: string, index: number) => (
                          <li key={index} className="pl-2">{question}</li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-[#9699a6] italic">No interview questions generated for this position.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai-chat' && (
          <div className="h-full w-full">
            <div className="flex h-full w-full flex-col bg-white">
              {chatLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9699a6]">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    Loading chat history...
                  </div>
                </div>
              ) : chatError ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <div className="text-sm text-red-600 dark:text-red-400">{chatError}</div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {chatMessages.length === 0 && !chatStreaming ? (
                      <div className="text-sm text-gray-500 dark:text-[#9699a6]">
                        Ask about the job, candidates, or resume improvements to get started.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((message, index) => {
                          const isUser = message.role === 'user';
                          return (
                            <div key={message.id || index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[75%] rounded-md px-3 py-2 text-sm leading-relaxed ${
                                  isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df]'
                                }`}
                              >
                                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {chatStreaming && (
                          <div className="flex justify-start">
                            <div className="max-w-[75%] rounded-md bg-gray-100 dark:bg-[#30324e] px-3 py-2 text-sm text-gray-700 dark:text-[#d5d8df]">
                              Generating response...
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleChatSubmit} className="border-t border-gray-200 dark:border-[#4b4e69] px-4 py-2">
                    <div className="flex items-center bg-white">
                      <textarea
                        value={chatInput}
                        onChange={handleChatInputChange}
                        placeholder="Type your question"
                        rows={2}
                        disabled={chatStreaming}
                        className="w-full resize-none border-0 px-3 py-2 text-sm text-gray-900 dark:text-[#d5d8df] focus:outline-none"
                      />
                      <div className="border-l border-transparent px-2 py-2">
                        <Button
                          type="submit"
                          disabled={chatStreaming || chatInput.trim().length === 0}
                          size="small"
                          kind="primary"
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'potential-candidates' && (
          <div className="p-6">
            {potentialCandidates.length === 0 && !searchingCandidates && !searchError ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">Internal Candidates</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">
                  Search the knowledge base to find candidates whose skills and experience match this position.
                </p>
                <div className="mt-6">
                  <Button
                    onClick={handleSearchPotentialCandidates}
                    disabled={!job.description}
                    size="small"
                    kind="primary"
                  >
                    {!job.description ? 'Add Job Description First' : 'Start AI Search'}
                  </Button>
                </div>
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
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-[#d5d8df] mb-2">Searching Knowledge Base</h4>
                    <p className="text-gray-600 dark:text-[#9699a6]">AI is analyzing resumes to find the best matches...</p>
                  </div>
                ) : searchError ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">Search Failed</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">{searchError}</p>
                    <div className="mt-6">
                      <Button onClick={handleSearchPotentialCandidates} size="small" kind="primary">
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Internal Candidates</h3>
                      <button
                        onClick={handleSearchPotentialCandidates}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                        title="Refresh search"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    {geminiResponse && (
                      <div className="border border-gray-300 dark:border-[#4b4e69] p-4 mb-6 bg-gray-50 dark:bg-[#181b34] shadow-sm">
                        <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 dark:text-[#d5d8df]">
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
                                <strong className="font-bold text-gray-900 dark:text-[#d5d8df]" {...props} />
                              ),
                              table: ({ ...props }) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                                </div>
                              ),
                              thead: ({ ...props }) => (
                                <thead className="bg-gray-100 dark:bg-[#30324e]" {...props} />
                              ),
                              tbody: ({ ...props }) => (
                                <tbody className="divide-y divide-gray-200 bg-white" {...props} />
                              ),
                              tr: ({ ...props }) => (
                                <tr className="hover:bg-gray-50 dark:hover:bg-[#3a3d5c] dark:bg-[#181b34]" {...props} />
                              ),
                              th: ({ ...props }) => (
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900 dark:text-[#d5d8df] border-r border-gray-300 last:border-r-0" {...props} />
                              ),
                              td: ({ ...props }) => (
                                <td className="px-4 py-2 text-sm text-gray-700 dark:text-[#d5d8df] border-r border-gray-300 last:border-r-0" {...props} />
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
                      <div className="flex flex-wrap items-start justify-between gap-3 bg-gray-50 dark:bg-[#181b34] p-3 border border-gray-200 dark:border-[#4b4e69]">
                        <div className="flex items-center space-x-4 text-sm mt-1">
                          <button
                            onClick={handleSelectAllPotential}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {selectedPotentialFiles.size === potentialCandidates.length && potentialCandidates.length > 0 ? 'Deselect All' : 'Select All'}
                          </button>
                          <span className="text-gray-600 dark:text-[#9699a6]">
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
                      <div className="bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#4b4e69] overflow-hidden">
                        {potentialCandidates.map((candidate, index) => {
                          const isSelected = selectedPotentialFiles.has(candidate.filename);
                          return (
                            <div
                              key={index}
                              onClick={() => handlePotentialFileToggle(candidate.filename)}
                              className={`flex items-center justify-between p-3 transition-colors cursor-pointer border-b border-gray-100 last:border-0 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-[#3a3d5c] dark:bg-[#181b34]'}`}
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
                                        className="text-sm font-medium text-gray-900 dark:text-[#d5d8df] hover:text-blue-600 hover:underline truncate"
                                        title={candidate.filename}
                                      >
                                        {candidate.filename}
                                      </a>
                                    ) : (
                                      <span className="text-sm font-medium text-gray-900 dark:text-[#d5d8df] truncate" title={candidate.filename}>{candidate.filename}</span>
                                    )}
                                    {getFileIcon(candidate.filename)}
                                  </div>
                                  {/* Placeholder for metadata to match height/spacing if needed, or actual metadata if we have it */}
                                  <div className="text-xs text-gray-500 dark:text-[#9699a6] flex items-center gap-2">
                                    <span>Potential Match</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 ml-4">
                                {candidate.download_url && processingFile === candidate.filename && (
                                  <div className="flex items-center rounded px-3 py-1 space-x-2 bg-blue-600" style={{ minWidth: '140px' }}>
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
            <h4 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df] mb-3">LinkedIn Search Query</h4>
            <div className="bg-gray-50 dark:bg-[#181b34] border border-gray-200 dark:border-[#4b4e69] p-4 mb-6">
              <div className="flex flex-wrap items-end gap-8">
                <div className="min-w-64 max-w-md" style={{ width: `${Math.max(256, externalSearchRole.length * 9 + 24)}px` }}>
                  <TextField
                    id="external-search-role"
                    title="Role Title"
                    placeholder="e.g., Software Engineer"
                    value={externalSearchRole}
                    onChange={(value) => setExternalSearchRole(value)}
                    size="small"
                  />
                </div>
                <div className="w-48">
                  <TextField
                    id="external-search-location"
                    title="Location (optional)"
                    placeholder="e.g., San Francisco, CA"
                    value={externalSearchLocation}
                    onChange={(value) => setExternalSearchLocation(value)}
                    size="small"
                  />
                </div>
                <div className="w-24">
                  <NumberField
                    id="external-candidates-count"
                    label="Count"
                    value={externalCandidatesCount}
                    onChange={(value) => setExternalCandidatesCount(value ?? 10)}
                    min={1}
                    max={50}
                    size="small"
                  />
                </div>
                <div className="flex-1"></div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExtractSearchQuery}
                    disabled={!job.description || extractingSearchQuery}
                    size="small"
                    kind="tertiary"
                  >
                    {extractingSearchQuery ? 'Extracting...' : 'Extract'}
                  </Button>
                  <Button
                    onClick={handleSearchExternalCandidates}
                    disabled={!externalSearchRole.trim() || searchingExternalCandidates}
                    size="small"
                    kind="primary"
                  >
                    {searchingExternalCandidates ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
              {externalSearchRole && (
                <p className="mt-3 text-xs text-gray-500 dark:text-[#9699a6]">
                  Query: site:linkedin.com/in "{externalSearchRole}"{externalSearchLocation ? ` ${externalSearchLocation}` : ''}
                </p>
              )}
            </div>

            {/* Results Section */}
            {externalCandidates.length === 0 && !searchingExternalCandidates && !externalSearchError ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <p className="mt-4 text-sm text-gray-500 dark:text-[#9699a6]">
                  Click "Extract" to get suggested role and location from the job description, then click "Search".
                </p>
              </div>
            ) : (
              <div>
                {searchingExternalCandidates ? (
                  <div className="text-center py-16">
                    <div className="relative mb-6">
                      <div className="animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-[#d5d8df] mb-2">Searching LinkedIn</h4>
                    <p className="text-gray-600 dark:text-[#9699a6]">Finding matching profiles...</p>
                  </div>
                ) : externalSearchError && externalCandidates.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-sm text-gray-500 dark:text-[#9699a6]">{externalSearchError}</p>
                  </div>
                ) : (
                  <div>
                    {/* Results header with bulk actions */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600 dark:text-[#9699a6]">
                        {externalCandidates.length} profile{externalCandidates.length !== 1 ? 's' : ''}
                        {selectedExternalIds.size > 0 && ` · ${selectedExternalIds.size} selected`}
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedExternalIds.size > 0 && (
                          <button
                            type="button"
                            onClick={handleFindEmails}
                            disabled={findingEmails}
                            className="text-xs font-semibold px-3 py-1.5 rounded border border-teal-500 text-teal-600 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {findingEmails ? 'Finding...' : `Find Emails (${selectedExternalIds.size})`}
                          </button>
                        )}
                        <IconButton
                          kind="tertiary"
                          size="small"
                          icon={Retry}
                          ariaLabel="Refresh email statuses"
                          onClick={handleSearchExternalCandidates}
                          disabled={searchingExternalCandidates}
                        />
                      </div>
                    </div>

                    {/* Profile Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {externalCandidates.map((profile, index) => {
                        const emailStatus = profile.email_status || 'none';
                        const isSelected = selectedExternalIds.has(profile.linkedinId);
                        const canCompose = emailStatus === 'found';
                        const canViewThread = emailStatus === 'sent' || emailStatus === 'replied';

                        const emailBadgeClass =
                          emailStatus === 'found' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                          emailStatus === 'not_found' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
                          emailStatus === 'sent' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400' :
                          emailStatus === 'replied' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' :
                          emailStatus === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                          'bg-gray-100 dark:bg-[#30324e] text-gray-600 dark:text-[#9699a6]';

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
                            className={`bg-white dark:bg-[#30324e] border-l-4 ${isSelected ? 'border-l-indigo-500' : 'border-l-blue-500 dark:border-l-blue-400'} border border-gray-200 dark:border-[#4b4e69] p-4 transition-all shadow-sm flex flex-col overflow-hidden cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                            onClick={() => handleExternalIdToggle(profile.linkedinId)}
                          >
                            {/* Header: checkbox + name + LinkedIn icon */}
                            <div className="flex justify-between items-start mb-2 gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleExternalIdToggle(profile.linkedinId)}
                                  />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-[#d5d8df] text-base truncate" title={profile.name || profile.title}>
                                  {profile.name || profile.linkedinId}
                                </h4>
                              </div>
                              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </div>

                            {profile.headline && (
                              <p className="text-sm text-gray-700 dark:text-[#d5d8df] mb-2 line-clamp-2" title={profile.headline}>
                                {profile.headline}
                              </p>
                            )}

                            {profile.location && (
                              <div className="flex items-center gap-1 mb-2 text-xs text-gray-500 dark:text-[#9699a6]">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{profile.location}</span>
                              </div>
                            )}

                            {profile.snippet && (
                              <p className="text-xs text-gray-500 dark:text-[#9699a6] line-clamp-2 flex-grow" title={profile.snippet}>
                                {profile.snippet}
                              </p>
                            )}

                            {/* Footer */}
                            <div className="border-t border-gray-100 dark:border-[#4b4e69] pt-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                {/* Badge */}
                                <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 truncate max-w-[120px] flex-shrink-0 ${emailBadgeClass}`} title={emailBadgeText}>
                                  {emailBadgeText}
                                </span>
                                {/* Compose — center */}
                                <div className="flex-1 flex justify-center">
                                  {canCompose && (
                                    <Button
                                      kind="tertiary"
                                      size="xs"
                                      color="positive"
                                      onClick={() => handleOpenCompose(profile)}
                                    >
                                      Compose
                                    </Button>
                                  )}
                                </div>
                                {/* View Thread + Profile — right */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {canViewThread && (
                                    <Button
                                      kind="tertiary"
                                      size="xs"
                                      onClick={() => handleOpenThread(profile)}
                                    >
                                      View Thread
                                    </Button>
                                  )}
                                  <Button
                                    kind="tertiary"
                                    size="xs"
                                    color="primary"
                                    className="!text-blue-600 dark:!text-blue-400"
                                    onClick={() => window.open(profile.linkedinUrl, '_blank', 'noopener,noreferrer')}
                                  >
                                    Profile
                                  </Button>
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
      <NextModal
        id="compose-email-modal"
        show={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeCandidate(null); }}
        size="medium"
        style={{
          ['--top-actions-margin-block' as string]: 'var(--spacing-medium)',
          ['--top-actions-margin-inline' as string]: 'var(--spacing-medium)',
          ['--border-radius-big' as string]: '4px',
        }}
      >
        <NextModalBasicLayout>
          <NextModalHeader
            title={
              <span className="text-base font-semibold text-gray-700 dark:text-[#d5d8df]">
                Email {composeCandidate?.name || composeCandidate?.linkedinId}
              </span>
            }
          />
          <NextModalContent>
            {composeCandidate && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-[#9699a6] mb-1">To</label>
                  <ReactMultiEmail
                    emails={emailToAddresses}
                    onChange={setEmailToAddresses}
                    autoFocus={false}
                    placeholder="Add email address..."
                    getLabel={(email, index, removeEmail) => (
                      <div data-tag key={index} className="flex items-center gap-1" style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '4px', padding: '2px 6px', fontSize: '12px' }}>
                        <span data-tag-item>{email}</span>
                        <span data-tag-handle onClick={() => removeEmail(index)} style={{ cursor: 'pointer', marginLeft: '4px', opacity: 0.6 }}>×</span>
                      </div>
                    )}
                    style={{
                      border: '1px solid var(--color-ui-border-color, #d0d4e4)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      minHeight: '36px',
                      fontSize: '13px',
                      background: 'var(--color-ui-background, #fff)',
                    }}
                  />
                  {composeCandidate.headline && (
                    <p className="text-xs text-gray-400 dark:text-[#9699a6] mt-1">{composeCandidate.headline}</p>
                  )}
                </div>
                {generatingEmail ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500 dark:text-[#9699a6]">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    Generating personalized email...
                  </div>
                ) : (
                  <>
                    <TextField
                      id="email-subject"
                      title="Subject"
                      value={emailSubject}
                      onChange={(value) => setEmailSubject(value)}
                      size="small"
                    />
                    <TextArea
                      label="Body"
                      value={emailBody}
                      onChange={(event) => setEmailBody(event.target.value)}
                      size="small"
                      rows={8}
                    />
                    <div className="flex items-center justify-between">
                      <Button kind="tertiary" size="small" onClick={handleRegenerateEmail} disabled={generatingEmail}>
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
                          disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim() || emailToAddresses.length === 0}
                        >
                          {sendingEmail ? 'Sending...' : 'Send'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </NextModalContent>
        </NextModalBasicLayout>
      </NextModal>

      {/* Email Thread Modal */}
      <NextModal
        id="email-thread-modal"
        show={threadOpen}
        onClose={() => { setThreadOpen(false); setThreadCandidate(null); setThreadMessages([]); }}
        size="medium"
        style={{
          ['--top-actions-margin-block' as string]: 'var(--spacing-medium)',
          ['--top-actions-margin-inline' as string]: 'var(--spacing-medium)',
          ['--border-radius-big' as string]: '4px',
        }}
      >
        <NextModalBasicLayout>
          <NextModalHeader
            title={
              <div className="flex items-center justify-between w-full pr-8">
                <span className="text-base font-semibold text-gray-700 dark:text-[#d5d8df]">
                  Thread · {threadCandidate?.name || threadCandidate?.linkedinId}
                </span>
                <IconButton
                  kind="tertiary"
                  size="small"
                  icon={Retry}
                  ariaLabel="Refresh thread"
                  onClick={handleRefreshThread}
                  disabled={fetchingThread}
                  loading={fetchingThread}
                />
              </div>
            }
          />
          <NextModalContent>
            <div className="flex flex-col" style={{ height: '500px' }}>
              {/* Thread messages */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {fetchingThread && (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500 dark:text-[#9699a6]">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    Loading thread...
                  </div>
                )}
                {!fetchingThread && threadMessages.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-[#9699a6] text-center py-8">No messages yet.</div>
                )}
                {!fetchingThread && threadMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 text-sm rounded ${msg.direction === 'sent' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df]'}`}>
                      <div className="text-xs mb-1 opacity-70">{msg.direction === 'sent' ? 'You' : threadCandidate?.name || 'Candidate'} · {msg.received_at ? new Date(msg.received_at).toLocaleString() : ''}</div>
                      <div className="font-medium text-xs mb-1">{msg.subject}</div>
                      <div className="whitespace-pre-wrap text-xs">{msg.body.replace(/<[^>]+>/g, '').trim()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="border-t border-gray-200 dark:border-[#4b4e69] pt-3 space-y-2">
                <TextField
                  id="reply-subject"
                  title="Subject"
                  value={replySubject}
                  onChange={(value) => setReplySubject(value)}
                  size="small"
                  placeholder="Re: ..."
                />
                <TextArea
                  label="Message"
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  size="small"
                  rows={3}
                  placeholder="Type your reply..."
                />
                <div className="flex justify-end gap-2">
                  <Button
                    kind="tertiary"
                    size="small"
                    onClick={async () => {
                      if (!threadCandidate) return;
                      setGeneratingEmail(true);
                      try {
                        const result = await apiService.generateCandidateEmail(job.id, threadCandidate.linkedinId, {
                          isFollowup: true,
                          previousBody: threadMessages.find(m => m.direction === 'sent')?.body || '',
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
                    disabled={sendingReply || !replySubject.trim() || !replyBody.trim()}
                  >
                    {sendingReply ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </div>
            </div>
          </NextModalContent>
        </NextModalBasicLayout>
      </NextModal>
    </div>
  );
};

export default JobDetail;

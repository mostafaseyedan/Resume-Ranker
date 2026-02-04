import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Candidate, Job, apiService, WebVerificationResult } from '../services/apiService';
import CandidateList from './CandidateList';
import CandidateDetail from './CandidateDetail';
import ResumeTemplateSelector from './ResumeTemplateSelector';
import RadialProgress from './RadialProgress';
import { Button, ButtonGroup, Label, MenuItem, SplitButton, SplitButtonMenu } from '@vibe/core';
import { Check } from '@vibe/icons';

interface GroupedCandidate {
  name: string;
  candidates: Candidate[];
  bestScore: number;
  jobCount: number;
  jobTitles: string[];
  latestDate: string;
  verificationStatus: string | null;
  hasImproved: boolean;
}

interface CandidateDashboardViewProps {
  groupedCandidate: GroupedCandidate;
  jobs: Job[];
  onJobSelect: (job: Job) => void;
  onCandidateDeleted: (candidateId: string) => void;
}

const MONDAY_TO_VIBE_COLOR_MAP: Record<string, string> = {
  'green-shadow': 'done-green',
  'grass-green': 'grass_green',
  'lime-green': 'saladish',
  'orange': 'working_orange',
  'dark-orange': 'dark-orange',
  'yellow': 'egg_yolk',
  'mustered': 'tan',
  'red-shadow': 'stuck-red',
  'dark-red': 'dark-red',
  'dark-pink': 'sofia_pink',
  'light-pink': 'pink',
  'dark-purple': 'dark_purple',
  'dark_indigo': 'dark_indigo',
  'purple': 'purple',
  'bright-blue': 'bright-blue',
  'blue-links': 'river',
  'sky': 'sky',
  'navy': 'navy',
  'australia': 'aquamarine',
  'grey': 'american_gray',
  'trolley-grey': 'american_gray',
  'soft-black': 'blackish',
  'dark-grey': 'american_gray',
  'gray': 'american_gray',
  'wolf-gray': 'american_gray',
  'stone': 'american_gray',
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
  'onsite': 'orange',
  'remote': 'green-shadow',
  'hybrid': 'purple',
  'uk': 'blue-links',
  'europe': 'australia',
  'latin america': 'grass-green',
  'part-time': 'blue-links',
  'consultant': 'grey',
  'full-time': 'winter',
  'contract-to-hire': 'purple'
};

const getVibeLabelColor = (text: string, dynamicVarName?: string): string => {
  if (dynamicVarName) {
    const normalizedVar = dynamicVarName.toLowerCase().replace(/_/g, '-');
    if (COLOR_OVERRIDES[normalizedVar]) return COLOR_OVERRIDES[normalizedVar];
    if (MONDAY_TO_VIBE_COLOR_MAP[normalizedVar]) return MONDAY_TO_VIBE_COLOR_MAP[normalizedVar];
  }

  if (!text) return 'american_gray';
  const normalizedText = text.toLowerCase().trim();

  let varName = STATIC_VAR_NAME_MAP[normalizedText];
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

const CandidateDashboardView: React.FC<CandidateDashboardViewProps> = ({
  groupedCandidate,
  jobs,
  onJobSelect,
  onCandidateDeleted
}) => {
  const [activeTab, setActiveTab] = useState<'resumes' | 'jobs' | 'verification'>('resumes');
  const [selectedResume, setSelectedResume] = useState<Candidate | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationProvider, setVerificationProvider] = useState<'gemini' | 'openai'>('gemini');

  // Get the best candidate (highest score) for verification display
  const bestCandidate = useMemo(() => {
    return groupedCandidate.candidates.reduce((best, current) =>
      (current.overall_score || 0) > (best.overall_score || 0) ? current : best
    , groupedCandidate.candidates[0]);
  }, [groupedCandidate.candidates]);

  // Get verification result from best candidate or any candidate that has it
  const verificationResult = useMemo(() => {
    for (const c of groupedCandidate.candidates) {
      if (c.web_verification) {
        return c.web_verification;
      }
    }
    return null;
  }, [groupedCandidate.candidates]);

  // Get jobs for this candidate
  const candidateJobs = useMemo(() => {
    const jobIds = new Set(groupedCandidate.candidates.map(c => c.job_id));
    return jobs.filter(job => jobIds.has(job.id));
  }, [groupedCandidate.candidates, jobs]);

  // Get score for each job
  const jobScores = useMemo(() => {
    const scores: Record<string, { bestScore: number; resumeCount: number }> = {};
    groupedCandidate.candidates.forEach(c => {
      if (!scores[c.job_id]) {
        scores[c.job_id] = { bestScore: 0, resumeCount: 0 };
      }
      scores[c.job_id].resumeCount++;
      if ((c.overall_score || 0) > scores[c.job_id].bestScore) {
        scores[c.job_id].bestScore = c.overall_score || 0;
      }
    });
    return scores;
  }, [groupedCandidate.candidates]);

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    if (score >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  };

  const formatCreatedBy = (createdBy?: string) => {
    if (!createdBy) return 'Unknown';
    if (createdBy === 'monday_sync') return 'Monday Sync';
    const local = createdBy.split('@')[0] || createdBy;
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length === 0) return createdBy;
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  const getVerificationBadge = (): { label: string; style: string } => {
    const status = verificationResult?.overall_verification_status;
    if (!verificationResult) {
      return { label: 'Verification Pending', style: 'bg-gray-100 dark:bg-[#30324e] text-gray-600 dark:text-[#9699a6]' };
    }
    switch (status) {
      case 'verified':
        return { label: 'Verified', style: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' };
      case 'partially_verified':
        return { label: 'Partially Verified', style: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' };
      case 'contradicted':
        return { label: 'Verification Denied', style: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' };
      case 'limited_information':
        return { label: 'Limited Verification Info', style: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' };
      case 'no_information_found':
        return { label: 'No Verification Info', style: 'bg-gray-100 dark:bg-[#30324e] text-gray-600 dark:text-[#9699a6]' };
      default:
        return { label: 'Verification Pending', style: 'bg-gray-100 dark:bg-[#30324e] text-gray-600 dark:text-[#9699a6]' };
    }
  };

  const handleVerifyCandidate = async (provider: 'gemini' | 'openai' = verificationProvider) => {
    setVerifying(true);
    try {
      await apiService.verifyCandidate(bestCandidate.id, provider);
      setActiveTab('verification');
      toast.success('Candidate verification completed!');
      // Note: The verification result will be refreshed when the parent reloads candidates
    } catch (error: any) {
      console.error('Failed to verify candidate:', error);
      toast.error('Failed to verify candidate: ' + (error.response?.data?.error || error.message));
    } finally {
      setVerifying(false);
    }
  };

  const handleCandidateSelect = (candidate: Candidate) => {
    setSelectedResume(candidate);
  };

  const handleBackToResumes = () => {
    setSelectedResume(null);
  };

  const verificationBadge = getVerificationBadge();

  // If a resume is selected, show the CandidateDetail view
  if (selectedResume) {
    // Find the job for this resume
    const job = jobs.find(j => j.id === selectedResume.job_id);
    if (job) {
      return (
        <CandidateDetail
          candidate={selectedResume}
          job={job}
          onBack={handleBackToResumes}
        />
      );
    }
  }

  // Verification tab content helpers
  const normalizeVerificationStatus = (status?: string): string => {
    return (status || '').trim().toLowerCase().replace(/\s+/g, '_');
  };

  const getVerificationStatusLabel = (status: string): string => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified': return 'Verified';
      case 'partially_verified': return 'Partially Verified';
      case 'inconclusive': return 'Inconclusive';
      case 'limited_information': return 'Limited Information';
      case 'no_information_found': return 'No Information Found';
      case 'contradicted': return 'Contradicted';
      case 'unverified': return 'Unverified';
      default: return status;
    }
  };

  const getLabelColorForVerificationStatus = (status: string) => {
    const s = normalizeVerificationStatus(status);
    if (s === 'verified') return Label.colors.POSITIVE;
    if (s === 'partially_verified' || s === 'inconclusive') return Label.colors.WORKING_ORANGE;
    if (s === 'contradicted') return Label.colors.NEGATIVE;
    return Label.colors.AMERICAN_GRAY;
  };

  const getLabelColor = (type: string, value?: string) => {
    const maps: Record<string, Record<string, any>> = {
      confidence: { high: Label.colors.POSITIVE, medium: Label.colors.WORKING_ORANGE, low: Label.colors.NEGATIVE },
      presence: { strong: Label.colors.POSITIVE, moderate: Label.colors.WORKING_ORANGE },
      identity: { matched: Label.colors.POSITIVE, ambiguous: Label.colors.WORKING_ORANGE },
      severity: { critical: Label.colors.NEGATIVE, high: Label.colors.NEGATIVE, medium: Label.colors.WORKING_ORANGE },
    };
    const map = maps[type] || {};
    const key = (value || '').toLowerCase();
    return map[key] || Label.colors.AMERICAN_GRAY;
  };

  const getVerificationCardTint = (status: string): string => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified':
        return 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700';
      case 'partially_verified':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700';
      case 'contradicted':
        return 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-50 dark:bg-[#181b34] border border-gray-200 dark:border-[#4b4e69]';
    }
  };

  // Converted inline styles to Tailwind classes for dark mode support
  const cardStyle = "border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-white dark:bg-[#30324e] shadow-sm";
  const cardHeaderStyle = "flex justify-between items-start gap-3 mb-3";
  const cardTitleStyle = "m-0 font-semibold text-gray-900 dark:text-[#d5d8df] text-sm leading-snug";
  const blockStyle = "border border-gray-200 dark:border-[#4b4e69] p-3 bg-white dark:bg-[#30324e] shadow-sm";
  const sectionLabelStyle = "mb-1.5 text-xs font-semibold text-gray-600 dark:text-[#9699a6]";
  const bodyTextStyle = "m-0 text-sm leading-normal text-gray-700 dark:text-[#d5d8df] whitespace-pre-wrap";

  const structuredClaims = verificationResult?.claim_verifications || [];

  return (
    <div className="bg-white shadow">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-[#d5d8df]">
                {groupedCandidate.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#9699a6]">
                {groupedCandidate.candidates.length} resume{groupedCandidate.candidates.length !== 1 ? 's' : ''} across {groupedCandidate.jobCount} job{groupedCandidate.jobCount !== 1 ? 's' : ''}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {groupedCandidate.hasImproved && (
                  <Label
                    id="header-improved-badge"
                    text="Improved"
                    size="small"
                    color="positive"
                  />
                )}
                <Label
                  id="header-verification-badge"
                  text={verificationBadge.label}
                  size="small"
                  color={getLabelColorForVerificationStatus(verificationResult?.overall_verification_status || '') as any}
                />
              </div>
            </div>
          </div>
          <div className="text-center flex-1 flex flex-col items-center">
            <RadialProgress score={groupedCandidate.bestScore} size={96} strokeWidth={10} />
            <div className="text-xs text-gray-500 dark:text-[#9699a6] mt-2">Best Score</div>
          </div>
          <div className="flex justify-end flex-1 items-center gap-2">
            <Button
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              size="small"
            >
              {showTemplateSelector ? 'Hide Templates' : 'Improve'}
            </Button>
          </div>
        </div>
      </div>

      {/* Template Selector */}
      {showTemplateSelector && (
        <div className="px-6">
          <ResumeTemplateSelector
            candidateId={bestCandidate.id}
            candidateName={groupedCandidate.name}
            onGenerate={(sharepointUrl) => {
              if (sharepointUrl) {
                toast.success('Resume generated and saved to SharePoint!');
              } else {
                toast.success('Resume generated successfully!');
              }
              setShowTemplateSelector(false);
            }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69]">
        <nav className="-mb-px flex items-center gap-2">
          <button
            onClick={() => setActiveTab('resumes')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'resumes'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
              }`}
          >
            {`Resumes (${groupedCandidate.candidates.length})`}
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'jobs'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
              }`}
          >
            {`Jobs (${candidateJobs.length})`}
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'verification'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
              }`}
          >
            Verification
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'resumes' && (
          <CandidateList
            candidates={groupedCandidate.candidates}
            onCandidateSelect={handleCandidateSelect}
            onCandidateDeleted={onCandidateDeleted}
          />
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {candidateJobs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-[#9699a6]">No jobs found for this candidate.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {candidateJobs.map((job) => {
                  const scoreInfo = jobScores[job.id] || { bestScore: 0, resumeCount: 0 };
                  const status = job.monday_metadata?.status || job.status;
                  const createdByLabel = formatCreatedBy(job.created_by);
                  const createdByTitle = job.created_by || 'Unknown';
                  const client = job.monday_metadata?.client;

                  return (
                    <div
                      key={job.id}
                      onClick={() => onJobSelect(job)}
                      className="bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#4b4e69] p-4 hover:bg-gray-50 dark:hover:bg-[#3a3d5c] hover:border-blue-400 cursor-pointer transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="font-semibold text-gray-900 dark:text-[#d5d8df] text-base truncate" title={job.title}>
                            {job.title}
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {job.monday_metadata?.employment_type && (
                              <Label
                                id={`job-employment-${job.id}`}
                                text={job.monday_metadata.employment_type}
                                size="small"
                                color={getVibeLabelColor(job.monday_metadata.employment_type, job.monday_metadata.employment_type_color) as any}
                              />
                            )}
                            {status && (
                              <Label
                                id={`job-status-${job.id}`}
                                text={status}
                                size="small"
                                color={getVibeLabelColor(status, job.monday_metadata?.status_color) as any}
                              />
                            )}
                            {job.monday_metadata?.work_mode && (
                              <Label
                                id={`job-workmode-${job.id}`}
                                text={job.monday_metadata.work_mode}
                                size="small"
                                color={getVibeLabelColor(job.monday_metadata.work_mode, job.monday_metadata.work_mode_color) as any}
                              />
                            )}
                            {client && (
                              <Label
                                id={`job-client-${job.id}`}
                                text={client}
                                size="small"
                                color={Label.colors.AMERICAN_GRAY as any}
                              />
                            )}
                          </div>
                        </div>
                        <div className={`px-2 py-1 text-sm font-bold ${getScoreColor(scoreInfo.bestScore)}`}>
                          {scoreInfo.bestScore}%
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-gray-500 dark:text-[#9699a6]">
                        <div className="flex justify-between">
                          <span>Resumes submitted:</span>
                          <span className="font-medium text-gray-700 dark:text-[#d5d8df]">{scoreInfo.resumeCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Created:</span>
                          <span className="font-medium text-gray-700 dark:text-[#d5d8df]">{new Date(job.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Created by:</span>
                          <span className="font-medium text-gray-700 dark:text-[#d5d8df]" title={createdByTitle}>
                            {createdByLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'verification' && (
          <div>
            {verificationResult ? (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <SplitButton
                    id="verify-split-button"
                    ariaLabel="Verify split button"
                    onClick={() => handleVerifyCandidate(verificationProvider)}
                    disabled={verifying}
                    size="small"
                    kind="primary"
                    secondaryDialogPosition="bottom-start"
                    secondaryDialogContent={
                      <SplitButtonMenu id="verify-menu">
                        <MenuItem
                          id="verify-gemini"
                          title="Gemini"
                          onClick={() => setVerificationProvider('gemini')}
                          rightIcon={verificationProvider === 'gemini' ? Check : undefined}
                        />
                        <MenuItem
                          id="verify-openai"
                          title="OpenAI"
                          onClick={() => setVerificationProvider('openai')}
                          rightIcon={verificationProvider === 'openai' ? Check : undefined}
                        />
                      </SplitButtonMenu>
                    }
                  >
                    {verifying ? 'Verifying...' : 'Re-verify'}
                  </SplitButton>
                </div>

                {/* Summary */}
                <div className={`requirement-card ${cardStyle} ${getVerificationCardTint(verificationResult.overall_verification_status)}`}>
                  <div className={cardHeaderStyle}>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className={cardTitleStyle}>Web Verification</h5>
                        <Label
                          id="verification-overall-status"
                          text={getVerificationStatusLabel(verificationResult.overall_verification_status)}
                          size="small"
                          color={getLabelColorForVerificationStatus(verificationResult.overall_verification_status) as any}
                          className="!rounded-none"
                        />
                        <Label
                          id="verification-overall-confidence"
                          text={`${verificationResult.overall_confidence} confidence`}
                          size="small"
                          color={getLabelColor('confidence', verificationResult.overall_confidence) as any}
                          className="!rounded-none"
                        />
                      </div>
                      <div className="text-sm text-gray-600 dark:text-[#9699a6]">{verificationResult.candidate_name || groupedCandidate.name}</div>
                    </div>
                  </div>

                  {verificationResult.verification_summary && (
                    <div className={`${blockStyle} bg-gray-50 dark:bg-[#181b34]`}>
                      <p className={bodyTextStyle}>{verificationResult.verification_summary}</p>
                    </div>
                  )}

                  <div className={`mt-4 ${blockStyle}`}>
                    <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 text-sm text-gray-600 dark:text-[#9699a6]">
                      <div className="flex items-center gap-2">
                        <span>Claims</span>
                        <Label
                          id="verification-claims-count"
                          text={String(verificationResult.metrics?.claims_total ?? structuredClaims.length)}
                          size="small"
                          color={Label.colors.AMERICAN_GRAY as any}
                          className="!rounded-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Verified</span>
                        <Label
                          id="verification-verified-count"
                          text={String(verificationResult.metrics?.claims_verified ?? 0)}
                          size="small"
                          color={Label.colors.POSITIVE as any}
                          className="!rounded-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Online Presence</span>
                        <Label
                          id="verification-presence-level"
                          text={verificationResult.online_presence?.presence_level || '-'}
                          size="small"
                          color={getLabelColor('presence', verificationResult.online_presence?.presence_level) as any}
                          className="!rounded-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Identity</span>
                        <Label
                          id="verification-identity-status"
                          text={verificationResult.identity_resolution?.status || '-'}
                          size="small"
                          color={getLabelColor('identity', verificationResult.identity_resolution?.status) as any}
                          className="!rounded-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Online Presence */}
                <div className="requirement-card" style={cardStyle}>
                  <div className={cardHeaderStyle}>
                    <h5 className={cardTitleStyle}>Online Presence</h5>
                    <Label
                      id="presence-level"
                      text={verificationResult.online_presence?.presence_level || '-'}
                      size="small"
                      color={getLabelColor('presence', verificationResult.online_presence?.presence_level) as any}
                      className="!rounded-none"
                    />
                  </div>

                  {verificationResult.online_presence?.summary && (
                    <div className={blockStyle}>
                      <p className={bodyTextStyle}>{verificationResult.online_presence.summary}</p>
                    </div>
                  )}

                  {verificationResult.online_presence?.profiles && verificationResult.online_presence.profiles.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2.5">
                      {verificationResult.online_presence.profiles.map((profile, idx) => (
                        <div key={idx} className={blockStyle}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label
                              id={`profile-type-${idx}`}
                              text={profile.type}
                              size="small"
                              color={Label.colors.AMERICAN_GRAY as any}
                              className="!rounded-none"
                            />
                            <Label
                              id={`profile-match-${idx}`}
                              text={`match: ${profile.match_strength}`}
                              size="small"
                              color={getLabelColor('confidence', profile.match_strength) as any}
                              className="!rounded-none"
                            />
                          </div>
                          <div className="mt-2">
                            <a
                              href={profile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all text-sm"
                            >
                              {profile.title || profile.url}
                            </a>
                          </div>
                          {profile.notes && <div className="text-sm text-gray-700 dark:text-[#d5d8df] mt-2 whitespace-pre-wrap">{profile.notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Identity Resolution */}
                <div className="requirement-card" style={cardStyle}>
                  <div className={cardHeaderStyle}>
                    <h5 className={cardTitleStyle}>Identity Resolution</h5>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label
                        id="identity-status"
                        text={verificationResult.identity_resolution?.status || '-'}
                        size="small"
                        color={getLabelColor('identity', verificationResult.identity_resolution?.status) as any}
                        className="!rounded-none"
                      />
                      <Label
                        id="identity-confidence"
                        text={`${verificationResult.identity_resolution?.confidence || '-'} confidence`}
                        size="small"
                        color={getLabelColor('confidence', verificationResult.identity_resolution?.confidence) as any}
                        className="!rounded-none"
                      />
                    </div>
                  </div>

                  <div className={blockStyle}>
                    <p className={bodyTextStyle}>{verificationResult.identity_resolution?.reason || 'No details available'}</p>
                    {verificationResult.identity_resolution?.signals && verificationResult.identity_resolution.signals.length > 0 && (
                      <div className="text-xs text-gray-600 dark:text-[#9699a6] mt-2">
                        Signals: {verificationResult.identity_resolution.signals.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Claims */}
                {structuredClaims.length > 0 && (
                  <div className="requirement-card" style={cardStyle}>
                    <div className={cardHeaderStyle}>
                      <h5 className={cardTitleStyle}>Claims</h5>
                      <Label
                        id="claims-count"
                        text={`${structuredClaims.length} items`}
                        size="small"
                        color={Label.colors.AMERICAN_GRAY as any}
                        className="!rounded-none"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      {structuredClaims.slice(0, 5).map((claim) => (
                        <div key={claim.id} className={blockStyle}>
                          <div className="flex justify-between items-start gap-3 flex-wrap">
                            <div className="flex-1 min-w-[220px]">
                              <div className="text-sm font-semibold text-gray-800 dark:text-[#d5d8df]">{claim.claim}</div>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                              <Label
                                id={`claim-status-${claim.id}`}
                                text={getVerificationStatusLabel(claim.verification_status)}
                                size="small"
                                color={getLabelColorForVerificationStatus(claim.verification_status) as any}
                                className="!rounded-none"
                              />
                              <Label
                                id={`claim-category-${claim.id}`}
                                text={claim.category}
                                size="small"
                                color={Label.colors.AMERICAN_GRAY as any}
                                className="!rounded-none"
                              />
                            </div>
                          </div>
                          {claim.reason && <div className="text-sm text-gray-700 dark:text-[#d5d8df] mt-3 whitespace-pre-wrap">{claim.reason}</div>}
                        </div>
                      ))}
                      {structuredClaims.length > 5 && (
                        <div className="text-sm text-gray-500 dark:text-[#9699a6] text-center">
                          + {structuredClaims.length - 5} more claims. View full details in resume analysis.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sources */}
                {verificationResult.sources && verificationResult.sources.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-[#4b4e69]">
                    <div className="text-sm font-semibold text-gray-600 dark:text-[#9699a6]">Sources Consulted</div>
                    <div className="mt-1 space-y-1 text-sm">
                      {verificationResult.sources.slice(0, 5).map((source, idx) => (
                        <a
                          key={idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all"
                        >
                          {source.title || source.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-[#9699a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">No Verification Data</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">Run web verification to validate key claims.</p>
                <div className="mt-4">
                  <SplitButton
                    id="verify-empty-split-button"
                    ariaLabel="Verify split button"
                    onClick={() => handleVerifyCandidate(verificationProvider)}
                    disabled={verifying}
                    size="small"
                    kind="primary"
                    secondaryDialogPosition="bottom-start"
                    secondaryDialogContent={
                      <SplitButtonMenu id="verify-empty-menu">
                        <MenuItem
                          id="verify-empty-gemini"
                          title="Gemini"
                          onClick={() => setVerificationProvider('gemini')}
                          rightIcon={verificationProvider === 'gemini' ? Check : undefined}
                        />
                        <MenuItem
                          id="verify-empty-openai"
                          title="OpenAI"
                          onClick={() => setVerificationProvider('openai')}
                          rightIcon={verificationProvider === 'openai' ? Check : undefined}
                        />
                      </SplitButtonMenu>
                    }
                  >
                    {verifying ? 'Verifying...' : 'Start Verification'}
                  </SplitButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateDashboardView;

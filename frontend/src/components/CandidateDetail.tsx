import React, { useState } from 'react';
import { toast } from 'sonner';
import { Candidate, Job, apiService, WebVerificationResult } from '../services/apiService';
import ResumeTemplateSelector from './ResumeTemplateSelector';
import RadialProgress from './RadialProgress';
import { Button, Label, MenuItem, SplitButton, SplitButtonMenu } from '@vibe/core';
import { Check } from '@vibe/icons';
import '@vibe/core/tokens';

interface CandidateDetailProps {
  candidate: Candidate;
  job: Job;
  onBack: () => void;
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ candidate, job, onBack }) => {
  const [activeTab, setActiveTab] = useState<'strengths' | 'weaknesses' | 'skills' | 'experience' | 'verification'>('strengths');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationProvider, setVerificationProvider] = useState<'gemini' | 'openai'>(
    candidate.web_verification_provider === 'openai' ? 'openai' : 'gemini'
  );
  const [verificationResult, setVerificationResult] = useState<WebVerificationResult | null>(
    candidate.web_verification || null
  );

  const parseMonthDayYearToTimestamp = (value?: string): number => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const trimmed = value.trim();
    if (!trimmed) return Number.NEGATIVE_INFINITY;

    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (!match) return Number.NEGATIVE_INFINITY;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return Number.NEGATIVE_INFINITY;

    const date = new Date(Date.UTC(year, month - 1, day));
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
  };

  const sortByStartDateDescending = <T extends { start_date?: string } | string>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const aTimestamp = typeof a === 'string' ? Number.NEGATIVE_INFINITY : parseMonthDayYearToTimestamp(a.start_date);
      const bTimestamp = typeof b === 'string' ? Number.NEGATIVE_INFINITY : parseMonthDayYearToTimestamp(b.start_date);
      return bTimestamp - aTimestamp;
    });
  };

  const extractLevelPrefix = (text?: string): { level?: 'critical' | 'high' | 'medium' | 'low'; label?: string } => {
    if (!text) return {};
    const firstToken = text.trim().split(/\s+/)[0] || '';
    const cleaned = firstToken.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (cleaned === 'critical' || cleaned === 'high' || cleaned === 'medium' || cleaned === 'low') {
      return { level: cleaned as 'critical' | 'high' | 'medium' | 'low', label: cleaned.charAt(0).toUpperCase() + cleaned.slice(1) };
    }
    return {};
  };

  const stripLevelPrefix = (text?: string): string => {
    if (!text) return '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    const { level } = extractLevelPrefix(trimmed);
    if (!level) return trimmed;
    const remainder = trimmed
      .split(/\s+/)
      .slice(1)
      .join(' ')
      .replace(/^[:.\-–—]\s*/, '')
      .trim();
    return remainder;
  };

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

  const handleVerifyCandidate = async (provider: 'gemini' | 'openai' = verificationProvider) => {
    setVerifying(true);
    try {
      const response = await apiService.verifyCandidate(candidate.id, provider);
      setVerificationResult(response.verification);
      setActiveTab('verification');
      toast.success('Candidate verification completed!');
    } catch (error: any) {
      console.error('Failed to verify candidate:', error);
      toast.error('Failed to verify candidate: ' + (error.response?.data?.error || error.message));
    } finally {
      setVerifying(false);
    }
  };

  // Converted inline styles to Tailwind classes for dark mode support
  const cardStyle = "border border-gray-300 dark:border-[#4b4e69] p-4 mb-3 bg-white dark:bg-[#30324e] shadow-sm";
  const cardHeaderStyle = "flex justify-between items-start gap-3 mb-3";
  const cardTitleStyle = "m-0 font-semibold text-gray-900 dark:text-[#d5d8df] text-sm leading-snug";
  const blockStyle = "border border-gray-200 dark:border-[#4b4e69] p-3 bg-white dark:bg-[#30324e] shadow-sm";
  const sectionLabelStyle = "mb-1.5 text-xs font-semibold text-gray-600 dark:text-[#9699a6]";
  const bodyTextStyle = "m-0 text-sm leading-normal text-gray-700 dark:text-[#d5d8df] whitespace-pre-wrap";

  // Unified label color mappings
  const labelColorMaps = {
    strength: { critical: 'POSITIVE', high: 'POSITIVE', medium: 'WORKING_ORANGE' },
    weakness: { critical: 'NEGATIVE', high: 'NEGATIVE', medium: 'WORKING_ORANGE' },
    confidence: { high: 'POSITIVE', medium: 'WORKING_ORANGE', low: 'NEGATIVE' },
    presence: { strong: 'POSITIVE', moderate: 'WORKING_ORANGE' },
    identity: { matched: 'POSITIVE', ambiguous: 'WORKING_ORANGE' },
    severity: { critical: 'NEGATIVE', high: 'NEGATIVE', medium: 'WORKING_ORANGE' },
  } as const;

  const getLabelColor = (type: keyof typeof labelColorMaps, value?: string) => {
    const map = labelColorMaps[type];
    const key = (value || '').toLowerCase() as keyof typeof map;
    const color = map[key];
    return color ? Label.colors[color as keyof typeof Label.colors] : Label.colors.AMERICAN_GRAY;
  };

  const getLabelColorForVerificationStatus = (status: string) => {
    const s = normalizeVerificationStatus(status);
    if (s === 'verified') return Label.colors.POSITIVE;
    if (s === 'partially_verified' || s === 'inconclusive') return Label.colors.WORKING_ORANGE;
    if (s === 'contradicted') return Label.colors.NEGATIVE;
    return Label.colors.AMERICAN_GRAY;
  };

  const getLabelColorForClaimStatus = getLabelColorForVerificationStatus;

  const getVerificationCardTint = (status: string): string => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified':
        return 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700';
      case 'partially_verified':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700';
      case 'contradicted':
        return 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700';
      case 'limited_information':
      case 'no_information_found':
      default:
        return 'bg-gray-50 dark:bg-[#181b34] border border-gray-200 dark:border-[#4b4e69]';
    }
  };

  const getLabelColorForVerifiableRatio = (ratio?: number) => {
    if (typeof ratio !== 'number') return Label.colors.AMERICAN_GRAY;
    if (ratio >= 0.7) return Label.colors.POSITIVE;
    if (ratio >= 0.4) return Label.colors.WORKING_ORANGE;
    return Label.colors.NEGATIVE;
  };

  const getStrengthCardTint = (level?: 'critical' | 'high' | 'medium' | 'low'): string => {
    const p = (level || '').toLowerCase();
    if (p === 'critical' || p === 'high') return 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700';
    if (p === 'medium') return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700';
    if (p === 'low') return 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700';
    return 'bg-white dark:bg-[#30324e] border border-gray-300 dark:border-[#4b4e69]';
  };

  const getWeaknessCardTint = (level?: 'critical' | 'high' | 'medium' | 'low'): string => {
    const p = (level || '').toLowerCase();
    if (p === 'critical') return 'bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-700';
    if (p === 'high') return 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700';
    if (p === 'medium') return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700';
    if (p === 'low') return 'bg-gray-50 dark:bg-[#181b34] border border-gray-200 dark:border-[#4b4e69]';
    return 'bg-white dark:bg-[#30324e] border border-gray-300 dark:border-[#4b4e69]';
  };

  const analysis = candidate;
  const isImprovedResume = (candidate.resume_filename || '').toLowerCase().includes('improved');

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
  const verificationBadge = getVerificationBadge();
  const structuredClaims = verificationResult?.claim_verifications || [];
  const claimStatusCounts = structuredClaims.reduce((acc, claim) => {
    const key = normalizeVerificationStatus(claim.verification_status || 'unverified');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const orderedClaimStatusEntries = (() => {
    const preferredOrder = [
      'verified',
      'partially_verified',
      'unverified',
      'inconclusive',
      'contradicted',
      'limited_information',
      'no_information_found',
    ];
    const preferred = preferredOrder
      .map((status) => [status, claimStatusCounts[status]] as const)
      .filter(([, count]) => typeof count === 'number' && count > 0) as Array<[string, number]>;
    const remaining = Object.entries(claimStatusCounts).filter(([status]) => !preferredOrder.includes(status));
    return [...preferred, ...remaining];
  })();

  return (
    <div className="bg-white dark:bg-[#30324e] shadow max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <button
              onClick={onBack}
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-[#9699a6] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#3a3d5c]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-[#d5d8df]">
                {candidate.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#9699a6]">Candidate Analysis for {job.title}</p>
              <div className="mt-2 flex items-center gap-2">
                {isImprovedResume && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                    Improved
                  </span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap ${verificationBadge.style}`}>
                  {verificationBadge.label}
                </span>
              </div>
            </div>
          </div>
          <div className="text-center flex-1 flex flex-col items-center">
            <RadialProgress score={analysis?.overall_score || 0} size={96} strokeWidth={10} />
            <div className="text-xs text-gray-500 dark:text-[#9699a6] mt-2">Overall Score</div>
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
            candidateId={candidate.id}
            candidateName={candidate.name}
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

      <div className="p-6">
        {/* Contact Information */}
        <div className="mb-6">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-[#9699a6]">Email:</span>
              <span className="text-gray-900 dark:text-[#d5d8df]">{candidate.email || 'Not provided'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-[#9699a6]">Phone:</span>
              <span className="text-gray-900 dark:text-[#d5d8df]">{candidate.phone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {analysis?.summary && (
          <div className="mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700 p-4">
              <h3 className="text-base font-medium text-gray-900 dark:text-[#d5d8df] mb-2">Summary</h3>
              <p className="text-gray-700 dark:text-[#d5d8df]">{analysis.summary}</p>
            </div>
          </div>
        )}

        {/* Tabs for detailed sections */}
        <div className="border-b border-gray-200 dark:border-[#4b4e69] mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('strengths')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'strengths'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] border-transparent hover:border-gray-300 dark:hover:border-[#4b4e69]'
                }`}
            >
              Strengths ({analysis?.strengths?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('weaknesses')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'weaknesses'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] border-transparent hover:border-gray-300 dark:hover:border-[#4b4e69]'
                }`}
            >
              Weaknesses ({analysis?.weaknesses?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'skills'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] border-transparent hover:border-gray-300 dark:hover:border-[#4b4e69]'
                }`}
            >
              Skills ({analysis?.skill_analysis?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('experience')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'experience'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] border-transparent hover:border-gray-300 dark:hover:border-[#4b4e69]'
                }`}
            >
              Experience
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'verification'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] border-transparent hover:border-gray-300 dark:hover:border-[#4b4e69]'
                }`}
            >
              Verification
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'strengths' && (
            <div>
	              {analysis?.strengths && analysis.strengths.length > 0 ? (
	                <div className="space-y-4">
	                  {analysis.strengths.map((strength, index) => {
	                    const { level, label } = extractLevelPrefix(strength.relevance);
	                    const relevanceDetails = stripLevelPrefix(strength.relevance);
	                    return (
	                      <div key={index} className={`requirement-card ${cardStyle} ${getStrengthCardTint(level)}`}>
	                        <div className={`card-header ${cardHeaderStyle}`}>
	                          <h5 className={cardTitleStyle}>{strength.strength}</h5>
	                          {level && label && (
	                            <Label
	                              id={`strength-level-${index}`}
	                              text={label}
	                              size="small"
	                              color={getLabelColor('strength', level) as any}
	                              className="!rounded-none"
	                            />
	                          )}
	                        </div>

	                        <div className="flex flex-col gap-3">
	                          {strength.evidence && (
	                            <div className={blockStyle}>
	                              <div className={sectionLabelStyle}>Evidence</div>
	                              <p className={bodyTextStyle}>{strength.evidence}</p>
	                            </div>
	                          )}

	                          {relevanceDetails && (
	                            <div className={blockStyle}>
	                              <div className={sectionLabelStyle}>Relevance</div>
	                              <p className={bodyTextStyle}>{relevanceDetails}</p>
	                            </div>
	                          )}
	                        </div>
	                      </div>
	                    );
	                  })}
	                </div>
	              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">No Strengths</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">No strengths were identified for this candidate.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'weaknesses' && (
            <div>
	              {analysis?.weaknesses && analysis.weaknesses.length > 0 ? (
	                <div className="space-y-4">
	                  {analysis.weaknesses.map((weakness, index) => {
	                    const { level, label } = extractLevelPrefix(weakness.importance);
	                    const importanceDetails = stripLevelPrefix(weakness.importance);
	                    return (
	                      <div key={index} className={`requirement-card ${cardStyle} ${getWeaknessCardTint(level)}`}>
	                        <div className={`card-header ${cardHeaderStyle}`}>
	                          <h5 className={cardTitleStyle}>{weakness.weakness}</h5>
	                          {level && label && (
	                            <Label
	                              id={`weakness-level-${index}`}
	                              text={label}
	                              size="small"
	                              color={getLabelColor('weakness', level) as any}
	                              className="!rounded-none"
	                            />
	                          )}
	                        </div>

	                        <div className="flex flex-col gap-3">
	                          {importanceDetails && (
	                            <div className={blockStyle}>
	                              <div className={sectionLabelStyle}>Notes</div>
	                              <p className={bodyTextStyle}>{importanceDetails}</p>
	                            </div>
	                          )}

	                          {weakness.impact && (
	                            <div className={blockStyle}>
	                              <div className={sectionLabelStyle}>Impact</div>
	                              <p className={bodyTextStyle}>{weakness.impact}</p>
	                            </div>
	                          )}

	                          {weakness.recommendation && (
	                            <div className={blockStyle}>
	                              <div className={sectionLabelStyle}>Recommendation</div>
	                              <p className={bodyTextStyle}>{weakness.recommendation}</p>
	                            </div>
	                          )}
	                        </div>
	                      </div>
	                    );
	                  })}
	                </div>
	              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">No Weaknesses</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">No weaknesses were identified for this candidate.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && (
            <div>
              {analysis?.skill_analysis && analysis.skill_analysis.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.skill_analysis.map((skill, index) => (
                    <div key={index} className="border border-gray-200 dark:border-[#4b4e69] p-4 bg-white dark:bg-[#30324e] hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900 dark:text-[#d5d8df] text-sm">{skill.skill}</h4>
                        <RadialProgress score={skill.score * 10} size={48} strokeWidth={5} />
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-[#9699a6]">Required:</span>
                          <span className="font-medium text-gray-700 dark:text-[#d5d8df] capitalize">{skill.required_level}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-[#9699a6]">Candidate:</span>
                          <span className="font-medium text-gray-700 dark:text-[#d5d8df] capitalize">{skill.candidate_level}</span>
                        </div>
                      </div>
                      {skill.evidence && (
                        <div className="bg-gray-50 dark:bg-[#181b34] p-2">
                          <p className="text-xs text-gray-600 dark:text-[#9699a6] leading-relaxed">{skill.evidence}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-[#9699a6]">No skill analysis available</p>
              )}
            </div>
          )}

          {activeTab === 'experience' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Experience */}
	              <div className="border border-gray-200 dark:border-[#4b4e69] bg-white dark:bg-[#30324e] p-5">
	                <div className="flex items-start justify-between gap-4 mb-4">
	                  <div>
	                    <h3 className="text-sm font-semibold text-gray-900 dark:text-[#d5d8df]">Experience</h3>
	                  </div>
	
	                  {analysis?.experience_match && (
	                    <div className="flex items-center gap-2">
	                      <Label
	                        id="experience-total-years"
	                        text={`${analysis.experience_match.total_years}y total`}
	                        size="small"
	                        color={Label.colors.AMERICAN_GRAY as any}
	                        className="!rounded-none"
	                      />
	                      <Label
	                        id="experience-relevant-years"
	                        text={`${analysis.experience_match.relevant_years}y relevant`}
	                        size="small"
	                        color={Label.colors.WORKING_ORANGE as any}
	                        className="!rounded-none"
	                      />
	                    </div>
	                  )}
	                </div>
	
	                {analysis?.experience_match?.role_progression && (
	                  <div className="mb-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3">
	                    <div className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Role Progression</div>
	                    <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">
	                      {analysis.experience_match.role_progression}
	                    </p>
	                  </div>
	                )}

	                {analysis?.experience_match?.industry_match && (
	                  <div className="mb-4 border border-gray-200 dark:border-[#4b4e69] bg-gray-50 dark:bg-[#181b34] p-3">
	                    <div className="text-sm font-semibold text-gray-700 dark:text-[#d5d8df] mb-1">Industry Match</div>
	                    <p className="text-sm text-gray-700 dark:text-[#d5d8df] leading-relaxed whitespace-pre-wrap">
	                      {analysis.experience_match.industry_match}
	                    </p>
	                  </div>
	                )}
	
	                <div className="text-sm font-semibold text-gray-600 dark:text-[#9699a6] mb-3">Companies</div>
	                {analysis?.experience_match?.companies && analysis.experience_match.companies.length > 0 ? (
	                  <div className="relative ml-2 border-l-2 border-gray-200 dark:border-[#4b4e69]">
	                    {sortByStartDateDescending(analysis.experience_match.companies).map((company, idx, allCompanies) => {
	                      const isLast = idx === allCompanies.length - 1;
                      if (typeof company === 'string') {
                        return (
                          <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white dark:bg-[#30324e] border-2 border-blue-500" />
                            <div className="text-sm font-medium text-gray-900 dark:text-[#d5d8df]">{company}</div>
                          </div>
                        );
                      }

                      const dateRange =
                        company.start_date || company.end_date
                          ? `${company.start_date || ''}${company.start_date || company.end_date ? ' - ' : ''}${company.end_date || ''}`.trim()
                          : '';

                      return (
                        <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white dark:bg-[#30324e] border-2 border-blue-500" />
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-[#d5d8df]">{company.name}</div>
                            {dateRange && <div className="text-xs text-gray-500 dark:text-[#9699a6] whitespace-nowrap">{dateRange}</div>}
                          </div>
                          {company.location && <div className="text-xs text-gray-500 dark:text-[#9699a6] mt-0.5">{company.location}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-[#9699a6]">No company history available</p>
                )}
              </div>

              {/* Education */}
	              <div className="border border-gray-200 dark:border-[#4b4e69] bg-white dark:bg-[#30324e] p-5">
	                <div className="mb-4">
	                  <h3 className="text-sm font-semibold text-gray-900 dark:text-[#d5d8df]">Education</h3>
	                </div>
	
	                {analysis?.education_match?.degree_relevance && (
	                  <div className="mb-4 border border-gray-200 dark:border-[#4b4e69] bg-gray-50 dark:bg-[#181b34] p-3">
	                    <div className="text-sm font-semibold text-gray-700 dark:text-[#d5d8df] mb-1">Degree Relevance</div>
	                    <p className="text-sm text-gray-700 dark:text-[#d5d8df] leading-relaxed whitespace-pre-wrap">
	                      {analysis.education_match.degree_relevance}
	                    </p>
	                  </div>
	                )}

	                {analysis?.education_match?.continuous_learning && (
	                  <div className="mb-4 border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-3">
	                    <div className="text-sm font-semibold text-green-900 dark:text-green-300 mb-1">Continuous Learning</div>
	                    <p className="text-sm text-green-900 dark:text-green-200 leading-relaxed whitespace-pre-wrap">
	                      {analysis.education_match.continuous_learning}
	                    </p>
	                  </div>
	                )}
	
	                <div className="text-sm font-semibold text-gray-600 dark:text-[#9699a6] mb-3">Institutions</div>
	                {analysis?.education_match?.institutions && analysis.education_match.institutions.length > 0 ? (
	                  <div className="relative ml-2 border-l-2 border-gray-200 dark:border-[#4b4e69]">
	                    {sortByStartDateDescending(analysis.education_match.institutions).map((inst, idx, allInstitutions) => {
	                      const isLast = idx === allInstitutions.length - 1;
                      if (typeof inst === 'string') {
                        return (
                          <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white dark:bg-[#30324e] border-2 border-green-600" />
                            <div className="text-sm font-medium text-gray-900 dark:text-[#d5d8df]">{inst}</div>
                          </div>
                        );
                      }

                      const dateRange =
                        inst.start_date || inst.end_date
                          ? `${inst.start_date || ''}${inst.start_date || inst.end_date ? ' - ' : ''}${inst.end_date || ''}`.trim()
                          : '';

                      return (
                        <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white dark:bg-[#30324e] border-2 border-green-600" />
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-[#d5d8df]">{inst.name}</div>
                            {dateRange && <div className="text-xs text-gray-500 dark:text-[#9699a6] whitespace-nowrap">{dateRange}</div>}
                          </div>
                          {inst.location && <div className="text-xs text-gray-500 dark:text-[#9699a6] mt-0.5">{inst.location}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-[#9699a6]">No education history available</p>
	                )}
	
	                {analysis?.education_match?.certifications && analysis.education_match.certifications.length > 0 && (
	                  <div className="mt-5">
	                    <div className="text-sm font-semibold text-gray-600 dark:text-[#9699a6] mb-2">Certifications</div>
	                    <div className="flex flex-wrap gap-2">
	                      {analysis.education_match.certifications.map((cert, idx) => (
	                        <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700">
	                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                      {verifying ? 'Verifying...' : 'Verify'}
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
                            color={getLabelColor('confidence',verificationResult.overall_confidence) as any}
                            className="!rounded-none"
                          />
                        </div>
                        <div className="text-sm text-gray-600 dark:text-[#9699a6]">{verificationResult.candidate_name || candidate.name}</div>
                      </div>

                      <div />
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

                        {orderedClaimStatusEntries.length > 0 &&
                          orderedClaimStatusEntries.map(([status, count]) => (
                            <div key={status} className="flex items-center gap-2">
                              <span>{getVerificationStatusLabel(status)}</span>
                              <Label
                                id={`claim-status-${status}`}
                                text={String(count)}
                                size="small"
                                color={getLabelColorForClaimStatus(status) as any}
                                className="!rounded-none"
                              />
                            </div>
                          ))}

                        <div className="flex items-center gap-2">
                          <span>Verifiable</span>
                          <Label
                            id="verification-verifiable-ratio"
                            text={
                              typeof verificationResult.metrics?.verifiable_ratio === 'number'
                                ? `${Math.round(verificationResult.metrics.verifiable_ratio * 100)}%`
                                : '—'
                            }
                            size="small"
                            color={getLabelColorForVerifiableRatio(verificationResult.metrics?.verifiable_ratio) as any}
                            className="!rounded-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span>Online Presence</span>
                          <Label
                            id="verification-presence-level"
                            text={verificationResult.online_presence?.presence_level || '—'}
                            size="small"
                            color={getLabelColor('presence',verificationResult.online_presence?.presence_level) as any}
                            className="!rounded-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span>Identity</span>
                          <Label
                            id="verification-identity-status"
                            text={verificationResult.identity_resolution?.status || '—'}
                            size="small"
                            color={getLabelColor('identity',verificationResult.identity_resolution?.status) as any}
                            className="!rounded-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Online presence */}
                  <div className={`requirement-card ${cardStyle}`}>
                    <div className={cardHeaderStyle}>
                      <h5 className={cardTitleStyle}>Online Presence</h5>
                      <Label
                        id="presence-level"
                        text={verificationResult.online_presence?.presence_level || '—'}
                        size="small"
                        color={getLabelColor('presence',verificationResult.online_presence?.presence_level) as any}
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
                                color={getLabelColor('confidence',profile.match_strength) as any}
                                className="!rounded-none"
                              />
                            </div>
                            <div className="mt-2">
                              <a
                                href={profile.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline break-all text-sm"
                              >
                                {profile.title || profile.url}
                              </a>
                            </div>
                            {profile.notes && <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{profile.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Identity resolution */}
                  <div className={`requirement-card ${cardStyle}`}>
                    <div className={cardHeaderStyle}>
                      <h5 className={cardTitleStyle}>Identity Resolution</h5>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label
                          id="identity-status"
                          text={verificationResult.identity_resolution.status}
                          size="small"
                          color={getLabelColor('identity',verificationResult.identity_resolution.status) as any}
                          className="!rounded-none"
                        />
                        <Label
                          id="identity-confidence"
                          text={`${verificationResult.identity_resolution.confidence} confidence`}
                          size="small"
                          color={getLabelColor('confidence',verificationResult.identity_resolution.confidence) as any}
                          className="!rounded-none"
                        />
                      </div>
                    </div>

                    <div className={blockStyle}>
                      <p className={bodyTextStyle}>{verificationResult.identity_resolution.reason}</p>
                      {verificationResult.identity_resolution.signals && verificationResult.identity_resolution.signals.length > 0 && (
                        <div className="text-xs text-gray-600 dark:text-[#9699a6] mt-2">
                          Signals: {verificationResult.identity_resolution.signals.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Claims */}
                  <div className={`requirement-card ${cardStyle}`}>
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
                      {structuredClaims.map((claim) => {
                        const dateRange =
                          claim.entity?.start_date || claim.entity?.end_date
                            ? [claim.entity?.start_date || null, claim.entity?.end_date || null].filter(Boolean).join(' - ')
                            : '';
                        const subtitle = [
                          claim.entity?.organization || null,
                          claim.entity?.role || null,
                          claim.entity?.location || null,
                          dateRange || null,
                          claim.entity?.credential || null,
                        ]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <div key={claim.id} className={blockStyle}>
                            <div className="flex justify-between items-start gap-3 flex-wrap">
                              <div className="flex-1 min-w-[220px]">
                                <div className="text-sm font-semibold text-gray-800 dark:text-[#d5d8df]">{claim.claim}</div>
                                {subtitle && <div className="text-xs text-gray-600 dark:text-[#9699a6] mt-1">{subtitle}</div>}
                              </div>
                              <div className="flex gap-2 flex-wrap justify-end">
                                <Label
                                  id={`claim-status-${claim.id}`}
                                  text={getVerificationStatusLabel(claim.verification_status)}
                                  size="small"
                                  color={getLabelColorForClaimStatus(claim.verification_status) as any}
                                  className="!rounded-none"
                                />
                                <Label
                                  id={`claim-confidence-${claim.id}`}
                                  text={`${claim.confidence} confidence`}
                                  size="small"
                                  color={getLabelColor('confidence',claim.confidence) as any}
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

                            {claim.reason && <div className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{claim.reason}</div>}

                            {claim.evidence_snippets && claim.evidence_snippets.length > 0 && (
                              <div className="mt-3">
                                <div className={sectionLabelStyle}>Evidence</div>
                                <ul className="list-disc list-outside ml-5 text-sm text-gray-700 dark:text-[#d5d8df] space-y-1 m-0">
                                  {claim.evidence_snippets.map((snippet, idx) => (
                                    <li key={idx} className="whitespace-pre-wrap">
                                      {snippet}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {claim.discrepancies && claim.discrepancies.length > 0 && (
                              <div className="mt-3">
                                <div className={sectionLabelStyle}>Discrepancies</div>
                                <div className="space-y-2">
                                  {claim.discrepancies.map((d, idx) => (
                                    <div key={idx} className="text-sm text-gray-700">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Label
                                          id={`claim-discrepancy-severity-${claim.id}-${idx}`}
                                          text={d.severity}
                                          size="small"
                                          color={getLabelColor('severity',d.severity) as any}
                                          className="!rounded-none"
                                        />
                                        <span className="text-xs text-gray-500 dark:text-[#9699a6]">{d.type}</span>
                                      </div>
                                      <div className="mt-2 whitespace-pre-wrap">{d.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {claim.sources && claim.sources.length > 0 && (
                              <div className="mt-3">
                                <div className={sectionLabelStyle}>Sources</div>
                                <div className="space-y-1 text-sm">
                                  {claim.sources.map((source, idx) => (
                                    <a
                                      key={idx}
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-blue-600 hover:text-blue-800 hover:underline break-all"
                                    >
                                      {source.title || source.url}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Discrepancies summary */}
                  {verificationResult.discrepancies_summary && verificationResult.discrepancies_summary.length > 0 && (
                    <div className={`requirement-card ${cardStyle}`}>
                      <div className={cardHeaderStyle}>
                        <h5 className={cardTitleStyle}>Discrepancies Summary</h5>
                      </div>
                      <div className="flex flex-col gap-3">
                        {verificationResult.discrepancies_summary.map((d, idx) => (
                          <div key={idx} className={blockStyle}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label
                                id={`discrepancy-summary-severity-${idx}`}
                                text={d.severity}
                                size="small"
                                color={getLabelColor('severity',d.severity) as any}
                                className="!rounded-none"
                              />
                              <span className="text-xs text-gray-500 dark:text-[#9699a6]">{d.type}</span>
                            </div>
                            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{d.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer: Sources & Search Queries */}
	                  <div className="pt-2 border-t border-gray-200 dark:border-[#4b4e69]">
	                    <div className="flex flex-col gap-4">
	                      <div>
	                        <div className="text-sm font-semibold text-gray-600 dark:text-[#9699a6]">Sources Consulted</div>
	                        {verificationResult.sources && verificationResult.sources.length > 0 ? (
	                          <div className="mt-1 space-y-1 text-sm">
	                            {verificationResult.sources.map((source, idx) => (
	                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-blue-600 hover:text-blue-800 hover:underline break-all"
                              >
                                {source.title || source.url}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-[#9699a6]">No sources available</div>
                        )}
	                      </div>
	
	                      <div>
	                        <div className="text-sm font-semibold text-gray-600 dark:text-[#9699a6]">Search Queries</div>
	                        {verificationResult.search_queries_used && verificationResult.search_queries_used.length > 0 ? (
	                          <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
	                            {verificationResult.search_queries_used.join('\n')}
	                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-[#9699a6]">No search queries available</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-[#d5d8df]">No Verification Data</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#9699a6]">Run web verification to validate key claims.</p>
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateDetail;

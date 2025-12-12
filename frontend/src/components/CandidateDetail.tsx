import React, { useState } from 'react';
import { toast } from 'sonner';
import { Candidate, Job, apiService, WebVerificationResult } from '../services/apiService';
import ResumeTemplateSelector from './ResumeTemplateSelector';
import RadialProgress from './RadialProgress';
import { Button, Label, MenuItem, SplitButton, SplitButtonMenu } from '@vibe/core';
import { BsCheck } from 'react-icons/bs';

interface CandidateDetailProps {
  candidate: Candidate;
  job: Job;
  onBack: () => void;
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ candidate, job, onBack }) => {
  const [improvingResume, setImprovingResume] = useState(false);
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

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-green-500';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getImportanceColor = (importance: string): string => {
    switch (importance.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRelevanceColor = (relevance: string): string => {
    switch (relevance.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  const getVerificationStatusColor = (status: string): string => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'partially_verified': return 'bg-yellow-100 text-yellow-800';
      case 'limited_information': return 'bg-orange-100 text-orange-800';
      case 'no_information_found': return 'bg-gray-100 text-gray-800';
      case 'contradicted': return 'bg-red-100 text-red-800';
      case 'unverified': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  const getConfidenceColor = (confidence?: string): string => {
    switch ((confidence || '').toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleImproveResume = async () => {
    try {
      setImprovingResume(true);
      const pdfBlob = await apiService.downloadImprovedResume(candidate.id);
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `improved_resume_${candidate.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Improved resume downloaded successfully!');
    } catch (err: any) {
      console.error('Improve resume error:', err);
      toast.error('Failed to improve resume: ' + (err.response?.data?.error || err.message));
    } finally {
      setImprovingResume(false);
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

  const cardStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    borderRadius: '0px',
    padding: '16px',
    marginBottom: '12px',
    background: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  };

  const cardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    color: '#333',
    fontSize: '14px',
    lineHeight: '1.4',
  };

  const blockStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: '0px',
    padding: '12px',
    background: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  };

  const sectionLabelStyle: React.CSSProperties = {
    margin: '0 0 6px 0',
    fontSize: '12px',
    fontWeight: 600,
    color: '#4a5568',
  };

  const bodyTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#555',
    whiteSpace: 'pre-wrap',
  };

  const getLabelColorForStrength = (level?: 'critical' | 'high' | 'medium' | 'low') => {
    switch ((level || '').toLowerCase()) {
      case 'critical':
      case 'high':
        return Label.colors.POSITIVE;
      case 'medium':
        return Label.colors.WORKING_ORANGE;
      case 'low':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForWeakness = (level?: 'critical' | 'high' | 'medium' | 'low') => {
    switch ((level || '').toLowerCase()) {
      case 'critical':
      case 'high':
        return Label.colors.NEGATIVE;
      case 'medium':
        return Label.colors.WORKING_ORANGE;
      case 'low':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForVerificationStatus = (status: string) => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified':
        return Label.colors.POSITIVE;
      case 'partially_verified':
        return Label.colors.WORKING_ORANGE;
      case 'contradicted':
        return Label.colors.NEGATIVE;
      case 'limited_information':
      case 'no_information_found':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForConfidence = (confidence?: string) => {
    switch ((confidence || '').toLowerCase()) {
      case 'high':
        return Label.colors.POSITIVE;
      case 'medium':
        return Label.colors.WORKING_ORANGE;
      case 'low':
        return Label.colors.NEGATIVE;
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForClaimStatus = (status: string) => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified':
        return Label.colors.POSITIVE;
      case 'partially_verified':
        return Label.colors.WORKING_ORANGE;
      case 'contradicted':
        return Label.colors.NEGATIVE;
      case 'inconclusive':
        return Label.colors.WORKING_ORANGE;
      case 'unverified':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForPresence = (level?: string) => {
    switch ((level || '').toLowerCase()) {
      case 'strong':
        return Label.colors.POSITIVE;
      case 'moderate':
        return Label.colors.WORKING_ORANGE;
      case 'weak':
      case 'none':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForIdentity = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'matched':
        return Label.colors.POSITIVE;
      case 'ambiguous':
        return Label.colors.WORKING_ORANGE;
      case 'not_found':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getLabelColorForSeverity = (severity?: string) => {
    switch ((severity || '').toLowerCase()) {
      case 'high':
      case 'critical':
        return Label.colors.NEGATIVE;
      case 'medium':
        return Label.colors.WORKING_ORANGE;
      case 'low':
      default:
        return Label.colors.AMERICAN_GRAY;
    }
  };

  const getVerificationCardTint = (status: string): React.CSSProperties => {
    switch (normalizeVerificationStatus(status)) {
      case 'verified':
        return { background: '#f0fff4', border: '1px solid #9ae6b4' };
      case 'partially_verified':
        return { background: '#fffaf0', border: '1px solid #fbd38d' };
      case 'contradicted':
        return { background: '#fff5f5', border: '1px solid #feb2b2' };
      case 'limited_information':
      case 'no_information_found':
      default:
        return { background: '#f8f9fa', border: '1px solid #e2e8f0' };
    }
  };

  const getLabelColorForVerifiableRatio = (ratio?: number) => {
    if (typeof ratio !== 'number') return Label.colors.AMERICAN_GRAY;
    if (ratio >= 0.7) return Label.colors.POSITIVE;
    if (ratio >= 0.4) return Label.colors.WORKING_ORANGE;
    return Label.colors.NEGATIVE;
  };

  const getStrengthCardTint = (level?: 'critical' | 'high' | 'medium' | 'low'): React.CSSProperties => {
    const p = (level || '').toLowerCase();
    if (p === 'critical' || p === 'high') return { background: '#f0fff4', border: '1px solid #9ae6b4' };
    if (p === 'medium') return { background: '#fffaf0', border: '1px solid #fbd38d' };
    if (p === 'low') return { background: '#fff5f5', border: '1px solid #feb2b2' };
    return { background: 'white', border: '1px solid #ddd' };
  };

  const getWeaknessCardTint = (level?: 'critical' | 'high' | 'medium' | 'low'): React.CSSProperties => {
    const p = (level || '').toLowerCase();
    if (p === 'critical') return { background: '#fff5f5', border: '1px solid #fc8181' };
    if (p === 'high') return { background: '#fff5f5', border: '1px solid #feb2b2' };
    if (p === 'medium') return { background: '#fffaf0', border: '1px solid #fbd38d' };
    if (p === 'low') return { background: '#f8f9fa', border: '1px solid #e2e8f0' };
    return { background: 'white', border: '1px solid #ddd' };
  };

  const analysis = candidate;
  const isImprovedResume = (candidate.resume_filename || '').toLowerCase().includes('improved');
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
    <div className="bg-white shadow max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <button
              onClick={onBack}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <span>{candidate.name}</span>
                {isImprovedResume && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                    Improved
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-600">Candidate Analysis for {job.title}</p>
            </div>
          </div>
          <div className="text-center flex-1 flex flex-col items-center">
            <RadialProgress score={analysis?.overall_score || 0} size={96} strokeWidth={10} />
            <div className="text-xs text-gray-500 mt-2">Overall Score</div>
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
              <span className="text-gray-500">Email:</span>
              <span>{candidate.email || 'Not provided'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">Phone:</span>
              <span>{candidate.phone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {analysis?.summary && (
          <div className="mb-6">
            <div className="bg-blue-50 p-4">
              <h3 className="text-base font-medium text-gray-900 mb-2">Summary</h3>
              <p className="text-gray-700">{analysis.summary}</p>
            </div>
          </div>
        )}

        {/* Tabs for detailed sections */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('strengths')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'strengths'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
                }`}
            >
              Strengths ({analysis?.strengths?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('weaknesses')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'weaknesses'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
                }`}
            >
              Weaknesses ({analysis?.weaknesses?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'skills'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
                }`}
            >
              Skills ({analysis?.skill_analysis?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('experience')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'experience'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
                }`}
            >
              Experience
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${activeTab === 'verification'
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
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
	                      <div key={index} className="requirement-card" style={{ ...cardStyle, ...getStrengthCardTint(level) }}>
	                        <div className="card-header" style={cardHeaderStyle}>
	                          <h5 style={cardTitleStyle}>{strength.strength}</h5>
	                          {level && label && (
	                            <Label
	                              id={`strength-level-${index}`}
	                              text={label}
	                              size="small"
	                              color={getLabelColorForStrength(level) as any}
	                              className="!rounded-none"
	                            />
	                          )}
	                        </div>

	                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
	                          {strength.evidence && (
	                            <div style={blockStyle}>
	                              <div style={sectionLabelStyle}>Evidence</div>
	                              <p style={bodyTextStyle}>{strength.evidence}</p>
	                            </div>
	                          )}

	                          {relevanceDetails && (
	                            <div style={blockStyle}>
	                              <div style={sectionLabelStyle}>Relevance</div>
	                              <p style={bodyTextStyle}>{relevanceDetails}</p>
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
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No Strengths</h3>
                  <p className="mt-2 text-sm text-gray-500">No strengths were identified for this candidate.</p>
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
	                      <div key={index} className="requirement-card" style={{ ...cardStyle, ...getWeaknessCardTint(level) }}>
	                        <div className="card-header" style={cardHeaderStyle}>
	                          <h5 style={cardTitleStyle}>{weakness.weakness}</h5>
	                          {level && label && (
	                            <Label
	                              id={`weakness-level-${index}`}
	                              text={label}
	                              size="small"
	                              color={getLabelColorForWeakness(level) as any}
	                              className="!rounded-none"
	                            />
	                          )}
	                        </div>

	                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
	                          {importanceDetails && (
	                            <div style={blockStyle}>
	                              <div style={sectionLabelStyle}>Notes</div>
	                              <p style={bodyTextStyle}>{importanceDetails}</p>
	                            </div>
	                          )}

	                          {weakness.impact && (
	                            <div style={blockStyle}>
	                              <div style={sectionLabelStyle}>Impact</div>
	                              <p style={bodyTextStyle}>{weakness.impact}</p>
	                            </div>
	                          )}

	                          {weakness.recommendation && (
	                            <div style={blockStyle}>
	                              <div style={sectionLabelStyle}>Recommendation</div>
	                              <p style={bodyTextStyle}>{weakness.recommendation}</p>
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
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No Weaknesses</h3>
                  <p className="mt-2 text-sm text-gray-500">No weaknesses were identified for this candidate.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && (
            <div>
              {analysis?.skill_analysis && analysis.skill_analysis.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.skill_analysis.map((skill, index) => (
                    <div key={index} className="border border-gray-200 p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900 text-sm">{skill.skill}</h4>
                        <RadialProgress score={skill.score * 10} size={48} strokeWidth={5} />
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Required:</span>
                          <span className="font-medium text-gray-700 capitalize">{skill.required_level}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Candidate:</span>
                          <span className="font-medium text-gray-700 capitalize">{skill.candidate_level}</span>
                        </div>
                      </div>
                      {skill.evidence && (
                        <div className="bg-gray-50 p-2">
                          <p className="text-xs text-gray-600 leading-relaxed">{skill.evidence}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No skill analysis available</p>
              )}
            </div>
          )}

          {activeTab === 'experience' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Experience */}
	              <div className="border border-gray-200 bg-white p-5">
	                <div className="flex items-start justify-between gap-4 mb-4">
	                  <div>
	                    <h3 className="text-sm font-semibold text-gray-900">Experience</h3>
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
	                  <div className="mb-4 border border-blue-200 bg-blue-50 p-3">
	                    <div className="text-sm font-semibold text-blue-900 mb-1">Role Progression</div>
	                    <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">
	                      {analysis.experience_match.role_progression}
	                    </p>
	                  </div>
	                )}
	
	                {analysis?.experience_match?.industry_match && (
	                  <div className="mb-4 border border-gray-200 bg-gray-50 p-3">
	                    <div className="text-sm font-semibold text-gray-700 mb-1">Industry Match</div>
	                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
	                      {analysis.experience_match.industry_match}
	                    </p>
	                  </div>
	                )}
	
	                <div className="text-sm font-semibold text-gray-600 mb-3">Companies</div>
	                {analysis?.experience_match?.companies && analysis.experience_match.companies.length > 0 ? (
	                  <div className="relative ml-2 border-l-2 border-gray-200">
	                    {sortByStartDateDescending(analysis.experience_match.companies).map((company, idx, allCompanies) => {
	                      const isLast = idx === allCompanies.length - 1;
                      if (typeof company === 'string') {
                        return (
                          <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white border-2 border-blue-500" />
                            <div className="text-sm font-medium text-gray-900">{company}</div>
                          </div>
                        );
                      }

                      const dateRange =
                        company.start_date || company.end_date
                          ? `${company.start_date || ''}${company.start_date || company.end_date ? ' - ' : ''}${company.end_date || ''}`.trim()
                          : '';

                      return (
                        <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white border-2 border-blue-500" />
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900">{company.name}</div>
                            {dateRange && <div className="text-xs text-gray-500 whitespace-nowrap">{dateRange}</div>}
                          </div>
                          {company.location && <div className="text-xs text-gray-500 mt-0.5">{company.location}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No company history available</p>
                )}
              </div>

              {/* Education */}
	              <div className="border border-gray-200 bg-white p-5">
	                <div className="mb-4">
	                  <h3 className="text-sm font-semibold text-gray-900">Education</h3>
	                </div>
	
	                {analysis?.education_match?.degree_relevance && (
	                  <div className="mb-4 border border-gray-200 bg-gray-50 p-3">
	                    <div className="text-sm font-semibold text-gray-700 mb-1">Degree Relevance</div>
	                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
	                      {analysis.education_match.degree_relevance}
	                    </p>
	                  </div>
	                )}
	
	                {analysis?.education_match?.continuous_learning && (
	                  <div className="mb-4 border border-green-200 bg-green-50 p-3">
	                    <div className="text-sm font-semibold text-green-900 mb-1">Continuous Learning</div>
	                    <p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap">
	                      {analysis.education_match.continuous_learning}
	                    </p>
	                  </div>
	                )}
	
	                <div className="text-sm font-semibold text-gray-600 mb-3">Institutions</div>
	                {analysis?.education_match?.institutions && analysis.education_match.institutions.length > 0 ? (
	                  <div className="relative ml-2 border-l-2 border-gray-200">
	                    {sortByStartDateDescending(analysis.education_match.institutions).map((inst, idx, allInstitutions) => {
	                      const isLast = idx === allInstitutions.length - 1;
                      if (typeof inst === 'string') {
                        return (
                          <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white border-2 border-green-600" />
                            <div className="text-sm font-medium text-gray-900">{inst}</div>
                          </div>
                        );
                      }

                      const dateRange =
                        inst.start_date || inst.end_date
                          ? `${inst.start_date || ''}${inst.start_date || inst.end_date ? ' - ' : ''}${inst.end_date || ''}`.trim()
                          : '';

                      return (
                        <div key={idx} className={`relative pl-6 ${isLast ? '' : 'pb-4'}`}>
                          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white border-2 border-green-600" />
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900">{inst.name}</div>
                            {dateRange && <div className="text-xs text-gray-500 whitespace-nowrap">{dateRange}</div>}
                          </div>
                          {inst.location && <div className="text-xs text-gray-500 mt-0.5">{inst.location}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No education history available</p>
	                )}
	
	                {analysis?.education_match?.certifications && analysis.education_match.certifications.length > 0 && (
	                  <div className="mt-5">
	                    <div className="text-sm font-semibold text-gray-600 mb-2">Certifications</div>
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
                            rightIcon={verificationProvider === 'gemini' ? () => <BsCheck /> : undefined}
                          />
                          <MenuItem
                            id="verify-openai"
                            title="OpenAI"
                            onClick={() => setVerificationProvider('openai')}
                            rightIcon={verificationProvider === 'openai' ? () => <BsCheck /> : undefined}
                          />
                        </SplitButtonMenu>
                      }
                    >
                      {verifying ? 'Verifying...' : 'Verify'}
                    </SplitButton>
                  </div>

                  {/* Summary */}
                  <div className="requirement-card" style={{ ...cardStyle, ...getVerificationCardTint(verificationResult.overall_verification_status) }}>
                    <div style={cardHeaderStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h5 style={cardTitleStyle}>Web Verification</h5>
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
                            color={getLabelColorForConfidence(verificationResult.overall_confidence) as any}
                            className="!rounded-none"
                          />
                        </div>
                        <div className="text-sm text-gray-600">{verificationResult.candidate_name || candidate.name}</div>
                      </div>

                      <div />
                    </div>

                    {verificationResult.verification_summary && (
                      <div style={{ ...blockStyle, background: '#f8f9fa' }}>
                        <p style={bodyTextStyle}>{verificationResult.verification_summary}</p>
                      </div>
                    )}

                    <div className="mt-4" style={blockStyle}>
                      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 text-sm text-gray-600">
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
                            color={getLabelColorForPresence(verificationResult.online_presence?.presence_level) as any}
                            className="!rounded-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span>Identity</span>
                          <Label
                            id="verification-identity-status"
                            text={verificationResult.identity_resolution?.status || '—'}
                            size="small"
                            color={getLabelColorForIdentity(verificationResult.identity_resolution?.status) as any}
                            className="!rounded-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Online presence */}
                  <div className="requirement-card" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h5 style={cardTitleStyle}>Online Presence</h5>
                      <Label
                        id="presence-level"
                        text={verificationResult.online_presence?.presence_level || '—'}
                        size="small"
                        color={getLabelColorForPresence(verificationResult.online_presence?.presence_level) as any}
                        className="!rounded-none"
                      />
                    </div>

                    {verificationResult.online_presence?.summary && (
                      <div style={blockStyle}>
                        <p style={bodyTextStyle}>{verificationResult.online_presence.summary}</p>
                      </div>
                    )}

                    {verificationResult.online_presence?.profiles && verificationResult.online_presence.profiles.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {verificationResult.online_presence.profiles.map((profile, idx) => (
                          <div key={idx} style={blockStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                                color={getLabelColorForConfidence(profile.match_strength) as any}
                                className="!rounded-none"
                              />
                            </div>
                            <div style={{ marginTop: '8px' }}>
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
                  <div className="requirement-card" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h5 style={cardTitleStyle}>Identity Resolution</h5>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Label
                          id="identity-status"
                          text={verificationResult.identity_resolution.status}
                          size="small"
                          color={getLabelColorForIdentity(verificationResult.identity_resolution.status) as any}
                          className="!rounded-none"
                        />
                        <Label
                          id="identity-confidence"
                          text={`${verificationResult.identity_resolution.confidence} confidence`}
                          size="small"
                          color={getLabelColorForConfidence(verificationResult.identity_resolution.confidence) as any}
                          className="!rounded-none"
                        />
                      </div>
                    </div>

                    <div style={blockStyle}>
                      <p style={bodyTextStyle}>{verificationResult.identity_resolution.reason}</p>
                      {verificationResult.identity_resolution.signals && verificationResult.identity_resolution.signals.length > 0 && (
                        <div className="text-xs text-gray-600 mt-2">
                          Signals: {verificationResult.identity_resolution.signals.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Claims */}
                  <div className="requirement-card" style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <h5 style={cardTitleStyle}>Claims</h5>
                      <Label
                        id="claims-count"
                        text={`${structuredClaims.length} items`}
                        size="small"
                        color={Label.colors.AMERICAN_GRAY as any}
                        className="!rounded-none"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                          <div key={claim.id} style={blockStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: '220px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#2d3748' }}>{claim.claim}</div>
                                {subtitle && <div className="text-xs text-gray-600 mt-1">{subtitle}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                                  color={getLabelColorForConfidence(claim.confidence) as any}
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
                                <div style={sectionLabelStyle}>Evidence</div>
                                <ul className="list-disc list-outside ml-5 text-sm text-gray-700 space-y-1" style={{ margin: 0 }}>
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
                                <div style={sectionLabelStyle}>Discrepancies</div>
                                <div className="space-y-2">
                                  {claim.discrepancies.map((d, idx) => (
                                    <div key={idx} className="text-sm text-gray-700">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Label
                                          id={`claim-discrepancy-severity-${claim.id}-${idx}`}
                                          text={d.severity}
                                          size="small"
                                          color={getLabelColorForSeverity(d.severity) as any}
                                          className="!rounded-none"
                                        />
                                        <span className="text-xs text-gray-500">{d.type}</span>
                                      </div>
                                      <div className="mt-2 whitespace-pre-wrap">{d.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {claim.sources && claim.sources.length > 0 && (
                              <div className="mt-3">
                                <div style={sectionLabelStyle}>Sources</div>
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
                    <div className="requirement-card" style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <h5 style={cardTitleStyle}>Discrepancies Summary</h5>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {verificationResult.discrepancies_summary.map((d, idx) => (
                          <div key={idx} style={blockStyle}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label
                                id={`discrepancy-summary-severity-${idx}`}
                                text={d.severity}
                                size="small"
                                color={getLabelColorForSeverity(d.severity) as any}
                                className="!rounded-none"
                              />
                              <span className="text-xs text-gray-500">{d.type}</span>
                            </div>
                            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{d.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer: Sources & Search Queries */}
	                  <div className="pt-2 border-t border-gray-200">
	                    <div className="flex flex-col gap-4">
	                      <div>
	                        <div className="text-sm font-semibold text-gray-600">Sources Consulted</div>
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
                          <div className="text-sm text-gray-500">No sources available</div>
                        )}
	                      </div>
	
	                      <div>
	                        <div className="text-sm font-semibold text-gray-600">Search Queries</div>
	                        {verificationResult.search_queries_used && verificationResult.search_queries_used.length > 0 ? (
	                          <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
	                            {verificationResult.search_queries_used.join('\n')}
	                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No search queries available</div>
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
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No Verification Data</h3>
                  <p className="mt-2 text-sm text-gray-500">Run web verification to validate key claims.</p>
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
                          rightIcon={verificationProvider === 'gemini' ? () => <BsCheck /> : undefined}
                        />
                        <MenuItem
                          id="verify-empty-openai"
                          title="OpenAI"
                          onClick={() => setVerificationProvider('openai')}
                          rightIcon={verificationProvider === 'openai' ? () => <BsCheck /> : undefined}
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

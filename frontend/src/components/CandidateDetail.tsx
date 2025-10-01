import React, { useState } from 'react';
import { Candidate, Job, apiService } from '../services/apiService';
import ResumeTemplateSelector from './ResumeTemplateSelector';

interface CandidateDetailProps {
  candidate: Candidate;
  job: Job;
  onBack: () => void;
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ candidate, job, onBack }) => {
  const [improvingResume, setImprovingResume] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'strengths' | 'weaknesses' | 'skills' | 'experience'>('strengths');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'info', message: string, duration: number = 5000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), duration);
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
      case 'high': return 'bg-red-100 text-red-800';     // Critical weakness - Red
      case 'medium': return 'bg-orange-100 text-orange-800'; // Moderate weakness - Orange
      case 'low': return 'bg-gray-100 text-gray-800';    // Minor weakness - Gray
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

  const handleImproveResume = async () => {
    try {
      setImprovingResume(true);

      // Download improved resume as PDF
      const pdfBlob = await apiService.downloadImprovedResume(candidate.id);

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `improved_resume_${candidate.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showNotification('success', 'Improved resume downloaded successfully!');

    } catch (err: any) {
      console.error('Improve resume error:', err);
      showNotification('error', 'Failed to improve resume: ' + (err.response?.data?.error || err.message));
    } finally {
      setImprovingResume(false);
    }
  };

  // Analysis data is now directly on candidate object
  const analysis = candidate;

  return (
    <div className="bg-white rounded-lg shadow max-w-6xl mx-auto">
      {/* Notification Banner */}
      {notification && (
        <div className={`m-6 mb-0 p-4 rounded-lg border ${
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

      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{candidate.name}</h2>
              <p className="text-sm text-gray-600">Candidate Analysis for {job.title}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(analysis?.overall_score || 0)}`}>
                {analysis?.overall_score || 0}%
              </div>
              <div className="text-xs text-gray-500">Overall Score</div>
            </div>
            <button
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
            >
              <span>{showTemplateSelector ? 'Hide Templates' : 'Improve'}</span>
            </button>
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
                showNotification('success', `Resume generated and saved to SharePoint!`);
              } else {
                showNotification('success', 'Resume generated successfully!');
              }
              setShowTemplateSelector(false);
            }}
          />
        </div>
      )}

      <div className="p-6">
        {/* Contact Information */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-500"></span>
              <span>{candidate.email || 'Not provided'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500"></span>
              <span>{candidate.phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500"></span>
              <span>{candidate.resume_filename}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {analysis?.summary && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Summary</h3>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-gray-700">{analysis.summary}</p>
            </div>
          </div>
        )}

        {/* Tabs for detailed sections */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {(['strengths', 'weaknesses', 'skills', 'experience'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 text-sm font-medium capitalize border-b-2 ${
                  activeTab === tab
                    ? 'text-blue-600 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'strengths' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                Strengths ({analysis?.strengths?.length || 0})
              </h3>
              <div className="space-y-3">
                {analysis?.strengths?.map((strength, index) => (
                  <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-green-900">{strength.strength}</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRelevanceColor(strength.relevance)}`}>
                        {strength.relevance}
                      </span>
                    </div>
                    <p className="text-sm text-green-700">{strength.evidence}</p>
                  </div>
                )) || <p className="text-gray-500">No strengths identified</p>}
              </div>
            </div>
          )}

          {activeTab === 'weaknesses' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                Areas for Improvement ({analysis?.weaknesses?.length || 0})
              </h3>
              <div className="space-y-3">
                {analysis?.weaknesses?.map((weakness, index) => (
                  <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-red-900">{weakness.weakness}</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImportanceColor(weakness.importance)}`}>
                        {weakness.importance}
                      </span>
                    </div>
                    <p className="text-sm text-red-700 mb-2">{weakness.impact}</p>
                    <div className="bg-red-100 rounded p-2">
                      <p className="text-xs text-red-800">
                        <strong>Recommendation:</strong> {weakness.recommendation}
                      </p>
                    </div>
                  </div>
                )) || <p className="text-gray-500">No weaknesses identified</p>}
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                Skill Analysis ({analysis?.skill_analysis?.length || 0})
              </h3>
              {analysis?.skill_analysis && analysis.skill_analysis.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.skill_analysis.map((skill, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900 text-sm">{skill.skill}</h4>
                        <span className={`text-lg font-bold ${getScoreColor(skill.score * 10)}`}>
                          {skill.score}/10
                        </span>
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
                        <div className="bg-gray-50 rounded p-2">
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
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                Experience & Education Match
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysis?.experience_match && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Experience Match</h4>
                    <div className="space-y-2 text-sm">
                      <div>Total Experience: <span className="font-medium">{analysis.experience_match.total_years} years</span></div>
                      <div>Relevant Experience: <span className="font-medium">{analysis.experience_match.relevant_years} years</span></div>
                      <div>Industry Match: <span className={`font-medium ${getRelevanceColor(analysis.experience_match.industry_match).replace('bg-', 'text-').replace('-100', '-600')}`}>
                        {analysis.experience_match.industry_match}
                      </span></div>
                    </div>
                  </div>
                )}

                {analysis?.education_match && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Education Match</h4>
                    <div className="space-y-2 text-sm">
                      <div>Degree Relevance: <span className={`font-medium ${getRelevanceColor(analysis.education_match.degree_relevance).replace('bg-', 'text-').replace('-100', '-600')}`}>
                        {analysis.education_match.degree_relevance}
                      </span></div>
                      {analysis.education_match.certifications && analysis.education_match.certifications.length > 0 && (
                        <div>Certifications: <span className="font-medium">{analysis.education_match.certifications.join(', ')}</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateDetail;

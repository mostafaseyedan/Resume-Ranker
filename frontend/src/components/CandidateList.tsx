import React, { useState } from 'react';
import { Candidate } from '../services/apiService';
import RadialProgress from './RadialProgress';
import { IconButton } from '@vibe/core';
import '@vibe/core/tokens';

interface SharePointFile {
  name: string;
  web_url: string;
  download_url: string;
  path: string;
  size: number;
  created_datetime?: string;
  modified_datetime?: string;
}

interface CandidateListProps {
  candidates: Candidate[];
  onCandidateSelect: (candidate: Candidate) => void;
  onCandidateDeleted: (candidateId: string) => void;
  sharepointFiles?: { job_files: SharePointFile[]; resume_files: SharePointFile[]; sharepoint_link: string } | null;
}

const CandidateList: React.FC<CandidateListProps> = ({ candidates, onCandidateSelect, onCandidateDeleted, sharepointFiles }) => {
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [collapsedCandidates, setCollapsedCandidates] = useState<Set<string>>(new Set());

  const toggleExpand = (candidateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const getScoreColor = (score: number | undefined): string => {
    if (score === undefined) return 'text-gray-600 dark:text-[#9699a6] bg-gray-100 dark:bg-[#30324e]';
    if (score >= 90) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    if (score >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  };

  const getVerificationBadge = (candidate: Candidate): { label: string; style: string } => {
    const status = candidate.web_verification?.overall_verification_status;
    if (!candidate.web_verification) {
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

  // Function to find SharePoint file by matching filename
  const findSharePointFile = (filename: string): SharePointFile | null => {
    if (!sharepointFiles) return null;

    const allFiles = [
      ...(sharepointFiles.job_files || []),
      ...(sharepointFiles.resume_files || [])
    ];

    // Try exact match first
    let file = allFiles.find(f => f.name === filename);

    // If no exact match, try case-insensitive match
    if (!file) {
      file = allFiles.find(f => f.name.toLowerCase() === filename.toLowerCase());
    }

    // If still no match, try matching without extension
    if (!file) {
      const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      file = allFiles.find(f => {
        const fNameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
        return fNameWithoutExt.toLowerCase() === filenameWithoutExt.toLowerCase();
      });
    }

    return file || null;
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent candidate selection when clicking delete

    if (!confirm(`Are you sure you want to delete ${candidateName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingCandidateId(candidateId);
    try {
      await onCandidateDeleted(candidateId);
    } catch (error) {
      console.error('Failed to delete candidate:', error);
      alert('Failed to delete candidate. Please try again.');
    } finally {
      setDeletingCandidateId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-[#d5d8df] mb-2 mt-4">No candidates yet</h3>
        <p className="text-gray-500 dark:text-[#9699a6]">Upload your first resume to get started with analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {candidates.map((candidate) => {
          const sharepointFile = findSharePointFile(candidate.resume_filename || '');
          const isImproved = (candidate.resume_filename || '').toLowerCase().includes('improved');
          const score = candidate.overall_score;
          const isExpanded = !collapsedCandidates.has(candidate.id);

          return (
            <div
              key={candidate.id}
              onClick={() => onCandidateSelect(candidate)}
              className="bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#4b4e69] p-4 hover:bg-gray-50 dark:hover:bg-[#3a3d5c] hover:border-blue-400 cursor-pointer transition-all shadow-sm hover:shadow-md flex flex-col self-start"
            >
              {/* Header: Name and Score */}
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-base truncate" title={candidate.name}>
                      {candidate.name || 'Unnamed Candidate'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {isImproved && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                          Improved
                        </span>
                      )}
                      {(() => {
                        const badge = getVerificationBadge(candidate);
                        return (
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${badge.style}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      <span className="text-xs text-gray-500 dark:text-[#9699a6]">
                        {formatDate(sharepointFile?.created_datetime || candidate.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={`px-2 py-1 text-sm font-bold ${getScoreColor(score)}`}>
                      {score !== undefined ? `${score}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* File Info and Expand Toggle */}
                <div className="mb-4 flex justify-between items-center">
                  <div className="flex-1 min-w-0 mr-2">
                    {sharepointFile ? (
                      <a
                        href={sharepointFile.web_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center space-x-1 truncate max-w-full"
                        title={candidate.resume_filename}
                      >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                        </svg>
                        <span className="truncate">{candidate.resume_filename}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-[#9699a6] truncate block" title={candidate.resume_filename}>
                        {candidate.resume_filename} <span className="italic text-gray-400">(File is removed)</span>
                      </span>
                    )}
                  </div>
                  <IconButton
                    onClick={(e) => toggleExpand(candidate.id, e)}
                    kind="tertiary"
                    size="xs"
                    icon={() => (
                      <svg
                        className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                    className="text-gray-400 hover:text-gray-600 dark:text-[#9699a6]"
                    tooltipContent={isExpanded ? "Collapse" : "Expand"}
                  />
                </div>

                {/* Highlights: Experience & Strengths & Weaknesses (Collapsible) */}
                {isExpanded && (
                  <div className="space-y-3 mb-2 animate-fadeIn">
                    {/* Experience */}
                    {candidate.experience_match && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 dark:text-[#9699a6]">Experience:</span>
                        <span className="text-gray-700 dark:text-[#d5d8df] font-medium">
                          {candidate.experience_match.total_years} years
                        </span>
                      </div>
                    )}

                    {/* Top Strengths */}
                    {candidate.strengths && candidate.strengths.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-[#9699a6] mb-1">Top Strengths:</div>
                        <div className="space-y-1">
                          {candidate.strengths.slice(0, 2).map((s, i) => (
                            <div key={i} className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 truncate max-w-full">
                              {s.strength}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {candidate.weaknesses && candidate.weaknesses.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-[#9699a6] mb-1">Areas for Improvement:</div>
                        <div className="space-y-1">
                          {candidate.weaknesses.slice(0, 2).map((w, i) => (
                            <div key={i} className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 truncate max-w-full">
                              {w.weakness}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Low Skill Highlights (< 70%) */}
                    {candidate.skill_analysis && (
                      (() => {
                        // Assuming skill score is 0-10, so < 7 is < 70%
                        const lowSkills = candidate.skill_analysis.filter(s => s.score < 7);
                        if (lowSkills.length === 0) return null;

                        return (
                          <div>
                            <div className="text-xs text-gray-500 dark:text-[#9699a6] mb-1">Skill Gaps:</div>
                            <div className="flex flex-wrap gap-1">
                              {lowSkills.slice(0, 2).map((s, i) => (
                                <span key={i} className="inline-flex px-2 py-0.5 text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-700 truncate max-w-full">
                                  {s.skill} ({s.score * 10}%)
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>

              {/* Footer / Actions */}
              <div className="border-t border-gray-100 dark:border-[#4b4e69] pt-3 mt-2">
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-[#9699a6]">
                  <div>
                    By: <span className="font-medium text-gray-700 dark:text-[#d5d8df]">{candidate.uploaded_by || 'Unknown'}</span>
                  </div>
                  <IconButton
                    onClick={(e) => handleDeleteCandidate(candidate.id, candidate.name || 'Unnamed', e)}
                    disabled={deletingCandidateId === candidate.id}
                    loading={deletingCandidateId === candidate.id}
                    kind="tertiary"
                    color="negative"
                    size="xs"
                    icon={() => (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    )}
                    tooltipContent="Delete candidate"
                    className="text-gray-400 hover:text-red-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CandidateList;

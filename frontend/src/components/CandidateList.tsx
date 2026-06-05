import React, { useState } from 'react';
import { Candidate } from '../services/apiService';
import { IconButton } from '@vibe/core';
import '@vibe/core/tokens';
import UserAvatar from './common/UserAvatar';
import {
  candidateAnalysisCardClass,
  formatCandidateDate,
  getAnalysisProviderBadge,
  getScoreTone,
  getVerificationBadge,
  MetricRow,
  ScoreChip,
  StatusPill,
} from './candidate/candidateCardUtils';

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

const CandidateList: React.FC<CandidateListProps> = ({
  candidates,
  onCandidateSelect,
  onCandidateDeleted,
  sharepointFiles,
}) => {
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [collapsedCandidates, setCollapsedCandidates] = useState<Set<string>>(new Set());

  const toggleExpand = (candidateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const findSharePointFile = (filename: string): SharePointFile | null => {
    if (!sharepointFiles) return null;
    const allFiles = [...(sharepointFiles.job_files || []), ...(sharepointFiles.resume_files || [])];
    let file = allFiles.find((f) => f.name === filename);
    if (!file) file = allFiles.find((f) => f.name.toLowerCase() === filename.toLowerCase());
    if (!file) {
      const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      file = allFiles.find((f) => {
        const fNameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
        return fNameWithoutExt.toLowerCase() === filenameWithoutExt.toLowerCase();
      });
    }
    return file || null;
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  if (candidates.length === 0) {
    return (
      <div className="py-12 text-center">
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-ink">No candidates yet</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-ink-muted">
          Upload your first resume to get started with analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {candidates.map((candidate) => {
          const sharepointFile = findSharePointFile(candidate.resume_filename || '');
          const isImproved = (candidate.resume_filename || '').toLowerCase().includes('improved');
          const verification = getVerificationBadge(candidate);
          const providerBadge = getAnalysisProviderBadge(candidate);
          const isExpanded = !collapsedCandidates.has(candidate.id);
          const scoreTone = getScoreTone(candidate.overall_score);

          return (
            <div
              key={candidate.id}
              onClick={() => onCandidateSelect(candidate)}
              className={candidateAnalysisCardClass}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-ink" title={candidate.name}>
                    {candidate.name || 'Unnamed Candidate'}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-ink-muted">
                    {formatCandidateDate(sharepointFile?.created_datetime || candidate.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <ScoreChip score={candidate.overall_score} />
                  {providerBadge && (
                    <img
                      src={providerBadge.image}
                      alt={`Analyzed by ${providerBadge.label}`}
                      title={`Analyzed by ${providerBadge.label}`}
                      className={`${providerBadge.className} object-contain`}
                    />
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {isImproved && <StatusPill label="Improved" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" />}
                <StatusPill label={verification.label} className={verification.className} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                {sharepointFile ? (
                  <a
                    href={sharepointFile.web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 truncate text-xs text-brand hover:underline dark:text-brand-on-dark"
                    title={candidate.resume_filename}
                  >
                    {candidate.resume_filename}
                  </a>
                ) : (
                  <span className="truncate text-xs text-gray-500 dark:text-ink-muted" title={candidate.resume_filename}>
                    {candidate.resume_filename}
                  </span>
                )}
                <IconButton
                  onClick={(e) => toggleExpand(candidate.id, e)}
                  kind="tertiary"
                  size="xs"
                  icon={() => (
                    <svg
                      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  className="text-gray-400 dark:text-ink-muted"
                  tooltipContent={isExpanded ? 'Collapse' : 'Expand'}
                />
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-gray-100 dark:border-line pt-3">
                  {candidate.experience_match && (
                    <MetricRow
                      label="Experience"
                      value={`${candidate.experience_match.total_years} years`}
                    />
                  )}
                  {candidate.strengths && candidate.strengths.length > 0 && (
                    <MetricRow
                      label="Top strength"
                      value={
                        <span className="max-w-[10rem] truncate text-right text-xs" title={candidate.strengths[0].strength}>
                          {candidate.strengths[0].strength}
                        </span>
                      }
                      valueClassName={scoreTone.textClass}
                    />
                  )}
                  {candidate.weaknesses && candidate.weaknesses.length > 0 && (
                    <MetricRow
                      label="Top gap"
                      value={
                        <span className="max-w-[10rem] truncate text-right text-xs" title={candidate.weaknesses[0].weakness}>
                          {candidate.weaknesses[0].weakness}
                        </span>
                      }
                    />
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-line pt-3">
                <UserAvatar userId={candidate.uploaded_by} size="xs" />
                <IconButton
                  onClick={(e) => handleDeleteCandidate(candidate.id, candidate.name || 'Unnamed', e)}
                  disabled={deletingCandidateId === candidate.id}
                  loading={deletingCandidateId === candidate.id}
                  kind="tertiary"
                  color="negative"
                  size="xs"
                  icon={() => (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                  tooltipContent="Delete candidate"
                  className="text-gray-400 hover:text-red-500"
                />
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default CandidateList;

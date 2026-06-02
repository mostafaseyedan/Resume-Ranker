import React, { useState } from 'react';
import { Candidate } from '../services/apiService';
import { IconButton } from '@vibe/core';
import { Delete } from '@vibe/icons';
import '@vibe/core/tokens';
import {
  candidateAnalysisCardClass,
  formatCandidateDate,
  getScoreTone,
  MetricRow,
  ScoreChip,
  StatusPill,
} from './candidate/candidateCardUtils';

interface GroupedCandidate {
  name: string;
  resumes: Candidate[];
  resumeCount: number;
  bestScore: number;
  scoreImprovement: number | null;
  latestDate: string;
  bestCandidateId: string;
}

interface CandidatesGroupedListProps {
  candidates: Candidate[];
  onCandidateSelect: (candidates: Candidate[]) => void;
  onCandidateDeleted: (candidateId: string) => void;
}

const CandidatesGroupedList: React.FC<CandidatesGroupedListProps> = ({
  candidates,
  onCandidateSelect,
  onCandidateDeleted,
}) => {
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);

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

  const groupCandidatesByName = (): GroupedCandidate[] => {
    const grouped = new Map<string, Candidate[]>();
    const nameMapping = new Map<string, string>();

    const findMatchingGroup = (nameParts: string[]): string | null => {
      for (const [existingKey] of Array.from(grouped)) {
        const existingParts = existingKey.split('|');
        for (const newPart of nameParts) {
          for (const existingPart of existingParts) {
            if (newPart === existingPart) return existingKey;
          }
        }
      }
      return null;
    };

    candidates.forEach((candidate) => {
      const originalName = candidate.name || 'Unnamed Candidate';
      const normalizedName = originalName.toLowerCase().trim();
      const nameParts = normalizedName.split(/\s+/).filter((part) => part.length > 0);
      const matchingGroup = findMatchingGroup(nameParts);

      if (matchingGroup) {
        grouped.get(matchingGroup)!.push(candidate);
      } else {
        const groupKey = nameParts.join('|');
        grouped.set(groupKey, [candidate]);
        nameMapping.set(groupKey, originalName);
      }
    });

    const groupedCandidates: GroupedCandidate[] = [];

    grouped.forEach((resumes, normalizedName) => {
      const displayName = nameMapping.get(normalizedName) || normalizedName;
      let bestScore = 0;
      let bestCandidateId = '';

      resumes.forEach((r) => {
        const score = r.overall_score || 0;
        if (score >= bestScore) {
          bestScore = score;
          bestCandidateId = r.id;
        }
      });

      const improvedResumes = resumes.filter((r) =>
        (r.resume_filename || '').toLowerCase().includes('improved')
      );
      const nonImprovedResumes = resumes.filter(
        (r) => !(r.resume_filename || '').toLowerCase().includes('improved')
      );

      let scoreImprovement: number | null = null;
      if (improvedResumes.length > 0 && nonImprovedResumes.length > 0) {
        const lowestNonImproved = Math.min(...nonImprovedResumes.map((r) => r.overall_score || 0));
        const highestImproved = Math.max(...improvedResumes.map((r) => r.overall_score || 0));
        scoreImprovement = highestImproved - lowestNonImproved;
      }

      const latestDate =
        resumes
          .map((r) => r.created_at)
          .filter((date) => date)
          .sort()
          .reverse()[0] || '';

      groupedCandidates.push({
        name: displayName,
        resumes: resumes.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        resumeCount: resumes.length,
        bestScore,
        bestCandidateId,
        scoreImprovement,
        latestDate,
      });
    });

    return groupedCandidates.sort((a, b) => b.bestScore - a.bestScore);
  };

  const groupedCandidates = groupCandidatesByName();

  if (groupedCandidates.length === 0) {
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
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-ink-muted">Select a card to view all resume versions.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groupedCandidates.map((group) => {
          const bestTone = getScoreTone(group.bestScore);

          return (
            <div
              key={group.name}
              onClick={() => onCandidateSelect(group.resumes)}
              className={candidateAnalysisCardClass}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-ink" title={group.name}>
                    {group.name}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-ink-muted">
                    Latest {formatCandidateDate(group.latestDate)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {group.scoreImprovement !== null && group.scoreImprovement > 0 && (
                    <StatusPill
                      label={`+${group.scoreImprovement}`}
                      className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                    />
                  )}
                  <ScoreChip score={group.bestScore} label="Best" />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <MetricRow label="Resume versions" value={group.resumeCount} valueClassName={bestTone.textClass} />
              </div>

              <div className="mt-3 border-t border-gray-100 dark:border-line pt-3">
                <div className="mb-2 text-xs font-medium text-gray-500 dark:text-ink-muted">Resume history</div>
                <div className="space-y-1.5">
                  {group.resumes.map((resume) => {
                    const isImproved = (resume.resume_filename || '').toLowerCase().includes('improved');
                    const rowTone = getScoreTone(resume.overall_score);
                    return (
                      <div
                        key={resume.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs dark:bg-canvas"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${isImproved ? 'bg-green-500' : 'bg-gray-400'}`}
                          />
                          <span
                            className={`truncate ${isImproved ? 'font-medium text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-ink-muted'}`}
                          >
                            {isImproved ? 'Improved' : 'Original'}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-gray-400 dark:text-ink-faint">
                            {formatCandidateDate(resume.created_at)}
                          </span>
                          <span className={`font-semibold tabular-nums ${rowTone.textClass}`}>
                            {resume.overall_score ?? 0}%
                          </span>
                          <IconButton
                            onClick={(e) => handleDeleteCandidate(resume.id, resume.name || 'Unnamed', e)}
                            disabled={deletingCandidateId === resume.id}
                            loading={deletingCandidateId === resume.id}
                            kind="tertiary"
                            color="negative"
                            size="xs"
                            icon={Delete}
                            tooltipContent="Delete resume"
                            className="text-gray-400 hover:text-red-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CandidatesGroupedList;

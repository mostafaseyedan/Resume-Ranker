import React from 'react';
import { Candidate } from '../services/apiService';

interface GroupedCandidate {
  name: string;
  resumes: Candidate[];
  resumeCount: number;
  bestScore: number;
  scoreImprovement: number | null;
  latestDate: string;
}

interface CandidatesGroupedListProps {
  candidates: Candidate[];
  onCandidateSelect: (candidateName: string) => void;
}

const CandidatesGroupedList: React.FC<CandidatesGroupedListProps> = ({ candidates, onCandidateSelect }) => {
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const groupCandidatesByName = (): GroupedCandidate[] => {
    const grouped = new Map<string, Candidate[]>();
    const nameMapping = new Map<string, string>(); // Maps group key to original display name

    const findMatchingGroup = (nameParts: string[]): string | null => {
      for (const [existingKey] of grouped) {
        const existingParts = existingKey.split('|');
        // Check if any part of the new name matches any part of existing names
        for (const newPart of nameParts) {
          for (const existingPart of existingParts) {
            if (newPart === existingPart) {
              return existingKey;
            }
          }
        }
      }
      return null;
    };

    candidates.forEach(candidate => {
      const originalName = candidate.name || 'Unnamed Candidate';
      const normalizedName = originalName.toLowerCase().trim();
      const nameParts = normalizedName.split(/\s+/).filter(part => part.length > 0);

      // Find if this candidate matches any existing group
      const matchingGroup = findMatchingGroup(nameParts);

      if (matchingGroup) {
        // Add to existing group
        grouped.get(matchingGroup)!.push(candidate);
      } else {
        // Create new group with all name parts as key
        const groupKey = nameParts.join('|');
        grouped.set(groupKey, [candidate]);
        nameMapping.set(groupKey, originalName); // Use first occurrence as display name
      }
    });

    const groupedCandidates: GroupedCandidate[] = [];

    grouped.forEach((resumes, normalizedName) => {
      const displayName = nameMapping.get(normalizedName) || normalizedName;
      const bestScore = Math.max(...resumes.map(r => r.overall_score || 0));

      const improvedResumes = resumes.filter(r =>
        (r.resume_filename || '').toLowerCase().includes('improved')
      );
      const nonImprovedResumes = resumes.filter(r =>
        !(r.resume_filename || '').toLowerCase().includes('improved')
      );

      let scoreImprovement: number | null = null;
      if (improvedResumes.length > 0 && nonImprovedResumes.length > 0) {
        const lowestNonImproved = Math.min(...nonImprovedResumes.map(r => r.overall_score || 0));
        const highestImproved = Math.max(...improvedResumes.map(r => r.overall_score || 0));
        scoreImprovement = highestImproved - lowestNonImproved;
      }

      const latestDate = resumes
        .map(r => r.created_at)
        .filter(date => date)
        .sort()
        .reverse()[0] || '';

      groupedCandidates.push({
        name: displayName,
        resumes,
        resumeCount: resumes.length,
        bestScore,
        scoreImprovement,
        latestDate
      });
    });

    return groupedCandidates.sort((a, b) => b.bestScore - a.bestScore);
  };

  const groupedCandidates = groupCandidatesByName();

  if (groupedCandidates.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates yet</h3>
        <p className="text-gray-500">Upload your first resume to get started with powered candidate evaluation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Candidates ({groupedCandidates.length})
        </h3>
        <div className="text-xs text-gray-500">Select a candidate to view all resumes</div>
      </div>

      <div className="grid gap-4">
        {groupedCandidates.map((candidate) => (
          <div
            key={candidate.name}
            onClick={() => onCandidateSelect(candidate.name)}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <span>{candidate.name}</span>
                </h4>
                <div className="mt-1 flex items-center space-x-4">
                  <p className="text-sm text-gray-600">
                    {candidate.resumeCount} resume{candidate.resumeCount !== 1 ? 's' : ''}
                  </p>
                </div>
                {candidate.latestDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Latest: {new Date(candidate.latestDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="ml-4 flex items-start space-x-3">
                {candidate.scoreImprovement !== null && candidate.scoreImprovement > 0 && (
                  <div className="flex items-center h-16">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="px-2.5 py-1.5 text-sm font-semibold bg-green-100 text-green-800 rounded-lg">
                      +{candidate.scoreImprovement}
                    </span>
                  </div>
                )}
                <div className="text-center" title="Highest score across all resumes">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <div className={`text-2xl font-bold ${getScoreColor(candidate.bestScore).replace('bg-', 'text-').replace('-50', '-600').replace('-100', '-600')}`}>
                      {candidate.bestScore}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Best Score</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CandidatesGroupedList;

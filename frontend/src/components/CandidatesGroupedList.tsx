import React, { useState } from 'react';
import { Candidate } from '../services/apiService';

interface GroupedCandidate {
  name: string;
  resumes: Candidate[];
  resumeCount: number;
  bestScore: number;
  scoreImprovement: number | null;
  latestDate: string;
  bestCandidateId: string; // ID of the resume with best score to pull strengths from
}

interface CandidatesGroupedListProps {
  candidates: Candidate[];
  onCandidateSelect: (candidates: Candidate[]) => void;
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
      // Fix iteration for older TS targets
      for (const [existingKey] of Array.from(grouped)) {
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

      // Find best score and corresponding resume ID
      let bestScore = 0;
      let bestCandidateId = '';

      resumes.forEach(r => {
        const score = r.overall_score || 0;
        if (score >= bestScore) {
          bestScore = score;
          bestCandidateId = r.id;
        }
      });

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
        resumes: resumes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), // Sort resumes by date desc
        resumeCount: resumes.length,
        bestScore,
        bestCandidateId,
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
        <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">No candidates yet</h3>
        <p className="text-gray-500">Upload your first resume to get started with analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-normal text-gray-900">
          Candidates ({groupedCandidates.length})
        </h3>
        <div className="text-xs text-gray-500">Select a candidate to view all versions</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groupedCandidates.map((candidate) => {
          // Find the best resume object to display specific highlights if needed
          const bestResume = candidate.resumes.find(r => r.id === candidate.bestCandidateId);

          return (
            <div
              key={candidate.name}
              onClick={() => onCandidateSelect(candidate.resumes)}
              className="bg-white border border-gray-200 p-4 hover:bg-gray-50 hover:border-blue-400 cursor-pointer transition-all shadow-sm hover:shadow-md flex flex-col self-start"
            >
              {/* Header Info */}
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-semibold text-gray-900 text-base truncate" title={candidate.name}>
                      {candidate.name}
                    </h4>
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">
                        Latest: {new Date(candidate.latestDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-1">
                      {candidate.scoreImprovement !== null && candidate.scoreImprovement > 0 && (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 border border-green-100">
                          +{candidate.scoreImprovement}
                        </span>
                      )}
                      <div className={`px-2 py-1 text-sm font-bold ${getScoreColor(candidate.bestScore)}`}>
                        {candidate.bestScore}%
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">Best Match</span>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex-1">
                    <div className="flex justify-between items-center text-xs mr-2">
                      <span className="text-gray-500">Number of Resume files:</span>
                      <span className="text-gray-700 font-medium font-mono">
                        {candidate.resumeCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Always Visible History Section */}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">Resume History</div>
                  {candidate.resumes.map((resume) => {
                    const isImproved = (resume.resume_filename || '').toLowerCase().includes('improved');
                    return (
                      <div key={resume.id} className="flex justify-between items-center text-xs p-1.5 hover:bg-gray-50">
                        <div className="flex items-center space-x-2 truncate">
                          <div className={`w-1.5 h-1.5 rounded-full ${isImproved ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span className={`truncate ${isImproved ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                            {isImproved ? 'Improved Version' : 'Original Version'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-400">
                            {new Date(resume.created_at).toLocaleDateString()}
                          </span>
                          <span className={`font-semibold ${getScoreColor(resume.overall_score || 0).split(' ')[0]}`}>
                            {resume.overall_score || 0}%
                          </span>
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

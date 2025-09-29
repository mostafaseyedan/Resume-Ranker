import React, { useState } from 'react';
import { Candidate, apiService } from '../services/apiService';

interface CandidateListProps {
  candidates: Candidate[];
  onCandidateSelect: (candidate: Candidate) => void;
  onCandidateDeleted: (candidateId: string) => void;
}

const CandidateList: React.FC<CandidateListProps> = ({ candidates, onCandidateSelect, onCandidateDeleted }) => {
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent candidate selection when clicking delete

    if (!confirm(`Are you sure you want to delete ${candidateName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingCandidateId(candidateId);
    try {
      await apiService.deleteCandidate(candidateId);
      onCandidateDeleted(candidateId);
    } catch (error) {
      console.error('Failed to delete candidate:', error);
      alert('Failed to delete candidate. Please try again.');
    } finally {
      setDeletingCandidateId(null);
    }
  };

  if (candidates.length === 0) {
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
          Candidates ({candidates.length})
        </h3>
        <div className="text-sm text-gray-500">
          Ranked by compatibility score
        </div>
      </div>

      <div className="grid gap-4">
        {candidates.map((candidate, index) => (
          <div
            key={candidate.id}
            onClick={() => onCandidateSelect(candidate)}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <h4 className="text-lg font-semibold text-gray-900">{candidate.name}</h4>
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(candidate.overall_score || 0)}`}>
                    <span className="mr-1">{getScoreGrade(candidate.overall_score || 0)}</span>
                    {candidate.overall_score || 0}%
                  </div>
                </div>

                <div className="mt-1 space-y-1">
                  {candidate.email && (
                    <p className="text-sm text-gray-600"> {candidate.email}</p>
                  )}
                  {candidate.phone && (
                    <p className="text-sm text-gray-600"> {candidate.phone}</p>
                  )}
                  <p className="text-xs text-gray-500">
                     {candidate.resume_filename} • Uploaded: {new Date(candidate.created_at).toLocaleString()}
                  </p>
                </div>

                {candidate.summary && (
                  <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                    {candidate.summary}
                  </p>
                )}
              </div>

              <div className="ml-4 text-right">
                <div className="flex flex-col items-center space-y-2">
                  <button
                    onClick={(e) => handleDeleteCandidate(candidate.id, candidate.name, e)}
                    disabled={deletingCandidateId === candidate.id}
                    className="text-red-500 hover:text-red-700 p-1 rounded disabled:opacity-50"
                    title="Delete candidate"
                  >
                    {deletingCandidateId === candidate.id ? (
                      <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    )}
                  </button>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <div className={`text-2xl font-bold ${getScoreColor(candidate.overall_score || 0).replace('bg-', 'text-').replace('-50', '-600').replace('-100', '-600')}`}>
                      {candidate.overall_score || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick preview of strengths and weaknesses */}
            {candidate.strengths && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidate.strengths && candidate.strengths.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-green-700 mb-1">Top Strengths</div>
                    <div className="space-y-1">
                      {candidate.strengths.slice(0, 2).map((strength, idx) => (
                        <div key={idx} className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          {strength.strength}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {candidate.weaknesses && candidate.weaknesses.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-red-700 mb-1">Areas for Improvement</div>
                    <div className="space-y-1">
                      {candidate.weaknesses.slice(0, 2).map((weakness, idx) => (
                        <div key={idx} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          {weakness.weakness}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Click to view detailed analysis
              </div>
              <div className="text-xs text-blue-600">
                View Details →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CandidateList;
import React, { useState } from 'react';
import { Candidate, apiService } from '../services/apiService';
import RadialProgress from './RadialProgress';

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

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
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
        <div className="text-xs text-gray-500">Select a candidate to view full analysis</div>
      </div>

      <div className="grid gap-4">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            onClick={() => onCandidateSelect(candidate)}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <span>{candidate.name || 'Unnamed Candidate'}</span>
                  {(candidate.resume_filename || '').toLowerCase().includes('improved') && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Improved
                    </span>
                  )}
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  {(() => {
                    const filename = candidate.resume_filename || 'No filename provided';
                    const sharepointFile = findSharePointFile(filename);

                    if (sharepointFile) {
                      return (
                        <a
                          href={sharepointFile.web_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center space-x-1"
                        >
                          <span>{filename}</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                        </a>
                      );
                    }

                    return <span>{filename}</span>;
                  })()}
                </p>
                <p className="text-xs text-gray-500">
                  {(() => {
                    const isImproved = (candidate.resume_filename || '').toLowerCase().includes('improved');
                    const filename = candidate.resume_filename || '';
                    const sharepointFile = findSharePointFile(filename);

                    if (isImproved && sharepointFile?.created_datetime) {
                      // For improved resumes with SharePoint data, show "Generated" date using created date
                      return `Generated: ${new Date(sharepointFile.created_datetime).toLocaleDateString()}`;
                    } else if (sharepointFile?.modified_datetime) {
                      // For normal resumes with SharePoint data, show "Added" date using modified date
                      return `Added: ${new Date(sharepointFile.modified_datetime).toLocaleDateString()}`;
                    } else {
                      // Fallback to Firestore date if no SharePoint data available
                      return `Uploaded: ${candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : '—'}`;
                    }
                  })()}
                </p>
              </div>

              <div className="ml-4 flex items-center space-x-4">
                <RadialProgress score={candidate.overall_score || 0} size={64} />
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CandidateList;

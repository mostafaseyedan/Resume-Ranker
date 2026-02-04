import React, { useState, useMemo } from 'react';
import { Candidate } from '../services/apiService';
import { Label, Search } from '@vibe/core';
import { Dropdown } from '@vibe/core/next';
import '@vibe/core/tokens';

interface GroupedCandidate {
  name: string;
  candidates: Candidate[];
  bestScore: number;
  jobCount: number;
  jobTitles: string[];
  latestDate: string;
  verificationStatus: string | null;
  hasImproved: boolean;
}

interface CandidateSidebarProps {
  candidates: Candidate[];
  selectedCandidate: GroupedCandidate | null;
  onCandidateSelect: (candidate: GroupedCandidate) => void;
  loading?: boolean;
}

const CandidateSidebar: React.FC<CandidateSidebarProps> = ({
  candidates,
  selectedCandidate,
  onCandidateSelect,
  loading = false
}) => {
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const verificationOptions = [
    { value: 'all', label: 'All verification' },
    { value: 'verified', label: 'Verified' },
    { value: 'partially_verified', label: 'Partially verified' },
    { value: 'contradicted', label: 'Contradicted' },
    { value: 'limited_information', label: 'Limited information' },
    { value: 'no_information_found', label: 'No information found' },
    { value: 'inconclusive', label: 'Inconclusive' },
    { value: 'unverified', label: 'Unverified' },
    { value: 'pending', label: 'Pending' }
  ];

  // Group candidates by name
  const groupedCandidates = useMemo(() => {
    const grouped = new Map<string, Candidate[]>();
    const nameMapping = new Map<string, string>();

    const findMatchingGroup = (nameParts: string[]): string | null => {
      for (const [existingKey] of Array.from(grouped)) {
        const existingParts = existingKey.split('|');
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

      const matchingGroup = findMatchingGroup(nameParts);

      if (matchingGroup) {
        grouped.get(matchingGroup)!.push(candidate);
      } else {
        const groupKey = nameParts.join('|');
        grouped.set(groupKey, [candidate]);
        nameMapping.set(groupKey, originalName);
      }
    });

    const result: GroupedCandidate[] = [];

    grouped.forEach((candidateList, normalizedName) => {
      const displayName = nameMapping.get(normalizedName) || normalizedName;

      // Calculate best score
      const bestScore = Math.max(...candidateList.map(c => c.overall_score || 0));

      // Get unique jobs
      const jobIds = new Set<string>();
      const jobTitles: string[] = [];
      candidateList.forEach(c => {
        if (c.job_id && !jobIds.has(c.job_id)) {
          jobIds.add(c.job_id);
          if (c.job_title) {
            jobTitles.push(c.job_title);
          }
        }
      });

      // Get latest date
      const latestDate = candidateList
        .map(c => c.created_at)
        .filter(date => date)
        .sort()
        .reverse()[0] || '';

      // Get verification status (pick the strongest available)
      const statusRank: Record<string, number> = {
        verified: 7,
        partially_verified: 6,
        contradicted: 5,
        limited_information: 4,
        no_information_found: 3,
        inconclusive: 2,
        unverified: 2,
        unknown: 1
      };
      let verificationStatus: string | null = null;
      let bestRank = -1;
      for (const c of candidateList) {
        const status = (c.web_verification?.overall_verification_status || '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '_')
          .replace(/-/g, '_');
        if (!status) continue;
        const rank = statusRank[status] ?? 0;
        if (rank > bestRank) {
          bestRank = rank;
          verificationStatus = status;
        }
      }

      // Check if any resume is improved
      const hasImproved = candidateList.some(c =>
        (c.resume_filename || '').toLowerCase().includes('improved')
      );

      result.push({
        name: displayName,
        candidates: candidateList.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        bestScore,
        jobCount: jobIds.size,
        jobTitles,
        latestDate,
        verificationStatus,
        hasImproved
      });
    });

    return result.sort((a, b) => b.bestScore - a.bestScore);
  }, [candidates]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    let filtered = groupedCandidates;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.jobTitles.some(title => title.toLowerCase().includes(query))
      );
    }

    // Filter by verification
    if (verificationFilter !== 'all') {
      if (verificationFilter === 'pending') {
        filtered = filtered.filter(c =>
          !c.verificationStatus ||
          c.verificationStatus === 'unknown' ||
          c.verificationStatus === 'unverified' ||
          c.verificationStatus === 'inconclusive'
        );
      } else {
        filtered = filtered.filter(c => c.verificationStatus === verificationFilter);
      }
    }

    return filtered;
  }, [groupedCandidates, verificationFilter, searchQuery]);

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getVerificationBadge = (status: string | null): { label: string; color: string } => {
    switch (status) {
      case 'verified':
        return { label: 'Verified', color: Label.colors.POSITIVE };
      case 'partially_verified':
        return { label: 'Partially verified', color: Label.colors.WORKING_ORANGE };
      case 'contradicted':
        return { label: 'Contradicted', color: Label.colors.NEGATIVE };
      case 'limited_information':
        return { label: 'Limited info', color: Label.colors.AMERICAN_GRAY };
      case 'no_information_found':
        return { label: 'No info', color: Label.colors.AMERICAN_GRAY };
      case 'inconclusive':
        return { label: 'Inconclusive', color: Label.colors.WORKING_ORANGE };
      case 'unverified':
        return { label: 'Unverified', color: Label.colors.AMERICAN_GRAY };
      default:
        return { label: 'Pending', color: Label.colors.AMERICAN_GRAY };
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#30324e] shadow-sm border border-gray-200 dark:border-[#4b4e69]">
      {/* Header Section */}
      <div className="p-4 border-b dark:border-[#4b4e69]">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#d5d8df]">
          {/* Search */}
          <div className="w-[220px] shrink-0">
            <Search
              id="candidate-search"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(value: string) => setSearchQuery(value)}
              size="small"
              debounceRate={200}
            />
          </div>

          {/* Filters */}
          <Dropdown
            id="verification-filter"
            size="small"
            options={verificationOptions}
            value={verificationOptions.find(opt => opt.value === verificationFilter)}
            onChange={(option: { value: string; label: string } | null) =>
              setVerificationFilter(option?.value ?? 'all')
            }
            placeholder="All verification"
            className="min-w-[200px]"
          />
        </div>
      </div>

      {/* Candidates List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 dark:text-[#9699a6]">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p>Loading candidates...</p>
          </div>
        ) : groupedCandidates.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-[#9699a6]">
            <p>No candidates yet</p>
            <p className="text-sm">Upload resumes to jobs to see candidates here</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-[#9699a6]">
            <p className="text-sm">No candidates match the filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-[#4b4e69]">
            {filteredCandidates.map((candidate) => {
              const isSelected = selectedCandidate?.name === candidate.name;
              const badge = getVerificationBadge(candidate.verificationStatus);

              return (
                <div
                  key={candidate.name}
                  onClick={() => onCandidateSelect(candidate)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3a3d5c] transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-[#13377433] border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-[#d5d8df] truncate">{candidate.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {candidate.hasImproved && (
                          <Label
                            id={`improved-${candidate.name}`}
                            text="Improved"
                            size="small"
                            color="positive"
                          />
                        )}
                        <Label
                          id={`verification-${candidate.name}`}
                          text={badge.label}
                          size="small"
                          color={badge.color as any}
                        />
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-sm font-bold ${getScoreColor(candidate.bestScore)}`}>
                      {candidate.bestScore}%
                    </div>
                  </div>

                  {/* Job Info */}
                  <div className="mt-2 text-xs text-gray-500 dark:text-[#9699a6]">
                    <div className="flex justify-between items-center">
                      <span>
                        {candidate.jobCount} job{candidate.jobCount !== 1 ? 's' : ''}
                        {candidate.candidates.length > 1 && (
                          <span className="ml-1">
                            ({candidate.candidates.length} resumes)
                          </span>
                        )}
                      </span>
                      <span>{formatDate(candidate.latestDate)}</span>
                    </div>
                    {candidate.jobTitles.length > 0 && (
                      <div className="mt-1 truncate text-gray-400 dark:text-[#9699a6]">
                        {candidate.jobTitles.slice(0, 2).join(', ')}
                        {candidate.jobTitles.length > 2 && ` +${candidate.jobTitles.length - 2}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t dark:border-[#4b4e69] text-xs text-gray-500 dark:text-[#9699a6] text-center">
        {filteredCandidates.length} of {groupedCandidates.length} candidates
      </div>
    </div>
  );
};

export default CandidateSidebar;

import { Candidate } from '../services/apiService';

export interface GroupedCandidate {
  name: string;
  candidates: Candidate[];
  bestScore: number;
  jobCount: number;
  jobTitles: string[];
  latestDate: string;
  verificationStatus: string | null;
  hasImproved: boolean;
}

/** Group resume records by person (same logic as CandidateSidebar list). */
export function groupCandidatesByName(candidates: Candidate[]): GroupedCandidate[] {
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

  const result: GroupedCandidate[] = [];

  grouped.forEach((candidateList, normalizedName) => {
    const displayName = nameMapping.get(normalizedName) || normalizedName;

    const bestScore = Math.max(...candidateList.map((c) => c.overall_score || 0));

    const jobIds = new Set<string>();
    const jobTitles: string[] = [];
    candidateList.forEach((c) => {
      if (c.job_id && !jobIds.has(c.job_id)) {
        jobIds.add(c.job_id);
        if (c.job_title) {
          jobTitles.push(c.job_title);
        }
      }
    });

    const latestDate =
      candidateList
        .map((c) => c.created_at)
        .filter((date) => date)
        .sort()
        .reverse()[0] || '';

    const statusRank: Record<string, number> = {
      verified: 7,
      partially_verified: 6,
      contradicted: 5,
      limited_information: 4,
      no_information_found: 3,
      inconclusive: 2,
      unverified: 2,
      unknown: 1,
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

    const hasImproved = candidateList.some((c) =>
      (c.resume_filename || '').toLowerCase().includes('improved')
    );

    result.push({
      name: displayName,
      candidates: candidateList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      bestScore,
      jobCount: jobIds.size,
      jobTitles,
      latestDate,
      verificationStatus,
      hasImproved,
    });
  });

  return result.sort((a, b) => b.bestScore - a.bestScore);
}

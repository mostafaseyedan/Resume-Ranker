/** Activity log copy without the actor name (shown via UserAvatar instead). */

import { JOB_INFOGRAPHIC_VISUAL_THEMES } from '@/lib/jobInfographicThemes';

export interface ActivityDetails {
  job_title?: string;
  candidate_name?: string;
  template_used?: string;
  connection_status?: string;
  visual_theme?: string;
  [key: string]: unknown;
}

function visualThemeLabel(slug?: string): string | undefined {
  if (!slug) return undefined;
  return JOB_INFOGRAPHIC_VISUAL_THEMES.find((t) => t.value === slug)?.text ?? slug;
}

export function formatActivityMessage(action: string, details: ActivityDetails = {}): string {
  switch (action) {
    case 'login':
      return 'Logged in';
    case 'job_created':
      return `Created job '${details.job_title}'`;
    case 'candidate_analyzed':
      return `Analyzed candidate '${details.candidate_name}' for job '${details.job_title}'`;
    case 'resume_improved':
      return `Improved resume for '${details.candidate_name}' using template '${details.template_used}'`;
    case 'potential_candidates_search':
      return `Searched potential candidates for '${details.job_title}'`;
    case 'external_candidates_search':
      return `Searched external candidates for '${details.job_title}'`;
    case 'skill_search':
      return `Searched by skill for '${details.job_title}'`;
    case 'candidate_verified':
      return `Verified candidate '${details.candidate_name}'`;
    case 'job_deleted':
      return `Deleted job '${details.job_title}'`;
    case 'candidate_deleted':
      return `Deleted candidate '${details.candidate_name}'`;
    case 'external_candidate_reach_out':
      return `Reached out to '${details.candidate_name}' for '${details.job_title}'`;
    case 'conversation_reply':
      return `Sent a reply to '${details.candidate_name}' for '${details.job_title}'`;
    case 'followup_generated':
      return `Generated follow-up for '${details.candidate_name}'`;
    case 'connection_checked':
      return `Checked LinkedIn connection (${details.connection_status})`;
    case 'job_infographic_generated': {
      const title = details.job_title || 'job';
      const theme = visualThemeLabel(details.visual_theme);
      return theme
        ? `Generated hiring poster (${theme}) for '${title}'`
        : `Generated hiring poster for '${title}'`;
    }
    case 'job_infographic_deleted':
      return `Deleted a hiring poster for '${details.job_title || 'job'}'`;
    default:
      return `Performed: ${action}`;
  }
}

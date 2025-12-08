// RFP-related types
export interface RFPFile {
  id: string
  fileName: string
  isFolder: boolean
  createdAt: string
  monday_metadata?: {
    status?: string
    group?: string
    due_date?: string
    sharepoint_link?: string
    work_mode?: string
    employment_type?: string
    column_values?: Record<string, string>
  }
}

export interface SharePointFile {
  id: string
  fileName: string
  fileSize?: number
  modifiedAt?: string
  downloadUrl?: string
}

export interface RFPAnalysis {
  id: string
  rfpTitle: string
  submittedBy: string
  createdAt: string
  winProbability?: number
  status: 'completed' | 'not_pursuing' | 'archived'
  // ... other analysis fields
}

export interface GeneratedProposal {
  id: string
  proposalTitle: string
  proposalType: string
  submittedBy: string
  generatedDate: string
  status: string
}

// Monday.com status type
export type MondayStatus = 'Open' | 'Submitted' | 'Interviewing' | 'Not Pursuing' | 'Closed'

// Helper to get status badge color
export function getStatusBadgeColor(status: string): string {
  const normalizedStatus = status?.toLowerCase().replace(/_/g, ' ').trim()

  if (normalizedStatus?.includes('open')) return 'bg-blue-100 text-blue-800'
  if (normalizedStatus?.includes('submit')) return 'bg-green-100 text-green-800'
  if (normalizedStatus?.includes('interview')) return 'bg-pink-100 text-pink-800'
  if (normalizedStatus?.includes('not pursuing')) return 'bg-gray-100 text-gray-800'
  if (normalizedStatus?.includes('closed')) return 'bg-red-100 text-red-800'

  return 'bg-gray-100 text-gray-800'
}

import apiClient from './apiClient'

export interface VolumePoint {
  date: string
  label: string
  count: number
}

export interface AnalystActivityPoint {
  analyst: string
  count: number
}



// Enhanced item detail for report modal
export interface RfpItemDetail {
  id: string // Monday RFP ID for lookup
  title: string
  rfpType?: string
  rfpTypeColor?: string
  date?: string // The exact date when the status change occurred
  // Analysis counts for A, F, P badges
  rfpAnalyses?: number
  proposalReviews?: number
  foiaAnalyses?: number
}

// Grouped data point for the new chart format
export interface RfpAdditionGroupedPoint {
  date: string
  label: string
  new: number
  submitted: number
  notPursuing: number
  newItems?: string[]
  submittedItems?: string[]
  notPursuingItems?: string[]
  newItemsDetail?: RfpItemDetail[]
  submittedItemsDetail?: RfpItemDetail[]
  notPursuingItemsDetail?: RfpItemDetail[]
}


// Sankey chart data structure
export interface SankeyNode {
  name: string
  color?: string
}

export interface SankeyLink {
  source: number
  target: number
  value: number
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

const normalizeLabel = (value?: string | null): string => {
  if (!value) return ''
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// Safely read optional build-time env vars (Vite exposes only VITE_* keys)
const getEnvVar = (key: string): string | undefined => {
  try {
    return (import.meta as any)?.env?.[key]
  } catch {
    return undefined
  }
}

const SUBMITTED_SLUGS = new Set(['submitted rfps', 'submitted'])
const NOT_PURSUING_SLUGS = new Set(['not pursuing', 'not pursuing rfps', 'no pursuit'])
// Optional: configure known Monday group IDs for explicit matching
const SUBMITTED_GROUP_IDS = new Set<string>([
  'new_group10961', // Submitted RFPs
  getEnvVar('VITE_MONDAY_SUBMITTED_GROUP_ID') || '' // set via env if available
].filter(Boolean))
const NOT_PURSUING_GROUP_IDS = new Set<string>([
  'new_group6990', // Not Pursuing / FOIA
  getEnvVar('VITE_MONDAY_NOT_PURSUING_GROUP_ID') || '' // set via env if available
].filter(Boolean))

// Monday.com color name mappings (match sidebar rendering)
const MONDAY_COLOR_MAP: Record<string, string> = {
  'black': '#000000',
  'white': '#FFFFFF',
  'red': '#e2445c',
  'orange': '#fdab3d',
  'yellow': '#ffcb00',
  'green': '#00c875',
  'bright-green': '#9cd326',
  'aquamarine': '#00d647',
  'blue': '#579BFC',
  'dark-blue': '#0073ea',
  'purple': '#a25ddc',
  'pink': '#ff158a',
  'lipstick': '#ff5ac4',
  'dark-purple': '#784bd1',
  'indigo': '#6161FF',
  'cyan': '#66ccff',
  'done-green': '#00c875',
  'bright_green': '#9cd326',
  'dark-indigo': '#401694',
  'navy': '#1f76c2',
  'lavender': '#9aadff',
  'lilac': '#a1a1ff',
  'peach': '#ffadad',
  'done_green': '#00c875',
  'working_orange': '#fdab3d',
  'stuck_red': '#e2445c',
  'chili-blue': '#66ccff'
}

export interface RfpAnalyticsSummary {
  totalAnalyses: number
  averagePerDay: number
  uniqueAnalysts: number
  volumeSeries: VolumePoint[]
  topAnalysts: AnalystActivityPoint[]
  dateRange: {
    startDate: string
    endDate: string
  }
  busiestDay?: VolumePoint
  weekOverWeekChange?: number | null
  rfpAdditionsGrouped?: {
    '7days': RfpAdditionGroupedPoint[]
    '3months': RfpAdditionGroupedPoint[]
    '12months': RfpAdditionGroupedPoint[]
    'allTime': RfpAdditionGroupedPoint[]
  }
  rfpSankeyData?: SankeyData
  mostActiveRfp?: {
    rfpId: string
    rfpTitle?: string
    totalActivity: number
    counts: {
      analyses: number
      proposalReviews: number
      foiaAnalyses: number
      chatMessages: number
      updates: number
    }
  }
  mostActiveRfps?: Array<{
    rfpId: string
    rfpTitle?: string
    totalActivity: number
    counts: {
      analyses: number
      proposalReviews: number
      foiaAnalyses: number
      chatMessages: number
      updates: number
    }
  }>
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric'
})

const START_OF_DAY_FORMATTER = (date: Date) => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

const getDateKey = (date: Date) => date.toISOString().split('T')[0]

const parseAnalysisDate = (rawDate: unknown): Date | null => {
  if (!rawDate) return null

  if (typeof rawDate === 'string' || rawDate instanceof String) {
    const parsed = new Date(rawDate as string)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof rawDate === 'number') {
    const parsed = new Date(rawDate)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof rawDate === 'object') {
    const dateLike = rawDate as { seconds?: number; _seconds?: number; toDate?: () => Date }

    if (typeof dateLike.toDate === 'function') {
      const parsed = dateLike.toDate()
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const seconds = dateLike._seconds ?? dateLike.seconds
    if (typeof seconds === 'number') {
      const parsed = new Date(seconds * 1000)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }

  return null
}

const formatAnalystLabel = (value: string | null | undefined): string => {
  if (!value) return 'Unknown'
  const trimmed = value.trim()
  if (!trimmed) return 'Unknown'

  const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed
  const cleaned = withoutDomain.replace(/[_\.]+/g, ' ')
  const words = cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

  const label = words.join(' ').trim()
  return label || 'Unknown'
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry {
  data: RfpAnalyticsSummary
  timestamp: number
  expiresAt: number
}

/**
 * Check if cache exists and is still valid
 */
const getCachedAnalytics = async (): Promise<RfpAnalyticsSummary | null> => {
  try {
    const response = await apiClient.get('/cache/analytics/summary_30day_v2')
    if (!response.data) return null

    const entry = response.data as CacheEntry
    const now = Date.now()

    if (entry.expiresAt > now) {
      return entry.data
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Store analytics data in cache
 */
const setCachedAnalytics = async (data: RfpAnalyticsSummary): Promise<void> => {
  try {
    const now = Date.now()
    const cacheEntry: CacheEntry = {
      data,
      timestamp: now,
      expiresAt: now + CACHE_TTL_MS
    }
    await apiClient.post('/cache/analytics/summary_30day_v2', cacheEntry)
  } catch (error) {
    console.error('[Analytics Cache] Failed to cache analytics:', error)
  }
}



const isSubmitted = (status?: string | null, group?: string | null, groupId?: string | null): boolean => {
  if (groupId && SUBMITTED_GROUP_IDS.has(groupId)) return true
  const normalizedStatus = normalizeLabel(status)
  const normalizedGroup = normalizeLabel(group)
  return SUBMITTED_SLUGS.has(normalizedStatus) || SUBMITTED_SLUGS.has(normalizedGroup)
}

const isNotPursuing = (status?: string | null, group?: string | null, groupId?: string | null): boolean => {
  if (groupId && NOT_PURSUING_GROUP_IDS.has(groupId)) return true
  const normalizedStatus = normalizeLabel(status)
  const normalizedGroup = normalizeLabel(group)
  return NOT_PURSUING_SLUGS.has(normalizedStatus) || NOT_PURSUING_SLUGS.has(normalizedGroup)
}

const resolveMondayColor = (color?: string | null): string | undefined => {
  if (!color) return undefined
  const normalized = color.toLowerCase().replace(/_/g, '-')
  if (MONDAY_COLOR_MAP[normalized]) {
    return MONDAY_COLOR_MAP[normalized]
  }
  if (color.startsWith('#')) {
    return color
  }
  return undefined
}

/**
 * Build Sankey chart data showing RFP flow from creation to current status
 */
const buildRfpSankeyData = (
  rfpItems: Array<{ id: string; group?: string | null; groupId?: string | null; groupColor?: string | null; projectStatus?: string | null }>
): SankeyData => {
  // Count RFPs by their current group/status
  const groupCounts = new Map<string, { count: number; color?: string }>()

  rfpItems.forEach((item) => {
    // Determine the current group name
    let groupName = 'Unknown'

    if (item.group) {
      groupName = typeof item.group === 'string' ? item.group : (item.group as any).title || (item.group as any).name || 'Unknown'
    } else if (item.projectStatus) {
      groupName = item.projectStatus
    }

    // Normalize group name
    groupName = groupName.trim()
    const resolvedColor = resolveMondayColor(item.groupColor) || resolveMondayColor((item as any).group?.color)
    const existing = groupCounts.get(groupName) || { count: 0, color: resolvedColor }
    existing.count += 1
    if (!existing.color && resolvedColor) {
      existing.color = resolvedColor
    }
    groupCounts.set(groupName, existing)
  })

  // Build nodes: [0] = "Total RFPs", [1..n] = actual groups
  const nodes: SankeyNode[] = [{ name: 'Total RFPs' }]
  const links: SankeyLink[] = []

  // Sort groups by count (descending) for better visualization
  const sortedGroups = Array.from(groupCounts.entries())
    .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))

  sortedGroups.forEach(([groupName, data]) => {
    const targetIndex = nodes.length
    nodes.push({ name: groupName, color: data.color })
    links.push({
      source: 0, // Total RFPs
      target: targetIndex,
      value: data.count
    })
  })

  return { nodes, links }
}

/**
 * Build grouped RFP additions data for bar chart
 * Combines new, submitted, and not pursuing into a single dataset
 */
const buildRfpAdditionsGrouped = (
  rfpItems: Array<{ id: string; title?: string; name?: string; group?: string | null; groupId?: string | null; projectStatus?: string | null; createdAt?: string; rfpType?: string; rfpTypeColor?: string }>,
  startDate: Date,
  today: Date,
  activityLogs: Array<{ event: string; data: string; created_at: string }>,
  timeframe: '7days' | '3months' | '12months' | 'allTime',
  analysisCountsMap?: Map<string, { rfpAnalyses: number; proposalReviews: number; foiaAnalyses: number }>
): RfpAdditionGroupedPoint[] => {
  // Determine aggregation period based on timeframe
  const aggregationPeriod: 'day' | 'week' | 'month' = timeframe === '7days' ? 'day' : timeframe === '3months' ? 'week' : 'month'

  // Helper functions for period calculation
  const getDayStart = (date: Date): Date => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getMonthStart = (date: Date): Date => {
    const d = new Date(date)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getPeriodStart = (date: Date): Date => {
    switch (aggregationPeriod) {
      case 'day': return getDayStart(date)
      case 'week': return getWeekStart(date)
      case 'month': return getMonthStart(date)
    }
  }

  // Build move logs for submitted and not pursuing
  const submittedLogItems = new Map<string, { movedAt: string }>()
  const notPursuingLogItems = new Map<string, { movedAt: string }>()

  activityLogs.forEach((log) => {
    if (log.event === 'move_pulse_into_group') {
      try {
        const dataObj = JSON.parse(log.data)
        const destGroupId = dataObj.dest_group?.id || ''
        const destGroupTitle = dataObj.dest_group?.title || ''
        const pulseId = dataObj.pulse?.id || dataObj.pulse_id || ''

        if (pulseId) {
          const timestampMs = Math.round(parseInt(log.created_at) / 10000)
          const moveDate = new Date(timestampMs)

          const isSubmittedMove = SUBMITTED_GROUP_IDS.has(destGroupId) || destGroupTitle.toLowerCase().includes('submitted')
          const isNotPursuingMove = NOT_PURSUING_GROUP_IDS.has(destGroupId) ||
            destGroupTitle.toLowerCase().includes('not pursuing') ||
            destGroupTitle.toLowerCase().includes('foia')

          if (isSubmittedMove) {
            submittedLogItems.set(pulseId, { movedAt: moveDate.toISOString() })
          }
          if (isNotPursuingMove) {
            notPursuingLogItems.set(pulseId, { movedAt: moveDate.toISOString() })
          }
        }
      } catch {
        // ignore parse issues
      }
    }
  })

  // Initialize the data map
  const dataMap = new Map<string, RfpAdditionGroupedPoint>()
  const daysDiff = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  if (aggregationPeriod === 'day') {
    for (let dayOffset = 0; dayOffset <= daysDiff; dayOffset++) {
      const dayStart = new Date(startDate)
      dayStart.setDate(startDate.getDate() + dayOffset)
      dayStart.setHours(0, 0, 0, 0)
      const key = getDateKey(dayStart)
      const month = (dayStart.getMonth() + 1).toString().padStart(2, '0')
      const day = dayStart.getDate().toString().padStart(2, '0')
      dataMap.set(key, {
        date: key,
        label: `${month}/${day}`,
        new: 0,
        submitted: 0,
        notPursuing: 0,
        newItems: [],
        submittedItems: [],
        notPursuingItems: [],
        newItemsDetail: [],
        submittedItemsDetail: [],
        notPursuingItemsDetail: []
      })
    }
  } else if (aggregationPeriod === 'week') {
    const weeks = Math.ceil(daysDiff / 7)
    for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
      const weekStart = getWeekStart(new Date(startDate))
      weekStart.setDate(weekStart.getDate() + weekOffset * 7)
      const key = getDateKey(weekStart)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const startMonth = (weekStart.getMonth() + 1).toString().padStart(2, '0')
      const startDay = weekStart.getDate().toString().padStart(2, '0')
      const endMonth = (weekEnd.getMonth() + 1).toString().padStart(2, '0')
      const endDay = weekEnd.getDate().toString().padStart(2, '0')
      dataMap.set(key, {
        date: key,
        label: `${startMonth}/${startDay} - ${endMonth}/${endDay}`,
        new: 0,
        submitted: 0,
        notPursuing: 0,
        newItems: [],
        submittedItems: [],
        notPursuingItems: [],
        newItemsDetail: [],
        submittedItemsDetail: [],
        notPursuingItemsDetail: []
      })
    }
  } else {
    const current = getMonthStart(new Date(startDate))
    const end = getMonthStart(new Date(today))
    while (current <= end) {
      const key = getDateKey(current)
      const month = (current.getMonth() + 1).toString().padStart(2, '0')
      const year = current.getFullYear()
      dataMap.set(key, {
        date: key,
        label: `${month}/${year}`,
        new: 0,
        submitted: 0,
        notPursuing: 0,
        newItems: [],
        submittedItems: [],
        notPursuingItems: [],
        newItemsDetail: [],
        submittedItemsDetail: [],
        notPursuingItemsDetail: []
      })
      current.setMonth(current.getMonth() + 1)
    }
  }

  // Process each RFP item
  rfpItems.forEach((item) => {
    const itemCounts = analysisCountsMap?.get(String(item.id))

    // Handle NEW RFPs (by creation date)
    if (item.createdAt) {
      const parsedDate = parseAnalysisDate(item.createdAt)
      if (parsedDate) {
        const normalized = START_OF_DAY_FORMATTER(parsedDate)
        if (normalized >= startDate && normalized <= today) {
          const periodStart = getPeriodStart(normalized)
          const key = getDateKey(periodStart)
          const periodData = dataMap.get(key)
          if (periodData) {
            periodData.new += 1
            const itemName = item.title || item.name || 'Unknown Item'
            periodData.newItems?.push(itemName)
            const exactDate = parsedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
            periodData.newItemsDetail?.push({
              id: item.id,
              title: itemName,
              rfpType: item.rfpType,
              rfpTypeColor: item.rfpTypeColor,
              date: exactDate,
              rfpAnalyses: itemCounts?.rfpAnalyses || 0,
              proposalReviews: itemCounts?.proposalReviews || 0,
              foiaAnalyses: itemCounts?.foiaAnalyses || 0
            })
          }
        }
      }
    }

    // Handle SUBMITTED RFPs (by move date if available, otherwise check current status)
    const submittedLog = submittedLogItems.get(item.id)
    const isCurrentlySubmitted = isSubmitted(item.projectStatus, item.group, item.groupId)

    if (submittedLog || isCurrentlySubmitted) {
      const dateToUse = submittedLog?.movedAt || item.createdAt
      if (dateToUse) {
        const parsedDate = parseAnalysisDate(dateToUse)
        if (parsedDate) {
          const normalized = START_OF_DAY_FORMATTER(parsedDate)
          if (normalized >= startDate && normalized <= today) {
            const periodStart = getPeriodStart(normalized)
            const key = getDateKey(periodStart)
            const periodData = dataMap.get(key)
            if (periodData) {
              periodData.submitted += 1
              const itemName = item.title || item.name || 'Unknown Item'
              periodData.submittedItems?.push(itemName)
              const exactDate = parsedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
              periodData.submittedItemsDetail?.push({
                id: item.id,
                title: itemName,
                rfpType: item.rfpType,
                rfpTypeColor: item.rfpTypeColor,
                date: exactDate,
                rfpAnalyses: itemCounts?.rfpAnalyses || 0,
                proposalReviews: itemCounts?.proposalReviews || 0,
                foiaAnalyses: itemCounts?.foiaAnalyses || 0
              })
            }
          }
        }
      }
    }

    // Handle NOT PURSUING RFPs (by move date if available, otherwise check current status)
    const notPursuingLog = notPursuingLogItems.get(item.id)
    const isCurrentlyNotPursuing = isNotPursuing(item.projectStatus, item.group, item.groupId)

    if (notPursuingLog || isCurrentlyNotPursuing) {
      const dateToUse = notPursuingLog?.movedAt || item.createdAt
      if (dateToUse) {
        const parsedDate = parseAnalysisDate(dateToUse)
        if (parsedDate) {
          const normalized = START_OF_DAY_FORMATTER(parsedDate)
          if (normalized >= startDate && normalized <= today) {
            const periodStart = getPeriodStart(normalized)
            const key = getDateKey(periodStart)
            const periodData = dataMap.get(key)
            if (periodData) {
              periodData.notPursuing += 1
              const itemName = item.title || item.name || 'Unknown Item'
              periodData.notPursuingItems?.push(itemName)
              const exactDate = parsedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
              periodData.notPursuingItemsDetail?.push({
                id: item.id,
                title: itemName,
                rfpType: item.rfpType,
                rfpTypeColor: item.rfpTypeColor,
                date: exactDate,
                rfpAnalyses: itemCounts?.rfpAnalyses || 0,
                proposalReviews: itemCounts?.proposalReviews || 0,
                foiaAnalyses: itemCounts?.foiaAnalyses || 0
              })
            }
          }
        }
      }
    }
  })

  return Array.from(dataMap.values())
}


export const analyticsService = {

  /**
   * Force refresh by clearing cache and fetching fresh data
   */
  async clearCache(): Promise<void> {
    try {
      await apiClient.delete('/cache/analytics/summary_30day_v2')
    } catch (error) {
      console.error('[Analytics Cache] Failed to clear cache:', error)
    }
  },

  /**
   * Build an analytics snapshot from all user activities:
   * - RFP Analyses
   * - Proposal Reviews
   * - FOIA Analyses
   * - Chat Interactions
   */
  async getRfpAnalyticsSummary(days: number = 30, limit: number = 500, skipCache: boolean = false): Promise<RfpAnalyticsSummary> {
    try {
      // Check cache first (unless skipped)
      if (!skipCache) {
        const cachedData = await getCachedAnalytics()
        if (cachedData) {
          return cachedData
        }
      }

      // Calculate date range for server-side filtering
      const endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
      const filterStartDate = new Date(endDate)
      filterStartDate.setDate(endDate.getDate() - (days - 1))
      filterStartDate.setHours(0, 0, 0, 0)

      // Fetch all activity types in parallel with date filtering
      const [rfpResponse, reviewsResponse, foiaResponse, chatResponse, rfpItemsResponse, activityLogsResponse] = await Promise.all([
        apiClient.get('/rfp-analyses', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/analytics/all-proposal-reviews', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/analytics/all-foia-analyses', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/analytics/all-chat-sessions', {
          params: {
            limit,
            startDate: filterStartDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
        apiClient.get('/monday/rfp-items'),
        apiClient.get('/monday/activity-logs', {
          params: {
            limit: 50000,  // Increased limit to capture full year of activity
            startDate: new Date(new Date().setDate(new Date().getDate() - 365)).toISOString()  // Filter to last year
          }
        }).catch(err => {
          console.error('[Analytics] Failed to fetch activity logs:', err.response?.status, err.response?.data)
          return { data: { logs: [] } }  // Return empty logs on error
        })
      ])

      // Normalize all activities to a common format (capture rfp identifiers if present)
      const rfpAnalyses: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (rfpResponse.data?.analyses || []).map((item: any) => ({
        createdAt: item.createdAt,
        submittedBy: item.submittedBy,
        userEmail: item.userEmail,
        rfpId: item.rfpId ?? item.rfp_id ?? item.rfpID ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      const proposalReviews: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (reviewsResponse.data?.reviews || []).map((item: any) => ({
        createdAt: item.createdAt,
        submittedBy: item.reviewedBy,
        userEmail: item.reviewedBy,
        rfpId: item.rfpId ?? item.rfp_id ?? item.rfpID ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      const foiaAnalyses: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (foiaResponse.data?.analyses || []).map((item: any) => ({
        createdAt: item.createdAt,
        submittedBy: item.analyzedBy,
        userEmail: item.analyzedBy,
        rfpId: item.rfpId ?? item.rfp_id ?? item.rfpID ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      const chatSessions: Array<{
        createdAt?: unknown
        submittedBy?: string
        userEmail?: string
        rfpId?: string
        rfpTitle?: string
      }> = (chatResponse.data?.sessions || []).map((item: any) => ({
        createdAt: item.timestamp || item.createdAt,
        submittedBy: item.userId,
        userEmail: item.userId,
        rfpId: item.rfpId ?? item.rfp_id ?? item.analysisRfpId ?? item.itemId ?? item.item_id,
        rfpTitle: item.rfpTitle ?? item.rfp_title ?? item.title
      }))

      // Combine all activities
      const analyses = [...rfpAnalyses, ...proposalReviews, ...foiaAnalyses]
      const allActivities = [...analyses, ...chatSessions]

      const today = START_OF_DAY_FORMATTER(new Date())
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - (days - 1))

      const dayMap = new Map<string, number>()
      for (let offset = 0; offset < days; offset++) {
        const current = new Date(startDate)
        current.setDate(startDate.getDate() + offset)
        dayMap.set(getDateKey(current), 0)
      }

      const analystMap = new Map<string, number>()

      // Per-RFP activity aggregation
      type RfpActivity = {
        rfpId: string
        rfpTitle?: string
        analyses: number
        proposalReviews: number
        foiaAnalyses: number
        chatMessages: number
        updates: number
      }
      const rfpActivityMap = new Map<string, RfpActivity>()

      // Process analyses (RFP + Proposal Reviews + FOIA) for daily volume
      analyses.forEach((analysis) => {
        const createdAt = parseAnalysisDate(analysis.createdAt)
        if (!createdAt) {
          return
        }

        const normalized = START_OF_DAY_FORMATTER(createdAt)
        if (normalized < startDate || normalized > today) {
          return
        }

        const key = getDateKey(normalized)
        dayMap.set(key, (dayMap.get(key) || 0) + 1)

        // Track per-RFP analysis counts
        const rfpId = (analysis as any).rfpId
        if (rfpId) {
          const current: RfpActivity = rfpActivityMap.get(rfpId) || {
            rfpId,
            rfpTitle: (analysis as any).rfpTitle,
            analyses: 0,
            proposalReviews: 0,
            foiaAnalyses: 0,
            chatMessages: 0,
            updates: 0
          }
          current.analyses += 1
          if (!current.rfpTitle && (analysis as any).rfpTitle) current.rfpTitle = (analysis as any).rfpTitle
          rfpActivityMap.set(rfpId, current)
        }
      })

      // Process all activities (including chat) for analyst activity
      allActivities.forEach((activity) => {
        const createdAt = parseAnalysisDate(activity.createdAt)
        if (!createdAt) {
          return
        }

        const normalized = START_OF_DAY_FORMATTER(createdAt)
        if (normalized < startDate || normalized > today) {
          return
        }

        const analystKey = activity.submittedBy || activity.userEmail || 'Unknown'
        const currentCount = analystMap.get(analystKey) || 0
        analystMap.set(analystKey, currentCount + 1)

        // Track per-RFP counts for proposal reviews, FOIA, chat
        const rfpId = (activity as any).rfpId
        if (rfpId) {
          const current: RfpActivity = rfpActivityMap.get(rfpId) || {
            rfpId,
            rfpTitle: (activity as any).rfpTitle,
            analyses: 0,
            proposalReviews: 0,
            foiaAnalyses: 0,
            chatMessages: 0,
            updates: 0
          }
          if ((proposalReviews as any).includes(activity)) current.proposalReviews += 1
          else if ((foiaAnalyses as any).includes(activity)) current.foiaAnalyses += 1
          else if ((chatSessions as any).includes(activity)) current.chatMessages += 1
          if (!current.rfpTitle && (activity as any).rfpTitle) current.rfpTitle = (activity as any).rfpTitle
          rfpActivityMap.set(rfpId, current)
        }
      })

      const volumeSeries: VolumePoint[] = Array.from(dayMap.entries()).map(([date, count]) => {
        const labelDate = new Date(`${date}T00:00:00`)
        return {
          date,
          label: DATE_FORMATTER.format(labelDate),
          count
        }
      })

      const totalAnalyses = volumeSeries.reduce((sum, point) => sum + point.count, 0)
      let averagePerDay = days > 0 ? Number((totalAnalyses / days).toFixed(1)) : 0

      // Compute average per day based on all-time data if available (fallback to 30-day avg)
      try {
        const [rfpAll, reviewsAll, foiaAll] = await Promise.all([
          apiClient.get('/rfp-analyses'),
          apiClient.get('/analytics/all-proposal-reviews'),
          apiClient.get('/analytics/all-foia-analyses')
        ])

        const normalizeDates = (items: any[], field: string) =>
          items
            .map((x) => parseAnalysisDate(x[field]))
            .filter((d): d is Date => !!d)

        const rfpDates = normalizeDates(rfpAll.data?.analyses || [], 'createdAt')
        const reviewDates = normalizeDates(reviewsAll.data?.reviews || [], 'createdAt')
        const foiaDates = normalizeDates(foiaAll.data?.analyses || [], 'createdAt')
        const allDates = [...rfpDates, ...reviewDates, ...foiaDates]

        if (allDates.length) {
          const earliest = allDates.reduce((min, d) => (d < min ? d : min), allDates[0])
          const todayAll = START_OF_DAY_FORMATTER(new Date())
          const daysBetween = Math.max(1, Math.ceil((todayAll.getTime() - START_OF_DAY_FORMATTER(earliest).getTime()) / (1000 * 60 * 60 * 24)))

          const totalAll =
            (rfpAll.data?.analyses?.length || 0) +
            (reviewsAll.data?.reviews?.length || 0) +
            (foiaAll.data?.analyses?.length || 0)

          averagePerDay = Number((totalAll / daysBetween).toFixed(1))
        }
      } catch {
        // Ignore all-time fallback errors and keep 30-day average
      }

      let busiestDay: VolumePoint | undefined
      if (volumeSeries.length > 0) {
        const maxEntry = volumeSeries.reduce(
          (max, point) => (point.count > max.count ? point : max),
          volumeSeries[0]
        )
        busiestDay = maxEntry.count > 0 ? maxEntry : undefined
      }

      const topAnalysts: AnalystActivityPoint[] = Array.from(analystMap.entries())
        .map(([analyst, count]) => ({
          analyst: formatAnalystLabel(analyst),
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      const recentWeek = volumeSeries.slice(-7).reduce((sum, point) => sum + point.count, 0)
      const previousWeek = volumeSeries.slice(-14, -7).reduce((sum, point) => sum + point.count, 0)
      const weekOverWeekChange =
        previousWeek > 0 ? Number((((recentWeek - previousWeek) / previousWeek) * 100).toFixed(1)) : null

      // Try to map RFP IDs to official Monday item titles
      try {
        const rfpItemsResp = await apiClient.get('/monday/rfp-items')
        const items: Array<{ id: string; title: string }> = rfpItemsResp.data?.items || []
        const titleMap = new Map<string, string>(items.map((it) => [String(it.id), it.title]))
        rfpActivityMap.forEach((value, key) => {
          const mapped = titleMap.get(String(key))
          if (mapped) {
            value.rfpTitle = mapped
          }
        })
      } catch {
        // Ignore mapping errors
      }

      // Fetch Monday updates for top candidate RFPs by non-update activity
      const candidates = Array.from(rfpActivityMap.values())
        .sort((a, b) => (b.analyses + b.proposalReviews + b.foiaAnalyses + b.chatMessages) - (a.analyses + a.proposalReviews + a.foiaAnalyses + a.chatMessages))
        .slice(0, 10)

      await Promise.all(
        candidates.map(async (c) => {
          if (!c.rfpId) return
          try {
            const resp = await apiClient.get(`/monday/items/${c.rfpId}/updates`)
            const updates: Array<{ createdAt?: unknown }> = resp.data?.updates || []
            const countInRange = updates.reduce((acc, u) => {
              const d = parseAnalysisDate(u.createdAt)
              if (!d) return acc
              const normalized = START_OF_DAY_FORMATTER(d)
              if (normalized < startDate || normalized > today) return acc
              return acc + 1
            }, 0)
            const current = rfpActivityMap.get(c.rfpId)
            if (current) current.updates = countInRange
          } catch {
            // ignore failures
          }
        })
      )

      // Determine most active RFP
      let mostActive: RfpAnalyticsSummary['mostActiveRfp'] | undefined
      let mostActiveList: NonNullable<RfpAnalyticsSummary['mostActiveRfps']> | undefined
      if (rfpActivityMap.size > 0) {
        const ranked = Array.from(rfpActivityMap.values())
          .map((x) => ({
            rfpId: x.rfpId,
            rfpTitle: x.rfpTitle,
            totalActivity: x.analyses + x.proposalReviews + x.foiaAnalyses + x.chatMessages + x.updates,
            counts: {
              analyses: x.analyses,
              proposalReviews: x.proposalReviews,
              foiaAnalyses: x.foiaAnalyses,
              chatMessages: x.chatMessages,
              updates: x.updates
            }
          }))
          .sort((a, b) => b.totalActivity - a.totalActivity)
        if (ranked.length && ranked[0].totalActivity > 0) {
          mostActive = ranked[0]
          mostActiveList = ranked.slice(0, 3)
        }
      }

      // Build RFP data
      const rfpItems = (rfpItemsResponse.data?.items || []).map((item: any) => ({
        id: item.id,
        title: item.title || item.name || item.fileName,
        group: item.group,
        groupId: item.groupId || item.group?.id || null,
        groupColor: item.groupColor || item.group?.color || null,
        projectStatus: item.projectStatus || item.status || null,
        createdAt: item.createdAt,
        rfpType: item.rfpType || item.rfp_type || null,
        rfpTypeColor: item.rfpTypeColor || item.rfp_type_color || null
      }))

      // Build analysis counts map for A, F, P badges in report modal
      const analysisCountsMap = new Map<string, { rfpAnalyses: number; proposalReviews: number; foiaAnalyses: number }>()
      rfpItems.forEach((item: { id: string }) => {
        const rfpAnalysesCount = rfpAnalyses.filter(a => String(a.rfpId) === String(item.id)).length
        const proposalReviewsCount = proposalReviews.filter(r => String(r.rfpId) === String(item.id)).length
        const foiaAnalysesCount = foiaAnalyses.filter(f => String(f.rfpId) === String(item.id)).length
        if (rfpAnalysesCount > 0 || proposalReviewsCount > 0 || foiaAnalysesCount > 0) {
          analysisCountsMap.set(String(item.id), {
            rfpAnalyses: rfpAnalysesCount,
            proposalReviews: proposalReviewsCount,
            foiaAnalyses: foiaAnalysesCount
          })
        }
      })

      // Get activity logs for RFP grouping
      const activityLogs = activityLogsResponse.data?.logs || []

      // RFP Additions uses 1 year (365 days)
      const rfpAdditionsStartDate = new Date(today)
      rfpAdditionsStartDate.setDate(today.getDate() - 365)
      rfpAdditionsStartDate.setHours(0, 0, 0, 0)

      // Build grouped data for all timeframes
      // Find earliest RFP creation date for "all time" view
      const allRfpDates: Date[] = rfpItems
        .map((item: { createdAt?: string }) => parseAnalysisDate(item.createdAt))
        .filter((d: Date | null): d is Date => !!d)
      const earliestRfpDate = allRfpDates.length > 0
        ? allRfpDates.reduce((min: Date, d: Date) => (d < min ? d : min), allRfpDates[0])
        : rfpAdditionsStartDate

      const rfpAdditionsGrouped = {
        '7days': buildRfpAdditionsGrouped(rfpItems, new Date(new Date().setDate(today.getDate() - 7)), today, activityLogs, '7days', analysisCountsMap),
        '3months': buildRfpAdditionsGrouped(rfpItems, new Date(new Date().setDate(today.getDate() - 90)), today, activityLogs, '3months', analysisCountsMap),
        '12months': buildRfpAdditionsGrouped(rfpItems, rfpAdditionsStartDate, today, activityLogs, '12months', analysisCountsMap),
        'allTime': buildRfpAdditionsGrouped(rfpItems, earliestRfpDate, today, activityLogs, 'allTime', analysisCountsMap)
      }

      // Build Sankey data showing RFP flow
      const rfpSankeyData = buildRfpSankeyData(rfpItems)

      const result = {
        totalAnalyses,
        averagePerDay,
        uniqueAnalysts: analystMap.size,
        volumeSeries,
        topAnalysts,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: today.toISOString()
        },
        busiestDay,
        weekOverWeekChange,
        rfpAdditionsGrouped, // New grouped format
        rfpSankeyData, // Sankey flow visualization
        mostActiveRfp: mostActive,
        mostActiveRfps: mostActiveList
      }

      // Cache the result
      await setCachedAnalytics(result)

      return result
    } catch (error) {
      console.error('Failed to build analytics summary:', error)
      throw error
    }
  }
}

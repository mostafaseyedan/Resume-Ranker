import { useState, useMemo, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Label, Button, Dropdown, Search as SearchField } from '@vibe/core'
import '@vibe/core/tokens'
import { mondayService, type MondayRfpItem } from '@/services/mondayService'
import apiClient from '@/services/apiClient'

interface RFPListProps {
  selectedRfp: MondayRfpItem | null
  onRfpSelect: (rfp: MondayRfpItem) => void
  onShowAnalytics?: () => void
  onShowFoia?: () => void
  onRfpsLoaded?: (rfps: MondayRfpItem[]) => void
}

// Monday.com color name mappings (for hex colors)
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

// Map Monday.com var_name colors to Vibe Label colors
const MONDAY_TO_VIBE_COLOR_MAP: Record<string, string> = {
  // Green variants (done/success)
  'green-shadow': 'done-green',
  'grass-green': 'grass_green',
  'lime-green': 'saladish',

  // Orange/Yellow variants (working/in-progress)
  'orange': 'working_orange',
  'dark-orange': 'dark-orange',
  'yellow': 'egg_yolk',
  'mustered': 'tan',

  // Red variants (stuck/error)
  'red-shadow': 'stuck-red',
  'dark-red': 'dark-red',

  // Pink variants
  'dark-pink': 'sofia_pink',

  // Purple/Indigo variants
  'dark-purple': 'dark_purple',
  'dark_indigo': 'dark_indigo',

  // Blue variants
  'bright-blue': 'bright-blue',
  'blue-links': 'river',
  'sky': 'sky',
  'navy': 'navy',
  'australia': 'aquamarine',

  // Gray/Neutral variants
  'grey': 'american_gray',
  'trolley-grey': 'american_gray',
  'soft-black': 'blackish',
  'dark-grey': 'american_gray',
  'gray': 'american_gray',
  'wolf-gray': 'american_gray',
  'stone': 'american_gray',

  // Special colors
  'sunset': 'sunset',
  'sail': 'winter',
  'eden': 'teal'
}

// Monday.com brand colors
const MONDAY_COLORS = {
  PRIMARY: '#6161FF',        // Cornflower Blue
  GREEN: '#00c875',          // Success/Done
  ORANGE: '#fdab3d',         // Warning
  RED: '#e2445c',            // Error/Not Won
  BLUE: '#579BFC',           // Info
  PURPLE: '#a25ddc',         // Purple accent
  GRAY: '#C4C4C4'            // Hold/Inactive
} as const

// Helper function to count actual work done (analyses/reviews) for items in a group
const getItemTypeBreakdown = (
  items: MondayRfpItem[],
  analysisCounts: Record<string, { rfpAnalyses: number; proposalReviews: number; foiaAnalyses: number }>
): string => {
  let rfpAnalysesTotal = 0
  let proposalReviewsTotal = 0
  let foiaAnalysesTotal = 0

  // Sum up actual analyses/reviews for all RFPs in this group
  items.forEach((item) => {
    const counts = analysisCounts[item.id]
    if (counts) {
      rfpAnalysesTotal += counts.rfpAnalyses
      proposalReviewsTotal += counts.proposalReviews
      foiaAnalysesTotal += counts.foiaAnalyses
    }
  })

  // Format: "10 RFP Analyses / 5 Proposal Reviews / 1 FOIA Analysis"
  // Only show non-zero counts
  const parts: string[] = []

  if (rfpAnalysesTotal > 0) {
    parts.push(`${rfpAnalysesTotal} RFP Analys${rfpAnalysesTotal === 1 ? 'is' : 'es'}`)
  }
  if (proposalReviewsTotal > 0) {
    parts.push(`${proposalReviewsTotal} Proposal Review${proposalReviewsTotal === 1 ? '' : 's'}`)
  }
  if (foiaAnalysesTotal > 0) {
    parts.push(`${foiaAnalysesTotal} FOIA Analys${foiaAnalysesTotal === 1 ? 'is' : 'es'}`)
  }

  return parts.length > 0 ? parts.join(' / ') : 'No analyses yet'
}

const RFPList = ({ selectedRfp, onRfpSelect, onShowAnalytics, onShowFoia, onRfpsLoaded }: RFPListProps) => {
  const [rfps, setRfps] = useState<MondayRfpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  // Determine which groups should be collapsed by default
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // Per-group sort state for due date (asc/desc/null)
  const [groupSort, setGroupSort] = useState<Record<string, 'asc' | 'desc' | null>>({})

  // Store analysis counts per RFP
  const [analysisCounts, setAnalysisCounts] = useState<Record<string, {
    rfpAnalyses: number
    proposalReviews: number
    foiaAnalyses: number
  }>>({})

  // Get Monday.com group color - now uses color from Monday API
  const getGroupColor = useCallback((rfp: MondayRfpItem): string => {
    // Use color from Monday.com API if available
    if (rfp.groupColor) {
      // Convert Monday color name to hex code
      const hexColor = MONDAY_COLOR_MAP[rfp.groupColor.toLowerCase().replace(/_/g, '-')]
      if (hexColor) {
        return hexColor
      }
      // If it's already a hex color, return it
      if (rfp.groupColor.startsWith('#')) {
        return rfp.groupColor
      }
    }

    // Default: blue
    return MONDAY_COLORS.BLUE
  }, [])

  // Convert Monday.com var_name color to Vibe Label color
  const getVibeLabelColor = useCallback((mondayColor?: string | null): string => {
    if (!mondayColor) {
      console.warn('[getVibeLabelColor] No Monday color provided')
      return 'primary'
    }

    // Normalize the color name (handle both formats)
    const normalized = mondayColor.toLowerCase().replace(/_/g, '-')

    // Try to find in mapping
    const vibeColor = MONDAY_TO_VIBE_COLOR_MAP[normalized]
    if (vibeColor) {
      return vibeColor
    }

    // If color not found in mapping, log warning and use primary
    console.warn(`[getVibeLabelColor] Monday color "${mondayColor}" not found in mapping, using primary`)
    return 'primary'
  }, [])

  // Toggle single group collapse/expand
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  // Toggle all groups collapse/expand (Ctrl+G shortcut)
  const toggleAllGroups = useCallback(() => {
    if (collapsedGroups.size === 0) {
      // Collapse all - get all current group IDs from rfps
      const allGroupIds = new Set(rfps.map(rfp => rfp.groupId || 'ungrouped'))
      setCollapsedGroups(allGroupIds)
    } else {
      // Expand all
      setCollapsedGroups(new Set())
    }
  }, [collapsedGroups, rfps])

  // Fetch RFPs from Monday.com on mount
  useEffect(() => {
    loadRFPs()
  }, [])

  // Ctrl+G keyboard shortcut (Monday.com pattern)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        toggleAllGroups()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleAllGroups])



  // Fetch analysis data from Firestore (decoupled from Monday items)
  const fetchAnalysisData = async () => {
    try {
      // Fetch all analyses, proposal reviews, and FOIA analyses using analytics endpoints
      // Note: apiClient already has baseURL='/api', so we don't add /api prefix
      const [rfpAnalysesRes, proposalReviewsRes, foiaAnalysesRes] = await Promise.all([
        apiClient.get('/rfp-analyses', { params: { limit: 1000 } }),
        apiClient.get('/analytics/all-proposal-reviews', { params: { limit: 1000 } }),
        apiClient.get('/analytics/all-foia-analyses', { params: { limit: 1000 } })
      ])

      return {
        rfpAnalyses: rfpAnalysesRes.data?.analyses || [],
        proposalReviews: proposalReviewsRes.data?.reviews || [],
        foiaAnalyses: foiaAnalysesRes.data?.analyses || []
      }
    } catch (error) {
      console.error('Failed to load analysis data:', error)
      return { rfpAnalyses: [], proposalReviews: [], foiaAnalyses: [] }
    }
  }

  // Calculate analysis counts for each RFP item
  const calculateCounts = (
    items: MondayRfpItem[],
    data: { rfpAnalyses: any[]; proposalReviews: any[]; foiaAnalyses: any[] }
  ) => {
    const counts: Record<string, { rfpAnalyses: number; proposalReviews: number; foiaAnalyses: number }> = {}

    items.forEach((rfp) => {
      // Match by multiple possible ID fields (rfpId, mondayRfpId, mondayId)
      const matchesRfp = (item: any) =>
        item.rfpId === rfp.id ||
        item.rfpId === rfp.mondayId ||
        item.mondayRfpId === rfp.id ||
        item.mondayRfpId === rfp.mondayId ||
        item.mondayId === rfp.id ||
        item.mondayId === rfp.mondayId

      counts[rfp.id] = {
        rfpAnalyses: data.rfpAnalyses.filter(matchesRfp).length,
        proposalReviews: data.proposalReviews.filter(matchesRfp).length,
        foiaAnalyses: data.foiaAnalyses.filter(matchesRfp).length
      }
    })

    return counts
  }

  const loadRFPs = async () => {
    try {
      setLoading(true)

      // OPTIMIZATION: Start both requests in parallel
      const mondayPromise = mondayService.getRFPItems()
      const analysisPromise = fetchAnalysisData()

      // Wait for Monday data first (priority content)
      const items = await mondayPromise

      // Collapse all groups by default
      const allGroupIds = new Set(items.map(rfp => rfp.groupId || 'ungrouped'))
      setCollapsedGroups(allGroupIds)

      // Render list immediately - user sees data ASAP
      setRfps(items)
      setLoading(false)

      // Share loaded RFPs with parent for cross-component lookups
      onRfpsLoaded?.(items)

      // Process counts in background (non-blocking)
      const analysisData = await analysisPromise
      const computedCounts = calculateCounts(items, analysisData)
      setAnalysisCounts(computedCounts)

    } catch (error) {
      console.error('Failed to load RFPs:', error)
      toast.error('Failed to load RFPs from Monday.com')
      setLoading(false)
    }
  }

  // Get unique status options from all RFPs
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>()
    rfps.forEach((rfp) => {
      if (rfp.projectStatus) {
        statuses.add(rfp.projectStatus)
      }
    })
    statuses.add('Not Won')
    return Array.from(statuses).sort()
  }, [rfps])

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setStatusFilters(value ? [value] : [])
  }, [])

  const hasStatusFilters = statusFilters.length > 0
  const hasSearch = searchQuery.trim().length > 0
  const hasActiveFilters = hasStatusFilters || hasSearch

  // Filter RFPs based on search and status
  const filteredRfps = useMemo(() => {
    let filtered = rfps

    // Filter by selected statuses
    if (hasStatusFilters) {
      const statusSet = new Set(statusFilters)
      filtered = filtered.filter((rfp) => rfp.projectStatus && statusSet.has(rfp.projectStatus))
    }

    // Filter by search query
    if (hasSearch) {
      const query = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (rfp) =>
          rfp.title?.toLowerCase().includes(query) ||
          rfp.projectStatus?.toLowerCase().includes(query) ||
          rfp.group?.toLowerCase().includes(query)
      )
    }

    // Sort by date (newest first by default)
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0

      return dateB - dateA
    })

    return sorted
  }, [rfps, hasSearch, hasStatusFilters, searchQuery, statusFilters])

  // Group RFPs by groupId (for collapsible groups) - sorted by Monday board position
  const groupedRfps = useMemo(() => {
    const groups = new Map<string, { items: MondayRfpItem[]; groupId: string; groupTitle: string; groupPosition: number }>()

    // Collect all items into groups
    filteredRfps.forEach((rfp) => {
      const groupKey = rfp.groupId || 'ungrouped'
      const groupTitle = rfp.group || 'Other'
      const groupPosition = rfp.groupPosition ?? 999999 // Put ungrouped at end

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          items: [],
          groupId: groupKey,
          groupTitle,
          groupPosition
        })
      }
      groups.get(groupKey)!.items.push(rfp)
    })

    // Sort groups by Monday position (ascending = top to bottom order in Monday)
    const sortedGroups = new Map(
      Array.from(groups.entries()).sort((a, b) => {
        return a[1].groupPosition - b[1].groupPosition
      })
    )

    return sortedGroups
  }, [filteredRfps])

  const sortItemsByDue = (items: MondayRfpItem[], direction: 'asc' | 'desc') => {
    const factor = direction === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      const dateA = a.proposalDue ? new Date(a.proposalDue).getTime() : null
      const dateB = b.proposalDue ? new Date(b.proposalDue).getTime() : null

      const hasA = dateA !== null && !Number.isNaN(dateA)
      const hasB = dateB !== null && !Number.isNaN(dateB)

      if (!hasA && !hasB) return 0
      if (!hasA) return 1
      if (!hasB) return -1

      return (dateA! - dateB!) * factor
    })
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b dark:border-[#4b4e69]">
          <div className="text-sm font-medium text-gray-700 dark:text-[#d5d8df]">Loading RFPs...</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  const formatDate = (value?: string | null) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString()
  }

  const getDueInfo = (value?: string | null) => {
    if (!value) return { text: 'N/A', isSoon: false }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return { text: value, isSoon: false }

    const due = new Date(parsed)
    due.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { text: `${formatDate(value)} (past due)`, isSoon: true }
    }

    return {
      text: `${formatDate(value)} (${diffDays} day${diffDays === 1 ? '' : 's'})`,
      isSoon: diffDays < 15
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b dark:border-[#4b4e69]">
        {/* Controls in one row: Status, Search, Analytics, FOIA */}
        <div className="flex items-center gap-2">
          <Dropdown
            placeholder="All statuses"
            options={[
              { label: 'All statuses', value: '' },
              ...statusOptions.map(status => ({ label: status, value: status }))
            ]}
            value={statusFilters[0] ? { label: statusFilters[0], value: statusFilters[0] } : null}
            onChange={(option: any) => handleStatusChange({ target: { value: option?.value || '' } } as any)}
            size="small"
            className="w-40"
            clearable={false}
          />

          <div className="flex-1 min-w-0">
            <SearchField
              value={searchQuery}
              onChange={(value: string) => setSearchQuery(value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search titles..."
              size="small"
              showClearIcon={true}
              clearIconLabel="Clear search"
              inputAriaLabel="Search RFP titles"
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onShowFoia && (
              <Button
                onClick={onShowFoia}
                size="small"
                kind="primary"
                style={{ backgroundColor: MONDAY_COLORS.PURPLE, borderColor: MONDAY_COLORS.PURPLE }}
              >
                FOIAs
              </Button>
            )}
            {onShowAnalytics && (
              <Button
                onClick={onShowAnalytics}
                size="small"
                kind="primary"
              >
                Analytics
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* RFP List with Collapsible Groups (Monday.com card-based pattern) */}
      <div className="flex-1 overflow-y-scroll bg-gray-100 dark:bg-[#181b34] py-4">
        {filteredRfps.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-[#9699a6]">
            {hasActiveFilters ? (
              <p className="text-sm">No RFPs match the selected filters.</p>
            ) : (
              <>
                <div className="text-2xl mb-2"></div>
                <p>No RFPs yet</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(groupedRfps.entries()).map(([groupId, { items, groupTitle }]) => {
              const isCollapsed = collapsedGroups.has(groupId)
              // Get color from first item in group
              const groupColor = items.length > 0 ? getGroupColor(items[0]) : MONDAY_COLORS.BLUE
              const sortState = groupSort[groupId] || null
              const sortedItems = sortState ? sortItemsByDue(items, sortState) : items

              return (
                <div
                  key={groupId}
                  className={`shadow-sm overflow-hidden bg-white ${isCollapsed ? 'dark:bg-[#30324e]' : 'dark:bg-transparent'
                    }`}
                >
                  {/* Group Header (Monday.com layout: border | arrow | title) */}
                  <div
                    onClick={() => toggleGroup(groupId)}
                    className={`flex items-center gap-2 py-3 cursor-pointer transition-colors relative ${isCollapsed
                      ? 'bg-white dark:bg-[#30324e] hover:bg-gray-50 dark:hover:bg-[#3a3d5c]'
                      : 'bg-gray-50/70 dark:bg-[#252844] hover:bg-gray-100 dark:hover:bg-[#30324e]'
                      }`}
                  >
                    {/* Left Border (Monday.com style - only shown when collapsed) */}
                    {isCollapsed && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ backgroundColor: groupColor }}
                      />
                    )}

                    {/* Content (with left padding for border) */}
                    <div className="flex items-center gap-2 pl-4 pr-4 w-full">
                      {/* Expand/Collapse Chevron (Monday.com style) */}
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'
                          }`}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: groupColor }}
                      >
                        <polyline points="6,4 10,8 6,12" />
                      </svg>

                      {/* Group Title and Breakdown */}
                      <div className="flex-1 min-w-0">
                        {/* Group Title (color matches border, bigger font) */}
                        <h3
                          className="text-base font-semibold"
                          style={{ color: groupColor }}
                        >
                          {groupTitle}
                        </h3>

                        {/* Item Type Breakdown (Monday.com style: "11 items / 50 subitems") */}
                        <div className="text-sm text-gray-500 dark:text-[#9699a6] mt-0.5">
                          {getItemTypeBreakdown(items, analysisCounts)}
                        </div>
                      </div>

                      {/* Item Count Badge (always shown) */}
                      <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-[#3e4259] text-gray-700 dark:text-[#d5d8df]">
                        {items.length}
                      </span>
                    </div>
                  </div>

                  {/* Group Items (shown when expanded) */}
                  {!isCollapsed && (
                    <div className="border-t border-gray-100 dark:border-[#3e4259]">
                      {sortedItems.map((rfp, idx) => {
                        const dueInfo = getDueInfo(rfp.proposalDue)
                        return (
                          <div
                            key={rfp.id}
                            onClick={() => onRfpSelect(rfp)}
                            className={`relative p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3a3d5c] transition-all duration-150 border-b border-gray-100 dark:border-[#3e4259] last:border-b-0 ${selectedRfp?.id === rfp.id
                              ? 'bg-blue-50 dark:bg-[#13377433] border-r-4 border-r-[#6161FF]'
                              : 'bg-white dark:bg-[#30324e]'
                              }`}
                            style={{
                              borderLeft: `4px solid ${groupColor}`
                            }}
                          >
                            {idx === 0 && (
                              <SortControl
                                state={sortState}
                                onToggle={() => {
                                  setGroupSort((prev) => {
                                    const current = prev[groupId] || null
                                    const next = current === null ? 'asc' : current === 'asc' ? 'desc' : null
                                    return { ...prev, [groupId]: next }
                                  })
                                }}
                              />
                            )}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="text-[15px] font-normal text-gray-900 dark:text-[#d5d8df] whitespace-normal break-words pb-2" title={rfp.title ?? ''}>
                                  {rfp.title}
                                </h3>
                                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  {/* Created Date */}
                                  {rfp.createdAt && (
                                    <span>
                                      {new Date(rfp.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {/* Due Date */}
                                  {dueInfo.text && dueInfo.text !== 'N/A' && (
                                    <span className={dueInfo.isSoon ? 'text-red-600 dark:text-red-400' : ''}>
                                      {dueInfo.text}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Tags Section with Badges */}
                            <div className="mt-2 flex flex-wrap gap-1 items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {/* Project Status Badge */}
                                {rfp.projectStatus && rfp.projectStatusColor && (
                                  <Label
                                    id={`status-${rfp.id}`}
                                    text={rfp.projectStatus}
                                    size="small"
                                    color={getVibeLabelColor(rfp.projectStatusColor) as any}
                                  />
                                )}

                                {/* Req. Type Badge */}
                                {rfp.rfpType && rfp.rfpTypeColor && (
                                  <Label
                                    id={`type-${rfp.id}`}
                                    text={rfp.rfpType}
                                    size="small"
                                    color={getVibeLabelColor(rfp.rfpTypeColor) as any}
                                  />
                                )}
                              </div>

                              {/* Analysis/Proposal/FOIA badges - bottom right */}
                              <div className="flex items-center gap-1">
                                {analysisCounts[rfp.id]?.rfpAnalyses > 0 && (
                                  <Label
                                    id={`analysis-${rfp.id}`}
                                    text="A"
                                    size="small"
                                    color="bright-blue"
                                    className="!min-w-0"
                                  />
                                )}
                                {analysisCounts[rfp.id]?.proposalReviews > 0 && (
                                  <Label
                                    id={`proposal-${rfp.id}`}
                                    text="P"
                                    size="small"
                                    color="positive"
                                    className="!min-w-0"
                                  />
                                )}
                                {analysisCounts[rfp.id]?.foiaAnalyses > 0 && (
                                  <Label
                                    id={`foia-${rfp.id}`}
                                    text="F"
                                    size="small"
                                    color="purple"
                                    className="!min-w-0"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default RFPList
const SortControl = ({
  state,
  onToggle
}: {
  state: 'asc' | 'desc' | null
  onToggle: () => void
}) => {
  return (
    <div
      className="absolute right-4 top-0 -translate-y-1/2 z-20"
      title="Sort by due date"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={`
          relative flex flex-col items-center justify-center group
          w-5 h-5 rounded-full 
          ${state ? 'bg-primary' : 'bg-gray-100 dark:bg-[#3a3d5c]'}
          hover:bg-primary/90 active:bg-primary/95
          transition-all duration-200 ease-in-out
          shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-1
        `}
      >
        <div className="-mb-[1px]">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`transform transition-colors duration-200 ${state === 'asc'
              ? 'text-white'
              : 'text-gray-500 dark:text-[#b0b3c0] opacity-70 group-hover:text-white group-hover:opacity-100'
              }`}
          >
            <path d="M12 4l-10 10h20l-10-10z" />
          </svg>
        </div>
        <div className="-mt-[1px]">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`transform rotate-180 transition-colors duration-200 ${state === 'desc'
              ? 'text-white'
              : 'text-gray-500 dark:text-[#b0b3c0] opacity-70 group-hover:text-white group-hover:opacity-100'
              }`}
          >
            <path d="M12 4l-10 10h20l-10-10z" />
          </svg>
        </div>
      </button>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { ButtonGroup, Button, Label, Dropdown } from '@vibe/core'
import '@vibe/core/tokens'
import { toast } from 'sonner'
import {
  analyticsService,
  type AnalystActivityPoint,
  type RfpAdditionGroupedPoint,
  type SankeyData,
  type RfpAnalyticsSummary,
  type VolumePoint
} from '@/services/analyticsService'


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

  // Special colors
  'sunset': 'sunset',
  'sail': 'winter',
  'eden': 'teal'
}

const getVibeLabelColor = (mondayColor?: string | null): string => {
  if (!mondayColor) return 'primary'
  const normalized = mondayColor.toLowerCase().replace(/_/g, '-')
  return MONDAY_TO_VIBE_COLOR_MAP[normalized] || 'primary'
}


const SummaryStat = ({
  title,
  value,
  helper,
  trend,
  multiline,
  minHeight
}: {
  title: string
  value: string
  helper?: string
  trend?: number | null
  multiline?: boolean
  minHeight?: number
}) => {
  const trendColor = trend !== undefined && trend !== null ? (trend >= 0 ? 'text-green-600' : 'text-red-600') : ''
  const trendIconPath =
    trend !== undefined && trend !== null && trend < 0 ? 'M4 12h16M12 4l8 8-8 8' : 'M4 12h16M12 4l8 8-8 8'
  const trendRotation = trend !== undefined && trend !== null && trend < 0 ? 'rotate-90' : '-rotate-90'

  return (
    <div className="h-full rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-4 shadow-sm flex flex-col" style={minHeight ? { minHeight } : undefined}>
      <div className="text-sm font-medium text-gray-500 dark:text-[#9699a6]">{title}</div>
      <div className={`mt-2 flex items-start gap-3`}>
        <span className={`text-base font-semibold text-gray-900 dark:text-[#d5d8df] ${multiline ? 'whitespace-pre-line' : 'break-words'}`} title={value}>{value}</span>
        {trend !== undefined && trend !== null && (
          <span className={`inline-flex items-center text-xs ${trendColor}`} title={`${trend >= 0 ? '+' : ''}${trend}% vs prior week`}>
            <svg className={`mr-1 h-3 w-3 transform ${trendRotation}`} viewBox="0 0 24 24" fill="none">
              <path d={trendIconPath} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {`${trend >= 0 ? '+' : ''}${trend}% vs prior week`}
          </span>
        )}
        {helper && (
          <span
            className={`text-base text-gray-600 dark:text-[#d5d8df] ${multiline ? 'whitespace-pre-line' : 'break-words'}`}
            title={helper}
          >
            {helper}
          </span>
        )}
      </div>
    </div>
  )
}

const EmptyState = ({ message, height }: { message: string; height?: number }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-[#797e93] bg-gray-50 dark:bg-[#181b34] text-sm text-gray-500 dark:text-[#9699a6]"
    style={{ minHeight: height ?? 224 }}
  >
    {message}
  </div>
)

const VolumeChartCard = ({ data }: { data: VolumePoint[] }) => {
  const hasActivity = data.some((point) => point.count > 0)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const axisColor = isDark ? '#d5d8df' : '#64748b'
  const gridColor = isDark ? '#4b4e69' : '#E5E7EB'
  const tooltipBg = isDark ? '#292f4c' : '#ffffff'
  const tooltipBorder = isDark ? '#797e93' : '#E5E7EB'
  const tooltipText = isDark ? '#d5d8df' : '#111827'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Daily Analysis Volume</h3>
          <p className="text-sm text-gray-500 dark:text-[#9699a6]">Analyses generated per day (last 30 days)</p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke={gridColor} strokeDasharray="6 6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: isDark ? '#69a7ef' : '#93C5FD', strokeWidth: 1 }}
                contentStyle={{ borderRadius: 12, backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                formatter={(value: number) => [`${value} analyses`, 'Volume']}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No analyses were generated in the selected time window." />
        </div>
      )}
    </div>
  )
}

const AnalystsChartCard = ({ data }: { data: AnalystActivityPoint[] }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const axisColor = isDark ? '#d5d8df' : '#64748b'
  const gridColor = isDark ? '#4b4e69' : '#E5E7EB'
  const tooltipBg = isDark ? '#292f4c' : '#ffffff'
  const tooltipBorder = isDark ? '#797e93' : '#E5E7EB'
  const tooltipText = isDark ? '#d5d8df' : '#111827'
  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Analyst Activity</h3>
            <p className="text-sm text-gray-500 dark:text-[#9699a6]">Top contributors by analysis count (last 30 days)</p>
          </div>
        </div>
        <div className="mt-6">
          <EmptyState message="No analyst activity recorded during this period." />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">Analyst Activity</h3>
          <p className="text-sm text-gray-500 dark:text-[#9699a6]">Top contributors by analysis count (last 30 days)</p>
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke={gridColor} strokeDasharray="6 6" vertical={false} />
            <XAxis
              dataKey="analyst"
              tick={{ fontSize: 12, fill: axisColor }}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={60}
              tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 14)}…` : value)}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: axisColor }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.08)' }}
              contentStyle={{ borderRadius: 12, backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
              formatter={(value: number) => [`${value} analyses`, 'Completed']}
            />
            <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


const RfpFlowSankeyChart = ({ data }: { data: SankeyData }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  // Color mapping for different groups
  const getFallbackColor = (name: string) => {
    const nameLower = name.toLowerCase()
    if (nameLower.includes('submitted')) return '#10b981' // green
    if (nameLower.includes('not pursuing') || nameLower.includes('foia')) return '#ef4444' // red
    if (nameLower.includes('progress') || nameLower.includes('active')) return '#f59e0b' // amber
    if (nameLower.includes('new') || nameLower.includes('rfps') && !nameLower.includes('total')) return '#3b82f6' // blue
    if (nameLower.includes('awarded')) return '#10b981' // green
    if (nameLower.includes('archived') || nameLower.includes('not won')) return '#6b7280' // gray
    if (nameLower.includes('shortlist') || nameLower.includes('monitor')) return '#8b5cf6' // purple
    if (name === 'Total RFPs') return isDark ? '#6366f1' : '#818cf8' // indigo
    return '#a855f7' // purple for others
  }

  const getNodeColor = (node: { name: string; color?: string }) => {
    if (node.color) return node.color
    return getFallbackColor(node.name)
  }

  // Create color arrays for nodes and links
  const nodeColors = data.nodes.map(node => getNodeColor(node))
  const linkColors = data.links.map(link => {
    const targetNode = data.nodes[link.target]
    return targetNode ? getNodeColor(targetNode) : '#8b5cf6'
  })

  // Calculate total from link values (sum of all links from source node)
  // This represents the total RFPs flowing from "Total RFPs" to all groups
  const totalRfps = data.links.reduce((sum, link) => sum + link.value, 0)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">RFP Flow Overview</h3>
        <p className="text-sm text-gray-500 dark:text-[#9699a6]">Distribution of all RFPs by current status/group</p>
      </div>

      {data.nodes.length > 1 ? (
        <div className="mt-4" style={{ height: '700px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={data}
              nodePadding={35}
              nodeWidth={15}
              margin={{ top: 40, right: 250, bottom: 40, left: 200 }}
              iterations={32}
              node={(props: any) => {
                const { x, y, width, height, index, payload } = props
                const color = nodeColors[index] || '#8b5cf6'
                // Source node (index 0) label goes on the left, all others on the right
                const isSourceNode = index === 0
                // Calculate percentage (skip for source node)
                const percentage = !isSourceNode && totalRfps > 0
                  ? ((payload.value / totalRfps) * 100).toFixed(1)
                  : null

                return (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={0.9}
                      stroke={color}
                      strokeWidth={0}
                    />
                    <text
                      textAnchor={isSourceNode ? 'end' : 'start'}
                      x={isSourceNode ? x - 6 : x + width + 6}
                      y={y + height / 2}
                      fontSize="13"
                      fontWeight="500"
                      fill={isDark ? '#d5d8df' : '#374151'}
                      dominantBaseline="middle"
                    >
                      {payload.name}
                    </text>
                    <text
                      textAnchor={isSourceNode ? 'end' : 'start'}
                      x={isSourceNode ? x - 6 : x + width + 6}
                      y={y + height / 2 + 14}
                      fontSize="11"
                      fill={isDark ? '#9699a6' : '#6b7280'}
                      dominantBaseline="middle"
                    >
                      {payload.value} RFPs{percentage ? ` (${percentage}%)` : ''}
                    </text>
                  </g>
                )
              }}
              link={(props: any) => {
                const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index } = props
                const color = linkColors[index] || '#8b5cf6'

                return (
                  <path
                    d={`
                      M${sourceX},${sourceY}
                      C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
                    `}
                    fill="none"
                    stroke={color}
                    strokeWidth={linkWidth}
                    strokeOpacity={0.3}
                  />
                )
              }}
            />
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 py-12 text-center text-sm text-gray-500 dark:text-[#9699a6]">
          No RFP data available.
        </div>
      )}
    </div>
  )
}

type RfpStatusTimeframe = '7days' | '3months' | '12months' | 'allTime'
type ChartType = 'bar' | 'line'
type StatusKey = 'new' | 'submitted' | 'notPursuing'

const RfpStatusBreakdownChart = ({ groupedData, onRfpSelect, reportModalOpen, onReportModalChange }: { groupedData: { '7days': RfpAdditionGroupedPoint[]; '3months': RfpAdditionGroupedPoint[]; '12months': RfpAdditionGroupedPoint[]; 'allTime'?: RfpAdditionGroupedPoint[] }; onRfpSelect?: (rfpId: string) => void; reportModalOpen?: boolean; onReportModalChange?: (open: boolean) => void }) => {
  const [timeframe, setTimeframe] = useState<RfpStatusTimeframe>('3months')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [visibleStatuses, setVisibleStatuses] = useState<Set<StatusKey>>(new Set(['new', 'submitted', 'notPursuing']))
  // Use controlled state from parent if provided, otherwise use local state
  const [localShowReportModal, setLocalShowReportModal] = useState(false)
  const showReportModal = reportModalOpen ?? localShowReportModal
  const setShowReportModal = onReportModalChange ?? setLocalShowReportModal

  const handleRfpClick = (rfpId: string) => {
    if (onRfpSelect) {
      // Use Dashboard's cached RFP data (instant!)
      // Keep the report modal open so user can return to it after closing RFPDetail
      onRfpSelect(rfpId)
    } else {
      console.warn('[Analytics] onRfpSelect not provided - cannot open RFP detail')
    }
  }

  const data = groupedData?.[timeframe] || []
  const hasActivity = data.some((point) => point.new > 0 || point.submitted > 0 || point.notPursuing > 0)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  // Calculate metrics
  const totalNew = data.reduce((sum, point) => sum + point.new, 0)
  const totalSubmitted = data.reduce((sum, point) => sum + point.submitted, 0)
  const totalNotPursuing = data.reduce((sum, point) => sum + point.notPursuing, 0)
  const submissionRate = totalNew > 0 ? (totalSubmitted / totalNew) * 100 : 0
  const axisColor = isDark ? '#d5d8df' : '#64748b'
  const gridColor = isDark ? '#4b4e69' : '#E5E7EB'
  const tooltipBg = isDark ? '#292f4c' : '#ffffff'
  const tooltipBorder = isDark ? '#797e93' : '#E5E7EB'
  const tooltipText = isDark ? '#d5d8df' : '#111827'

  const toggleStatus = (status: StatusKey) => {
    setVisibleStatuses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(status)) {
        newSet.delete(status)
      } else {
        newSet.add(status)
      }
      return newSet
    })
  }

  const getSubtitle = () => {
    switch (timeframe) {
      case '7days':
        return 'Daily breakdown of new RFPs and their outcomes (last 7 days)'
      case '3months':
        return 'Weekly breakdown of new RFPs and their outcomes (last 3 months)'
      case '12months':
        return 'Monthly breakdown of new RFPs and their outcomes (last 12 months)'
      case 'allTime':
        return 'Monthly breakdown of new RFPs and their outcomes (all time)'
    }
  }

  return (
    <>
      {/* Report Modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="bg-white dark:bg-[#30324e] rounded-xl shadow-lg max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 dark:border-[#797e93] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-[#d5d8df]">
                    RFP Status Movement Report
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-[#9699a6] mt-1">
                    {timeframe === '7days' ? 'Last 7 Days' : timeframe === '3months' ? 'Last 3 Months' : timeframe === '12months' ? 'Last 12 Months' : 'All Time'}
                  </p>
                </div>
                {/* Interactive Legend - Same as chart */}
                <div className="flex items-center gap-3 text-xs">
                  <Button
                    onClick={() => toggleStatus('new')}
                    kind="tertiary"
                    size="small"
                    style={{ opacity: visibleStatuses.has('new') ? 1 : 0.4 }}
                  >
                    <div className="h-3 w-3 rounded mr-2" style={{ backgroundColor: '#3b82f6' }}></div>
                    New
                  </Button>
                  <Button
                    onClick={() => toggleStatus('submitted')}
                    kind="tertiary"
                    size="small"
                    style={{ opacity: visibleStatuses.has('submitted') ? 1 : 0.4 }}
                  >
                    <div className="h-3 w-3 rounded mr-2" style={{ backgroundColor: '#10b981' }}></div>
                    Submitted
                  </Button>
                  <Button
                    onClick={() => toggleStatus('notPursuing')}
                    kind="tertiary"
                    size="small"
                    style={{ opacity: visibleStatuses.has('notPursuing') ? 1 : 0.4 }}
                  >
                    <div className="h-3 w-3 rounded mr-2" style={{ backgroundColor: '#ef4444' }}></div>
                    Not Pursuing
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh]">
              {/* New RFPs Section */}
              {visibleStatuses.has('new') && data.some(p => p.newItemsDetail && p.newItemsDetail.length > 0) && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-blue-600 dark:text-blue-400 mb-3">
                    New RFPs ({data.reduce((sum, p) => sum + (p.newItemsDetail?.length || 0), 0)})
                  </h4>
                  <ul className="space-y-2">
                    {data.flatMap(point =>
                      (point.newItemsDetail || []).map((item, idx) => (
                        <li
                          key={`new-${point.label}-${idx}`}
                          className="text-sm text-gray-700 dark:text-[#d5d8df] py-2 px-3 bg-blue-50 dark:bg-[#181b34] rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-[#1f2347] transition-colors"
                          onClick={() => handleRfpClick(item.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="font-medium">{item.title}</span>
                              {item.rfpType && (
                                <Label
                                  text={item.rfpType}
                                  size="small"
                                  color={getVibeLabelColor(item.rfpTypeColor) as any}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* A, F, P badges */}
                              <div className="flex items-center gap-1">
                                {(item.rfpAnalyses ?? 0) > 0 && (
                                  <Label text="A" size="small" color="bright-blue" className="!min-w-0" />
                                )}
                                {(item.proposalReviews ?? 0) > 0 && (
                                  <Label text="P" size="small" color="positive" className="!min-w-0" />
                                )}
                                {(item.foiaAnalyses ?? 0) > 0 && (
                                  <Label text="F" size="small" color="purple" className="!min-w-0" />
                                )}
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {item.date || 'Added to Board'}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}

              {/* Submitted RFPs Section */}
              {visibleStatuses.has('submitted') && data.some(p => p.submittedItemsDetail && p.submittedItemsDetail.length > 0) && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-green-600 dark:text-green-400 mb-3">
                    Moved to Submitted ({data.reduce((sum, p) => sum + (p.submittedItemsDetail?.length || 0), 0)})
                  </h4>
                  <ul className="space-y-2">
                    {data.flatMap(point =>
                      (point.submittedItemsDetail || []).map((item, idx) => (
                        <li
                          key={`submitted-${point.label}-${idx}`}
                          className="text-sm text-gray-700 dark:text-[#d5d8df] py-2 px-3 bg-green-50 dark:bg-[#181b34] rounded cursor-pointer hover:bg-green-100 dark:hover:bg-[#1f2347] transition-colors"
                          onClick={() => handleRfpClick(item.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="font-medium">{item.title}</span>
                              {item.rfpType && (
                                <Label
                                  text={item.rfpType}
                                  size="small"
                                  color={getVibeLabelColor(item.rfpTypeColor) as any}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* A, F, P badges */}
                              <div className="flex items-center gap-1">
                                {(item.rfpAnalyses ?? 0) > 0 && (
                                  <Label text="A" size="small" color="bright-blue" className="!min-w-0" />
                                )}
                                {(item.proposalReviews ?? 0) > 0 && (
                                  <Label text="P" size="small" color="positive" className="!min-w-0" />
                                )}
                                {(item.foiaAnalyses ?? 0) > 0 && (
                                  <Label text="F" size="small" color="purple" className="!min-w-0" />
                                )}
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                {item.date || 'Moved to Submitted'}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}

              {/* Not Pursuing RFPs Section */}
              {visibleStatuses.has('notPursuing') && data.some(p => p.notPursuingItemsDetail && p.notPursuingItemsDetail.length > 0) && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-red-600 dark:text-red-400 mb-3">
                    Moved to Not Pursuing ({data.reduce((sum, p) => sum + (p.notPursuingItemsDetail?.length || 0), 0)})
                  </h4>
                  <ul className="space-y-2">
                    {data.flatMap(point =>
                      (point.notPursuingItemsDetail || []).map((item, idx) => (
                        <li
                          key={`not-pursuing-${point.label}-${idx}`}
                          className="text-sm text-gray-700 dark:text-[#d5d8df] py-2 px-3 bg-red-50 dark:bg-[#181b34] rounded cursor-pointer hover:bg-red-100 dark:hover:bg-[#1f2347] transition-colors"
                          onClick={() => handleRfpClick(item.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="font-medium">{item.title}</span>
                              {item.rfpType && (
                                <Label
                                  text={item.rfpType}
                                  size="small"
                                  color={getVibeLabelColor(item.rfpTypeColor) as any}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* A, F, P badges */}
                              <div className="flex items-center gap-1">
                                {(item.rfpAnalyses ?? 0) > 0 && (
                                  <Label text="A" size="small" color="bright-blue" className="!min-w-0" />
                                )}
                                {(item.proposalReviews ?? 0) > 0 && (
                                  <Label text="P" size="small" color="positive" className="!min-w-0" />
                                )}
                                {(item.foiaAnalyses ?? 0) > 0 && (
                                  <Label text="F" size="small" color="purple" className="!min-w-0" />
                                )}
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                {item.date || 'Moved to Not Pursuing'}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}

              {!data.some(p =>
                (p.newItems && p.newItems.length > 0) ||
                (p.submittedItems && p.submittedItems.length > 0) ||
                (p.notPursuingItems && p.notPursuingItems.length > 0)
              ) && (
                  <div className="text-center py-8 text-gray-500 dark:text-[#9699a6]">
                    No RFP movements in the selected timeframe.
                  </div>
                )}
            </div>
            <div className="border-t border-gray-200 dark:border-[#797e93] p-4 flex justify-end">
              <Button
                onClick={() => setShowReportModal(false)}
                kind="tertiary"
                size="small"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">RFP Status Breakdown</h3>
            <p className="text-sm text-gray-500 dark:text-[#9699a6]">{getSubtitle()}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="rfp-status-timeframe" className="text-gray-500 dark:text-[#9699a6]">
              Timeframe:
            </label>
            <Dropdown
              id="rfp-status-timeframe"
              value={timeframe ? { value: timeframe, label: timeframe === '7days' ? 'Last 7 Days' : timeframe === '3months' ? 'Last 3 Months' : timeframe === '12months' ? 'Last 12 Months' : 'All Time' } : null}
              onChange={(option: any) => setTimeframe(option?.value as RfpStatusTimeframe)}
              options={[
                { value: '7days', label: 'Last 7 Days' },
                { value: '3months', label: 'Last 3 Months' },
                { value: '12months', label: 'Last 12 Months' },
                { value: 'allTime', label: 'All Time' }
              ]}
              size="small"
              className="w-40"
              clearable={false}
            />
          </div>
        </div>

        {/* Summary Stats Cards */}
        <div className="flex flex-wrap justify-center gap-6 mb-6">
          {/* Total Added */}
          <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-blue-50/50 dark:bg-blue-900/10 px-4 py-3">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Total Added</div>
            <div className="text-base font-bold text-blue-700 dark:text-blue-400 mb-1">
              {totalNew.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9699a6]">New RFPs this period</div>
          </div>

          {/* Total Submitted */}
          <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-green-50/50 dark:bg-green-900/10 px-4 py-3">
            <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Total Submitted</div>
            <div className="text-base font-bold text-green-700 dark:text-green-400 mb-1">
              {totalSubmitted.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9699a6]">RFPs pursued</div>
          </div>

          {/* Total Not Pursued */}
          <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-red-50/50 dark:bg-red-900/10 px-4 py-3">
            <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Total Not Pursued</div>
            <div className="text-base font-bold text-red-700 dark:text-red-400 mb-1">
              {totalNotPursuing.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9699a6]">RFPs declined</div>
          </div>

          {/* Submission Rate */}
          <div className="rounded-xl border border-gray-200 dark:border-[#797e93] bg-gray-50/50 dark:bg-gray-800/20 px-4 py-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Submission Rate</div>
            <div className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">
              {submissionRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9699a6]">{totalSubmitted}/{totalNew} added</div>
          </div>
        </div>

        {hasActivity ? (
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={data}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="6 6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    shared={false}
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length > 0) {
                        // Get the specific bar being hovered
                        const hoveredBar = payload[0]
                        const point = hoveredBar.payload as RfpAdditionGroupedPoint
                        const dataKey = hoveredBar.dataKey as StatusKey

                        // Map dataKey to display info
                        const statusInfo: Record<StatusKey, { label: string; color: string; count: number; items?: string[] }> = {
                          new: { label: 'New RFPs', color: '#3b82f6', count: point.new, items: point.newItems },
                          submitted: { label: 'Submitted', color: '#10b981', count: point.submitted, items: point.submittedItems },
                          notPursuing: { label: 'Not Pursuing', color: '#ef4444', count: point.notPursuing, items: point.notPursuingItems }
                        }

                        const info = statusInfo[dataKey]
                        if (!info) return null

                        return (
                          <div
                            style={{
                              borderRadius: 12,
                              backgroundColor: tooltipBg,
                              borderColor: tooltipBorder,
                              border: `1px solid ${tooltipBorder}`,
                              color: tooltipText,
                              padding: '12px',
                              maxWidth: 500
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                              {label}
                            </div>
                            <div style={{ color: info.color, marginBottom: '8px' }}>
                              <strong>{info.count}</strong> {info.label}
                            </div>
                            {info.items && info.items.length > 0 && (
                              <div style={{ paddingTop: '8px', borderTop: `1px solid ${tooltipBorder}` }}>
                                <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{info.label}:</div>
                                <ul style={{ fontSize: '11px', margin: 0, paddingLeft: '16px', listStyleType: 'disc', maxHeight: '100px', overflowY: 'auto' }}>
                                  {info.items.slice(0, 5).map((item, idx) => (
                                    <li key={idx} style={{ marginBottom: '2px' }}>{item}</li>
                                  ))}
                                  {info.items.length > 5 && <li>+{info.items.length - 5} more...</li>}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  {visibleStatuses.has('new') && <Bar dataKey="new" fill="#3b82f6" name="New" radius={[4, 4, 0, 0]} />}
                  {visibleStatuses.has('submitted') && <Bar dataKey="submitted" fill="#10b981" name="Submitted" radius={[4, 4, 0, 0]} />}
                  {visibleStatuses.has('notPursuing') && <Bar dataKey="notPursuing" fill="#ef4444" name="Not Pursuing" radius={[4, 4, 0, 0]} />}
                </BarChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="6 6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    shared={false}
                    cursor={{ stroke: isDark ? '#69a7ef' : '#93C5FD', strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length > 0) {
                        // Get the specific line being hovered
                        const hoveredLine = payload[0]
                        const point = hoveredLine.payload as RfpAdditionGroupedPoint
                        const dataKey = hoveredLine.dataKey as StatusKey

                        // Map dataKey to display info
                        const statusInfo: Record<StatusKey, { label: string; color: string; count: number; items?: string[] }> = {
                          new: { label: 'New RFPs', color: '#3b82f6', count: point.new, items: point.newItems },
                          submitted: { label: 'Submitted', color: '#10b981', count: point.submitted, items: point.submittedItems },
                          notPursuing: { label: 'Not Pursuing', color: '#ef4444', count: point.notPursuing, items: point.notPursuingItems }
                        }

                        const info = statusInfo[dataKey]
                        if (!info) return null

                        return (
                          <div
                            style={{
                              borderRadius: 12,
                              backgroundColor: tooltipBg,
                              borderColor: tooltipBorder,
                              border: `1px solid ${tooltipBorder}`,
                              color: tooltipText,
                              padding: '12px',
                              maxWidth: 500
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                              {label}
                            </div>
                            <div style={{ color: info.color, marginBottom: '8px' }}>
                              <strong>{info.count}</strong> {info.label}
                            </div>
                            {info.items && info.items.length > 0 && (
                              <div style={{ paddingTop: '8px', borderTop: `1px solid ${tooltipBorder}` }}>
                                <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{info.label}:</div>
                                <ul style={{ fontSize: '11px', margin: 0, paddingLeft: '16px', listStyleType: 'disc', maxHeight: '100px', overflowY: 'auto' }}>
                                  {info.items.slice(0, 5).map((item, idx) => (
                                    <li key={idx} style={{ marginBottom: '2px' }}>{item}</li>
                                  ))}
                                  {info.items.length > 5 && <li>+{info.items.length - 5} more...</li>}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  {visibleStatuses.has('new') && <Line type="monotone" dataKey="new" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="New" />}
                  {visibleStatuses.has('submitted') && <Line type="monotone" dataKey="submitted" stroke="#10b981" strokeWidth={2.5} dot={false} name="Submitted" />}
                  {visibleStatuses.has('notPursuing') && <Line type="monotone" dataKey="notPursuing" stroke="#ef4444" strokeWidth={2.5} dot={false} name="Not Pursuing" />}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-6 py-12 text-center text-sm text-gray-500 dark:text-[#9699a6]">
            No RFP activity in the selected timeframe.
          </div>
        )}

        {/* Legend and Chart Type Toggle */}
        <div className="mt-4 flex items-center justify-between">
          {/* Chart Type Toggle and Report Button */}
          <div className="flex items-center gap-2">
            <ButtonGroup
              value={chartType === 'bar' ? 0 : 1}
              onSelect={(value) => setChartType(value === 0 ? 'bar' : 'line')}
              options={[
                { value: 0, text: 'Bar Chart' },
                { value: 1, text: 'Line Chart' }
              ]}
              size="xs"
              groupAriaLabel="Chart type selection"
            />
            <Button
              onClick={() => setShowReportModal(true)}
              kind="tertiary"
              size="xs"
            >
              Report
            </Button>
          </div>

          {/* Interactive Legend */}
          <div className="flex items-center gap-6 text-xs">
            <Button
              onClick={() => toggleStatus('new')}
              kind="tertiary"
              size="small"
              style={{ opacity: visibleStatuses.has('new') ? 1 : 0.4 }}
            >
              <div className="h-3 w-3 rounded mr-2" style={{ backgroundColor: '#3b82f6' }}></div>
              New
            </Button>
            <Button
              onClick={() => toggleStatus('submitted')}
              kind="tertiary"
              size="small"
              style={{ opacity: visibleStatuses.has('submitted') ? 1 : 0.4 }}
            >
              <div className="h-3 w-3 rounded mr-2" style={{ backgroundColor: '#10b981' }}></div>
              Submitted
            </Button>
            <Button
              onClick={() => toggleStatus('notPursuing')}
              kind="tertiary"
              size="small"
              style={{ opacity: visibleStatuses.has('notPursuing') ? 1 : 0.4 }}
            >
              <div className="h-3 w-3 rounded mr-2" style={{ backgroundColor: '#ef4444' }}></div>
              Not Pursuing
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}


interface AnalyticsDashboardProps {
  onRfpSelect?: (rfpId: string) => void
  reportModalOpen?: boolean
  onReportModalChange?: (open: boolean) => void
}

const AnalyticsDashboard = ({ onRfpSelect, reportModalOpen, onReportModalChange }: AnalyticsDashboardProps) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<RfpAnalyticsSummary | null>(null)

  const loadAnalytics = useCallback(async (skipCache = false) => {
    setLoading(true)
    setError(null)

    try {
      const summaryData = await analyticsService.getRfpAnalyticsSummary(30, 500, skipCache)
      setSummary(summaryData)
    } catch (err) {
      console.error('[AnalyticsDashboard] Failed to load analytics:', err)
      toast.error('Unable to load analytics data right now. Please try again.')
      setError('Unable to load analytics data right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const computed = useMemo(() => {
    if (!summary) return null

    const totalValue = summary.totalAnalyses > 0 ? summary.totalAnalyses.toString() : '0'
    const averageValue = Number.isFinite(summary.averagePerDay)
      ? summary.averagePerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : '0'
    const busiestValue = summary.busiestDay ? summary.busiestDay.count.toString() : '—'
    const busiestHelper = summary.busiestDay ? summary.busiestDay.label : 'No standout day'

    const top3Lines = summary.mostActiveRfps && summary.mostActiveRfps.length > 0
      ? summary.mostActiveRfps.map((x, idx) => `${idx + 1}. ${x.rfpTitle || x.rfpId}`).join('\n')
      : '—'

    return { totalValue, averageValue, busiestValue, busiestHelper, top3Lines }
  }, [summary])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e]">
        <div className="flex items-center gap-3 text-gray-600 dark:text-[#9699a6]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span>Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700">
        <div className="text-lg font-semibold">Analytics unavailable</div>
        <p className="mt-2 text-sm">{error}</p>
        <Button
          onClick={() => loadAnalytics()}
          kind="secondary"
          size="small"
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Top performers summary */}
        <div className="sm:col-span-2 xl:col-span-2 h-full">
          <SummaryStat title="Top 3 Most Worked on RFPs" value={computed?.top3Lines || '—'} multiline />
        </div>

        {/* Key metrics grouped to match chart width */}
        <div className="sm:col-span-2 xl:col-span-2 h-full">
          <div className="grid h-full gap-4 sm:grid-cols-3">
            <div className="h-full">
              <SummaryStat title="Analyses (30 days)" value={computed?.totalValue || '0'} />
            </div>
            <div className="h-full">
              <SummaryStat title="Average per day" value={computed?.averageValue || '0'} trend={summary?.weekOverWeekChange ?? null} />
            </div>
            <div className="h-full">
              <SummaryStat title="Busiest day" value={computed?.busiestValue || '—'} helper={computed?.busiestHelper || ''} />
            </div>
          </div>
        </div>
      </div>

      {/* Full Width RFP Status Breakdown Chart - First chart after cards */}
      {summary.rfpAdditionsGrouped && (
        <RfpStatusBreakdownChart
          groupedData={summary.rfpAdditionsGrouped}
          onRfpSelect={onRfpSelect}
          reportModalOpen={reportModalOpen}
          onReportModalChange={onReportModalChange}
        />
      )}

      {/* Full Width Sankey Flow Chart - Second chart */}
      {summary.rfpSankeyData && (
        <RfpFlowSankeyChart data={summary.rfpSankeyData} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <AnalystsChartCard data={summary.topAnalysts} />
        </div>
        <div>
          <VolumeChartCard data={summary.volumeSeries} />
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard

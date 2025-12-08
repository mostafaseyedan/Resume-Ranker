import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { emitNotification } from '@/utils/notificationUtils'
import apiClient from '@/services/apiClient'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Brain } from 'lucide-react'
import { Label } from '@vibe/core'
import '@vibe/core/tokens'
import type { MondayRfpItem } from '@/services/mondayService'
import RFPDetail from '@/components/RFPDetail'

// FoiaItem is now a full Monday RFP item with all fields from buildRfpRecord
// We extend MondayRfpItem to include FOIA-specific fields
interface FoiaItem extends Partial<MondayRfpItem> {
  id: string
  name: string
  groupId: string
  groupTitle: string
  createdAt: string
  updatedAt: string
  rfpType?: string
  rfpTypeColor?: string
  source?: string // 'group' or 'keyword'
}

interface FoiaData {
  itemId: string
  itemName: string
  groupTitle: string
  firstRequestDate: string | null
  lastRequestDate: string | null
  requestCount: number
  receivedDate: string | null
  status: 'Not Requested' | 'Requested' | 'Received' | 'Denied' | 'No Response'
  documentsCount: number | null
  awardedVendor: string | null
  awardedAmount: string | null
  submittedBy: string | null
  notes: string
  emailContact: string | null
  rfpNumber: string | null
  city: string | null
  state: string | null
  lastProcessed?: any
}

type SortField = 'name' | 'group' | 'status' | 'requestDate' | 'receivedDate' | 'responseTime' | 'requestCount' | 'vendor' | 'submittedBy'

type SortDirection = 'asc' | 'desc'

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

const FoiaTracking = () => {
  const [foiaItems, setFoiaItems] = useState<FoiaItem[]>([])
  const [allBoardItems, setAllBoardItems] = useState<FoiaItem[]>([])
  const [foiaData, setFoiaData] = useState<Map<string, FoiaData>>(new Map())
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [selectedRfp, setSelectedRfp] = useState<MondayRfpItem | null>(null)

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterGroup, setFilterGroup] = useState<string>('All')
  const [filterRfpType, setFilterRfpType] = useState<string>('All')
  const [showNotRequested, setShowNotRequested] = useState(false)

  // Sort states
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Convert FoiaItem to MondayRfpItem format for RFPDetail
  // Since backend now returns full rfpRecord, just map the fields
  const convertToMondayRfpItem = (foiaItem: FoiaItem): MondayRfpItem => {
    return {
      id: foiaItem.id,
      mondayId: foiaItem.mondayId || foiaItem.id,
      title: foiaItem.title || foiaItem.name,
      fileName: foiaItem.fileName || foiaItem.name,
      createdAt: foiaItem.createdAt || null,
      groupId: foiaItem.groupId || null,
      group: foiaItem.group || foiaItem.groupTitle || null,
      groupColor: foiaItem.groupColor || null,
      groupPosition: foiaItem.groupPosition || null,
      solutionType: foiaItem.solutionType || null,
      rfpType: foiaItem.rfpType || null,
      rfpTypeColor: foiaItem.rfpTypeColor || null,
      projectStatus: foiaItem.projectStatus || null,
      projectStatusColor: foiaItem.projectStatusColor || null,
      statusMetadata: foiaItem.statusMetadata || null,
      sharePointUrl: foiaItem.sharePointUrl || null,
      sharePointFolderId: foiaItem.sharePointFolderId || null,
      source: foiaItem.source || 'foia'
    }
  }

  // Load cached Firestore data on mount (not Monday items)
  useEffect(() => {
    loadCachedData()
  }, [])

  const loadCachedData = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/monday/foia-data')
      const dataMap = new Map<string, FoiaData>()

      // Load enriched FOIA data
      response.data.data.forEach((item: FoiaData) => {
        dataMap.set(item.itemId, item)
      })

      // Load cached items lists (from last Monday.com query)
      const cachedItems = response.data.items || []
      const cachedAllBoardItems = response.data.allBoardItems || []

      setFoiaData(dataMap)
      setFoiaItems(cachedItems)
      setAllBoardItems(cachedAllBoardItems)

      console.log(`Loaded ${cachedItems.length} cached FOIA items, ${cachedAllBoardItems.length} cached all board items, and ${dataMap.size} enriched data from Firestore`)
    } catch (error) {
      console.error('Failed to fetch cached FOIA data:', error)
      // Don't show error on page load - user can click refresh if needed
    } finally {
      setLoading(false)
    }
  }

  const loadFoiaItems = async () => {
    try {
      setLoading(true)

      // Fetch FOIA items from Monday
      const foiaResponse = await apiClient.get('/monday/foia-items')
      const foiaItems = foiaResponse.data.items || []
      setFoiaItems(foiaItems)

      // Fetch all board items from Monday
      const allItemsResponse = await apiClient.get('/monday/all-items')
      const allItems = allItemsResponse.data.items || []
      setAllBoardItems(allItems)

      // Cache both to Firestore for future loads
      await apiClient.post('/monday/foia-items-cache', { items: foiaItems })

      // Cache all board items (reuse FoiaService caching)
      await apiClient.post('/monday/all-items-cache', { items: allItems })

      toast.success(`Refreshed ${foiaItems.length} FOIA items and ${allItems.length} total items from Monday.com`)
    } catch (error) {
      console.error('Failed to fetch items:', error)
      toast.error('Failed to load items from Monday.com')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrichItem = async (item: FoiaItem) => {
    try {
      setProcessing(prev => new Set(prev).add(item.id))

      const response = await apiClient.post('/monday/foia-enrich', {
        itemId: item.id,
        itemName: item.name,
        groupTitle: item.groupTitle
      })

      // Update local state with new data
      setFoiaData(prev => {
        const newMap = new Map(prev)
        newMap.set(item.id, {
          itemId: item.id,
          itemName: item.name,
          groupTitle: item.groupTitle,
          ...response.data.data
        })
        return newMap
      })

      toast.success(`Successfully processed ${item.name} `)

      emitNotification(
        'foia_analysis_completed',
        'FOIA Analysis Completed',
        `Successfully processed ${item.name} `
      )
    } catch (error) {
      console.error(`Failed to enrich item ${item.id}: `, error)
      toast.error(`Failed to process ${item.name} `)
    } finally {
      setProcessing(prev => {
        const newSet = new Set(prev)
        newSet.delete(item.id)
        return newSet
      })
    }
  }

  const handleEnrichAll = async () => {
    // Process only items that haven't been processed yet
    const itemsToProcess = foiaItems.filter(item => !foiaData.has(item.id))

    if (itemsToProcess.length === 0) {
      toast.info('All items have already been processed')
      return
    }

    const BATCH_SIZE = 5
    const totalBatches = Math.ceil(itemsToProcess.length / BATCH_SIZE)

    toast.info(`Processing ${itemsToProcess.length} items in ${totalBatches} batch${totalBatches > 1 ? 'es' : ''}...`)

    emitNotification(
      'process_started',
      'Process Started',
      `Processing ${itemsToProcess.length} items in ${totalBatches} batches...`
    )

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, itemsToProcess.length)
      const batch = itemsToProcess.slice(start, end)

      toast.info(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)...`)

      try {
        // Send entire batch in ONE API call
        const response = await apiClient.post('/monday/foia-enrich-batch', {
          items: batch.map(item => ({
            itemId: item.id,
            itemName: item.name,
            groupTitle: item.groupTitle
          }))
        })

        // Update local state with all results
        const results = response.data.results || []
        setFoiaData(prev => {
          const newMap = new Map(prev)
          results.forEach((result: any) => {
            newMap.set(result.itemId, {
              itemId: result.itemId,
              itemName: result.itemName,
              groupTitle: batch.find(b => b.id === result.itemId)?.groupTitle || '',
              ...result
            })
          })
          return newMap
        })

        toast.success(`Batch ${batchIndex + 1}/${totalBatches} complete (${results.length} items)`)

        // Emit notification for each processed item
        results.forEach((result: any) => {
          emitNotification(
            'foia_analysis_completed',
            'FOIA Analysis Completed',
            `Successfully processed ${result.itemName || 'Item'}`
          )
        })
      } catch (error) {
        console.error(`Failed to process batch ${batchIndex + 1}:`, error)
        toast.error(`Batch ${batchIndex + 1} failed`)
      }
    }

    toast.success(`Finished processing all ${itemsToProcess.length} items`)
  }

  const handleFollowUpEmail = async (item: FoiaItem, data: FoiaData) => {
    try {
      // Extract organization name from item name (basic extraction)
      const orgMatch = item.name.match(/^([^-]+)/)
      const organization = orgMatch ? orgMatch[1].trim() : item.name

      // Generate email draft with Gemini
      toast.info('Generating follow-up email with AI...')

      const response = await apiClient.post('/monday/foia-draft-email', {
        itemId: item.id,
        itemName: item.name,
        organization,
        requestDate: data.firstRequestDate,
        requestCount: data.requestCount,
        notes: data.notes,
        emailContact: data.emailContact,
        rfpNumber: data.rfpNumber
      })

      const emailBody = response.data.emailDraft || ''
      const subject = `Follow-up: FOIA Request for ${organization}`

      // Create mailto link with recipient if email contact exists
      const recipient = data.emailContact || ''
      const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`

      window.location.href = mailtoLink

      if (data.emailContact) {
        toast.success(`Email draft opened for ${data.emailContact}`)
      } else {
        toast.success('Email draft opened (add recipient manually)')
      }
    } catch (error) {
      console.error('Failed to generate follow-up email:', error)
      toast.error('Failed to generate email draft')
    }
  }

  const getStatusVibeColor = (status: string) => {
    switch (status) {
      case 'Received':
        return 'done-green' // Monday.com Green
      case 'Requested':
        return 'primary' // Monday.com Primary Blue
      case 'Denied':
        return 'stuck-red' // Monday.com Red
      case 'No Response':
        return 'working_orange' // Monday.com Orange
      case 'Not Requested':
        return 'american_gray' // Monday.com Gray
      default:
        return 'american_gray' // Monday.com Gray
    }
  }

  // Convert Monday.com var_name color to Vibe Label color
  const getVibeLabelColor = (mondayColor?: string | null): string => {
    if (!mondayColor) {
      return 'primary'
    }

    // Normalize the color name (handle both formats)
    const normalized = mondayColor.toLowerCase().replace(/_/g, '-')

    // Try to find in mapping
    const vibeColor = MONDAY_TO_VIBE_COLOR_MAP[normalized]
    if (vibeColor) {
      return vibeColor
    }

    return 'primary'
  }

  const calculateResponseTime = (requestDate: string | null, receivedDate: string | null) => {
    if (!requestDate || !receivedDate) return null

    const request = new Date(requestDate)
    const received = new Date(receivedDate)
    const days = Math.floor((received.getTime() - request.getTime()) / (1000 * 60 * 60 * 24))

    return days
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Get unique groups for filter
  const uniqueGroups = useMemo(() => {
    const itemsToUse = showNotRequested ? allBoardItems : foiaItems
    const groups = new Set(itemsToUse.map(item => item.groupTitle))
    return Array.from(groups).sort()
  }, [foiaItems, allBoardItems, showNotRequested])

  // Get unique RFP types for filter
  const uniqueRfpTypes = useMemo(() => {
    const itemsToUse = showNotRequested ? allBoardItems : foiaItems
    const types = new Set<string>()
    itemsToUse.forEach(item => {
      if (item.rfpType) {
        types.add(item.rfpType)
      }
    })
    return Array.from(types).sort()
  }, [foiaItems, allBoardItems, showNotRequested])

  // Filtered and sorted items
  const filteredAndSortedItems = useMemo(() => {
    // Determine which items to show based on toggle
    const itemsToFilter = showNotRequested ? allBoardItems : foiaItems

    let filtered = itemsToFilter.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
      const data = foiaData.get(item.id)

      // If showNotRequested is false, filter out "Not Requested" items
      if (!showNotRequested && (!data || data.status === 'Not Requested')) {
        return false
      }

      // If showNotRequested is true, items without data are considered "Not Requested"
      const itemStatus = data?.status || 'Not Requested'
      const matchesStatus = filterStatus === 'All' || itemStatus === filterStatus
      const matchesGroup = filterGroup === 'All' || item.groupTitle === filterGroup
      const matchesRfpType = filterRfpType === 'All' || item.rfpType === filterRfpType
      return matchesSearch && matchesStatus && matchesGroup && matchesRfpType
    })

    // Sort
    filtered.sort((a, b) => {
      const dataA = foiaData.get(a.id)
      const dataB = foiaData.get(b.id)

      let compareValue = 0

      switch (sortField) {
        case 'name':
          compareValue = a.name.localeCompare(b.name)
          break
        case 'group':
          compareValue = a.groupTitle.localeCompare(b.groupTitle)
          break
        case 'status':
          compareValue = (dataA?.status || '').localeCompare(dataB?.status || '')
          break
        case 'requestDate':
          compareValue = (dataA?.firstRequestDate || '').localeCompare(dataB?.firstRequestDate || '')
          break
        case 'receivedDate':
          compareValue = (dataA?.receivedDate || '').localeCompare(dataB?.receivedDate || '')
          break
        case 'responseTime': {
          const timeA = calculateResponseTime(dataA?.firstRequestDate || null, dataA?.receivedDate || null) || 0
          const timeB = calculateResponseTime(dataB?.firstRequestDate || null, dataB?.receivedDate || null) || 0
          compareValue = timeA - timeB
          break
        }
        case 'requestCount':
          compareValue = (dataA?.requestCount || 0) - (dataB?.requestCount || 0)
          break
        case 'vendor':
          compareValue = (dataA?.awardedVendor || '').localeCompare(dataB?.awardedVendor || '')
          break
        case 'submittedBy':
          compareValue = (dataA?.submittedBy || '').localeCompare(dataB?.submittedBy || '')
          break
      }

      return sortDirection === 'asc' ? compareValue : -compareValue
    })

    return filtered
  }, [foiaItems, allBoardItems, foiaData, searchTerm, filterStatus, filterGroup, filterRfpType, sortField, sortDirection, showNotRequested])

  // Stats
  const stats = useMemo(() => {
    const dataValues = Array.from(foiaData.values()).filter(d => d.status !== 'Not Requested')

    // Calculate "Not Requested" count based on toggle state
    let notRequestedCount = 0
    if (showNotRequested) {
      // Count all board items that either have no data or have status "Not Requested"
      notRequestedCount = allBoardItems.filter(item => {
        const data = foiaData.get(item.id)
        return !data || data.status === 'Not Requested'
      }).length
    }

    return {
      total: dataValues.length,
      processed: dataValues.length,
      requested: dataValues.filter(d => d.status === 'Requested').length,
      received: dataValues.filter(d => d.status === 'Received').length,
      notRequested: notRequestedCount
    }
  }, [foiaData, allBoardItems, showNotRequested])

  // Chart data
  const chartData = useMemo(() => {
    const data = [
      { name: 'Requested', value: stats.requested, color: '#6161FF' },
      { name: 'Received', value: stats.received, color: '#00c875' }
    ]

    // Include "Not Requested" in chart when toggle is on
    if (showNotRequested && stats.notRequested > 0) {
      data.push({ name: 'Not Requested', value: stats.notRequested, color: '#C4C4C4' })
    }

    return data.filter(item => item.value > 0)
  }, [stats, showNotRequested])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  // If an RFP is selected, show the detail view
  if (selectedRfp) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50 dark:bg-[#181b34]">
        <RFPDetail
          rfp={selectedRfp}
          onClose={() => setSelectedRfp(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 dark:bg-[#181b34]">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#797e93] bg-white dark:bg-[#30324e] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#d5d8df]">FOIA Tracking</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFoiaItems}
              disabled={loading}
              title="Refresh FOIA items from Monday.com"
              className="p-1.5 bg-white dark:bg-[#30324e] text-gray-700 dark:text-[#9699a6] rounded hover:bg-gray-100 dark:hover:bg-[#323861] disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-[#797e93]"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={handleEnrichAll}
              disabled={processing.size > 0}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing.size > 0 ? 'Processing...' : 'Process All'}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1">
        <div className="py-4">
          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            {/* Status Distribution Chart */}
            <div className="lg:col-span-4 bg-white dark:bg-[#30324e] p-6 rounded-lg border border-gray-200 dark:border-[#797e93]">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Status Distribution</h3>
              {chartData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 dark:text-[#9699a6]">
                  No processed items yet
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className="lg:col-span-1 flex flex-col gap-3 h-full">
              <div className="bg-white dark:bg-[#30324e] rounded-lg p-2 border border-gray-200 dark:border-[#797e93]">
                <div className="text-xs text-slate-500 dark:text-[#9699a6] uppercase font-medium mb-0.5">Active FOIA Requests</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">{stats.total}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-gray-200 dark:border-[#797e93]">
                <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium mb-0.5">Requested</div>
                <div className="text-base font-bold text-blue-700 dark:text-blue-300">{stats.requested}</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 border border-gray-200 dark:border-[#797e93]">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium mb-0.5">Received</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">{stats.received}</div>
              </div>
              {showNotRequested && (
                <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-2 border border-gray-200 dark:border-[#797e93]">
                  <div className="text-xs text-gray-600 dark:text-gray-400 uppercase font-medium mb-0.5">Not Requested</div>
                  <div className="text-base font-bold text-gray-700 dark:text-gray-300">{stats.notRequested}</div>
                </div>
              )}
            </div>
          </div>

          {/* Search and Filter Card */}
          <div className="bg-white dark:bg-[#30324e] p-3 rounded-lg border border-gray-200 dark:border-[#797e93] mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-32 flex-shrink-0 text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-white dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Requested">Requested</option>
                <option value="Received">Received</option>
                <option value="Denied">Denied</option>
                <option value="No Response">No Response</option>
              </select>

              {/* Group Filter */}
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-32 flex-shrink-0 text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-white dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="All">All Groups</option>
                {uniqueGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>

              {/* RFP Type Filter */}
              <select
                value={filterRfpType}
                onChange={(e) => setFilterRfpType(e.target.value)}
                className="w-32 flex-shrink-0 text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-white dark:bg-[#30324e] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="All">All Types</option>
                {uniqueRfpTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {/* Search */}
              <input
                type="text"
                placeholder="Search titles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm border border-gray-300 dark:border-[#4b4e69] rounded px-2 py-1 bg-slate-50 dark:bg-[#181b34] text-gray-900 dark:text-[#d5d8df] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-64"
              />

              {/* Toggle for Not Requested Items */}
              <label className="flex items-center gap-2 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={showNotRequested}
                  onChange={(e) => setShowNotRequested(e.target.checked)}
                  className="w-4 h-4 text-[#6161FF] bg-white dark:bg-[#30324e] border-gray-300 dark:border-[#4b4e69] rounded focus:ring-[#6161FF] focus:ring-2 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-[#9699a6] select-none">
                  Include Not Requested items
                </span>
              </label>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#30324e] rounded-lg border border-gray-200 dark:border-[#797e93]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#181b34] border-b border-slate-200 dark:border-[#4b4e69] text-xs uppercase tracking-wider text-slate-500 dark:text-[#9699a6] font-semibold">
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors min-w-[300px]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        RFP Name
                        <SortIcon field="name" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-40"
                      onClick={() => handleSort('group')}
                    >
                      <div className="flex items-center gap-2">
                        Group
                        <SortIcon field="group" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-32"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        <SortIcon field="status" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-32"
                      onClick={() => handleSort('requestDate')}
                    >
                      <div className="flex items-center gap-2">
                        Request Date
                        <SortIcon field="requestDate" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-32"
                      onClick={() => handleSort('receivedDate')}
                    >
                      <div className="flex items-center gap-2">
                        Received Date
                        <SortIcon field="receivedDate" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-20"
                      onClick={() => handleSort('requestCount')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Requests
                        <SortIcon field="requestCount" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-40"
                      onClick={() => handleSort('vendor')}
                    >
                      <div className="flex items-center gap-2">
                        Awarded Vendor
                        <SortIcon field="vendor" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323861] transition-colors w-32"
                      onClick={() => handleSort('submittedBy')}
                    >
                      <div className="flex items-center gap-2">
                        Submitted By
                        <SortIcon field="submittedBy" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center w-44">
                      Actions
                    </th>
                    <th className="px-4 py-3 text-center w-20">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#4b4e69]">
                  {filteredAndSortedItems.map(item => {
                    const data = foiaData.get(item.id)
                    const isProcessing = processing.has(item.id)

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedRfp(convertToMondayRfpItem(item))}
                        className="group hover:bg-slate-50 dark:hover:bg-[#3a3d5c] transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">
                          <div className="flex flex-col gap-1.5">
                            <span>{item.name}</span>
                            {item.rfpType && (
                              <Label
                                text={item.rfpType}
                                size="small"
                                color={getVibeLabelColor(item.rfpTypeColor) as any}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#9699a6]">
                          {item.groupTitle}
                        </td>
                        <td className="px-4 py-3">
                          {data ? (
                            <Label
                              text={data.status}
                              size="small"
                              color={getStatusVibeColor(data.status) as any}
                            />
                          ) : (
                            <Label
                              text="Not processed"
                              size="small"
                              color="american_gray"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#9699a6] font-mono">
                          {data?.firstRequestDate || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#9699a6] font-mono">
                          {data?.receivedDate || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {data?.requestCount ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${data.requestCount > 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                              {data.requestCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#9699a6] max-w-[160px]">
                          <div className="break-words">
                            {data?.awardedVendor || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#9699a6] max-w-[128px]">
                          <div className="break-words">
                            {data?.submittedBy || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEnrichItem(item)
                              }}
                              disabled={isProcessing}
                              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 whitespace-nowrap"
                            >
                              {isProcessing ? (
                                <span className="inline-flex items-center gap-1">
                                  <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                  Processing...
                                </span>
                              ) : data ? (
                                'Reprocess'
                              ) : (
                                'Process'
                              )}
                            </button>
                            {data && (data.status === 'Requested' || data.status === 'No Response') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFollowUpEmail(item, data)
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 px-2 py-1"
                                title="Draft Follow-up Email with AI"
                              >
                                Email
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {data && data.notes && (
                            <div className="relative group/notes inline-block">
                              <Brain className="h-5 w-5 text-slate-400 hover:text-purple-400 dark:text-slate-500 dark:hover:text-purple-400 cursor-help transition-colors" />
                              <div className="absolute right-0 top-full mt-2 w-80 p-3 bg-white dark:bg-[#292f4c] text-gray-900 dark:text-[#d5d8df] text-xs rounded-xl shadow-lg border border-gray-200 dark:border-[#797e93] opacity-0 invisible group-hover/notes:opacity-100 group-hover/notes:visible transition-all z-10 pointer-events-none">
                                <div className="font-semibold mb-2">Notes:</div>
                                <div className="text-gray-700 dark:text-[#9699a6]">{data.notes}</div>
                                <div className="absolute bottom-full right-4 -mb-1">
                                  <div className="border-[6px] border-transparent border-b-white dark:border-b-[#292f4c]"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filteredAndSortedItems.length === 0 && (
                <div className="p-12 text-center text-slate-500 dark:text-[#9699a6]">
                  <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">No requests found</h3>
                  <p className="mt-1">Try adjusting your search or filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default FoiaTracking

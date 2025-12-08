import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Layout from '@/components/Layout'
import RFPList from '@/components/RFPList'
import RFPDetail from '@/components/RFPDetail'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import FoiaTracking from '@/pages/FoiaTracking'
import { mondayService, type MondayRfpItem } from '@/services/mondayService'
import { emitNotification } from '@/utils/notificationUtils'

const Dashboard = () => {
  const [selectedRfp, setSelectedRfp] = useState<MondayRfpItem | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showFoia, setShowFoia] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [rfpMap, setRfpMap] = useState<Map<string, MondayRfpItem>>(new Map())
  // Track where user came from when opening RFPDetail
  const [previousView, setPreviousView] = useState<'analytics' | 'foia' | 'list' | null>(null)
  // Preserve analytics report modal state across RFPDetail open/close
  const [analyticsReportModalOpen, setAnalyticsReportModalOpen] = useState(false)

  // Show toast for RFPs added today
  useEffect(() => {
    const showTodayRFPs = async () => {
      try {
        const todayRFPs = await mondayService.getRFPsAddedToday()

        if (todayRFPs.length > 0) {
          // Check if we've already notified for today to prevent spam on reload
          const lastNotifiedDate = sessionStorage.getItem('last_rfp_notification_date')
          const todayStr = new Date().toDateString()

          todayRFPs.forEach(rfp => {
            const notificationId = `new-rfp-${rfp.id}-${todayStr}`

            // Emit persistent notification with stable ID
            emitNotification(
              'dashboard_summary',
              'New RFP Added',
              `${rfp.title} added today to ${rfp.group}`,
              { rfp }, // Pass RFP data for future click handling
              notificationId
            )

            // Show toast as well (only if we haven't shown it this session to avoid toast spam)
            if (lastNotifiedDate !== todayStr) {
              toast.info(
                <div>
                  <strong>{rfp.title}</strong> added today to <strong>{rfp.group}</strong>
                </div>,
                {
                  duration: 8000,
                  dismissible: true,
                }
              )
            }
          })

          sessionStorage.setItem('last_rfp_notification_date', todayStr)
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch today\'s RFPs:', error)
      }
    }

    showTodayRFPs()

    // Listen for request to open RFP detail from notifications
    const handleOpenRfpDetail = (event: CustomEvent<MondayRfpItem>) => {
      setSelectedRfp(event.detail)
      setShowAnalytics(false)
      setShowFoia(false)
    }

    window.addEventListener('open-rfp-detail', handleOpenRfpDetail as EventListener)

    return () => {
      window.removeEventListener('open-rfp-detail', handleOpenRfpDetail as EventListener)
    }
  }, [])

  const handleRfpSelect = (rfp: MondayRfpItem) => {
    setSelectedRfp(rfp)
    setShowAnalytics(false)
    setShowFoia(false)
  }

  const handleShowAnalytics = () => {
    setSelectedRfp(null)
    setShowAnalytics(true)
    setShowFoia(false)
  }

  const handleShowFoia = () => {
    setSelectedRfp(null)
    setShowAnalytics(false)
    setShowFoia(true)
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  // Callback for RFPList to share loaded RFPs with Dashboard
  const handleRfpsLoaded = (rfps: MondayRfpItem[]) => {
    setRfpMap(new Map(rfps.map(rfp => [String(rfp.id), rfp])))
  }

  // Lookup function for AnalyticsDashboard to find RFPs by ID
  const handleRfpLookup = (rfpId: string): MondayRfpItem | undefined => {
    return rfpMap.get(String(rfpId))
  }

  // Handler for when analytics wants to open an RFP
  const handleAnalyticsRfpSelect = (rfpId: string) => {
    const rfp = handleRfpLookup(rfpId)
    if (rfp) {
      setPreviousView('analytics')  // Remember we came from analytics
      setSelectedRfp(rfp)
      // Keep showAnalytics true so we return to it when RFPDetail closes
    } else {
      toast.error('RFP not found in cache')
    }
  }

  // Handler for closing RFPDetail - returns to previous view
  const handleCloseRfpDetail = () => {
    setSelectedRfp(null)
    if (previousView === 'analytics') {
      setShowAnalytics(true)
      setShowFoia(false)
    } else if (previousView === 'foia') {
      setShowAnalytics(false)
      setShowFoia(true)
    }
    // If previousView is 'list' or null, just show empty state (default behavior)
    setPreviousView(null)
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Content Area - Sidebar + Detail Pane Layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left Sidebar - RFP List */}
          <div
            className={`relative bg-white dark:bg-[#30324e] border-r border-gray-200 dark:border-[#4b4e69] transition-all duration-300 ${isSidebarCollapsed
              ? 'w-14 md:w-16 lg:w-20 flex-shrink-0'
              : 'flex-shrink-0 basis-[60%] sm:basis-[52%] md:basis-[42%] lg:flex-[0_0_32%] xl:flex-[0_0_30%] 2xl:flex-[0_0_27%] min-w-[19rem]'
              }`}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? 'Expand RFP list' : 'Collapse RFP list'}
              className="absolute top-4 -right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 dark:border-[#4b4e69] bg-white dark:bg-[#30324e] shadow-sm hover:bg-gray-100 dark:hover:bg-[#323861] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              <svg
                className={`h-4 w-4 text-gray-600 dark:text-[#9699a6] transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 5L7 10L12 15"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">{isSidebarCollapsed ? 'Expand RFP list' : 'Collapse RFP list'}</span>
            </button>

            <div
              className={`h-full transition-opacity duration-200 ease-in-out ${isSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              aria-hidden={isSidebarCollapsed}
            >
              <RFPList
                selectedRfp={selectedRfp}
                onRfpSelect={handleRfpSelect}
                onShowAnalytics={handleShowAnalytics}
                onShowFoia={handleShowFoia}
                onRfpsLoaded={handleRfpsLoaded}
              />
            </div>

            {isSidebarCollapsed && (
              <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
                <span className="-rotate-90 select-none text-xs font-semibold tracking-widest text-gray-400 dark:text-[#9699a6]">
                  RFPs
                </span>
              </div>
            )}
          </div>

          {/* Right Panel - RFP Detail or Logs or Analytics or FOIA or Empty State */}
          <div className="flex-1 bg-gray-50 dark:bg-[#181b34] overflow-y-auto flex flex-col min-h-0">
            <div className="p-6 flex-1 min-h-0">
              {selectedRfp ? (
                <RFPDetail
                  rfp={selectedRfp}
                  onClose={handleCloseRfpDetail}
                />
              ) : showAnalytics ? (
                <AnalyticsDashboard
                  onRfpSelect={handleAnalyticsRfpSelect}
                  reportModalOpen={analyticsReportModalOpen}
                  onReportModalChange={setAnalyticsReportModalOpen}
                />
              ) : showFoia ? (
                <FoiaTracking />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 dark:text-[#9699a6] text-lg">Select an RFP to view details</p>
                    <p className="text-gray-400 dark:text-[#9699a6] text-sm mt-2">
                      Choose an RFP from the list to see files, proposals, and analysis
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard

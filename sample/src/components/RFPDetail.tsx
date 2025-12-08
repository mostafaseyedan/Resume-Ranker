import { useState, useEffect } from 'react'
import type { MondayRfpItem } from '@/services/mondayService'
import apiClient from '@/services/apiClient'
import { Label, Button, TabList, Tab } from '@vibe/core'
import '@vibe/core/tokens'
import FilesTab from './rfp/FilesTab'
import ProposalsTab from './rfp/ProposalsTab'
import AnalysisTab from './rfp/AnalysisTab'
import UpdatesTab from './rfp/UpdatesTab'
import ChatTab from './rfp/ChatTab'
import FOIATab from './rfp/FOIATab'

interface RFPDetailProps {
  rfp: MondayRfpItem
  onClose?: () => void
}

type TabType = 'files' | 'updates' | 'foia' | 'analysis' | 'proposals' | 'chat'

const RFPDetail = ({ rfp, onClose }: RFPDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('analysis')

  const tabs: TabType[] = ['files', 'updates', 'foia', 'analysis', 'proposals', 'chat']
  const activeTabIndex = tabs.indexOf(activeTab)
  const [winProbabilityScore, setWinProbabilityScore] = useState<number | null>(null)
  const [proposalReviewScore, setProposalReviewScore] = useState<number | null>(null)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [proposalCount, setProposalCount] = useState(0)
  const [updateCount, setUpdateCount] = useState(0)
  const [foiaCount, setFoiaCount] = useState(0)

  // Reset to analysis tab and scores when RFP changes
  useEffect(() => {
    setActiveTab('analysis')
    setWinProbabilityScore(null)
    setProposalReviewScore(null)

    const fetchLatestScores = async () => {
      try {
        // Fetch latest RFP analysis
        const analysisResponse = await apiClient.get('/rfp-analyses', {
          params: { rfpId: rfp.id }
        })
        const analyses = analysisResponse.data.analyses || []
        setAnalysisCount(analyses.length)
        if (analyses.length > 0) {
          // Sort by createdAt descending to get the true latest analysis
          const sortedAnalyses = [...analyses].sort((a: any, b: any) => {
            const getMillis = (date: any) => {
              if (!date) return 0
              if (date._seconds) return date._seconds * 1000
              if (date.seconds) return date.seconds * 1000
              return new Date(date).getTime()
            }
            return getMillis(b.createdAt) - getMillis(a.createdAt)
          })

          const latestAnalysis = sortedAnalyses[0]
          const score = extractWinProbabilityScore(latestAnalysis.winProbability)
          setWinProbabilityScore(score)
        }

        // Fetch latest proposal review
        const reviewResponse = await apiClient.get('/proposal-reviews', {
          params: { rfpId: rfp.id }
        })
        const reviews = reviewResponse.data.reviews || []
        setProposalCount(reviews.length)
        if (reviews.length > 0) {
          const latestReview = reviews[0]
          setProposalReviewScore(latestReview.overallScore || null)
        }

        // Fetch FOIA analyses count
        try {
          const foiaResponse = await apiClient.get('/foia-analyses', {
            params: { rfpId: rfp.id }
          })
          const foiaAnalyses = foiaResponse.data.analyses || []
          setFoiaCount(foiaAnalyses.length)
        } catch (err) {
          // FOIA endpoint might not exist
          setFoiaCount(0)
        }

        // Fetch updates count
        try {
          const updatesResponse = await apiClient.get(`/monday/items/${rfp.id}/updates`)
          if (updatesResponse.data.success) {
            const updates = updatesResponse.data.updates || []
            setUpdateCount(updates.length)
          } else {
            setUpdateCount(0)
          }
        } catch (err) {
          setUpdateCount(0)
        }
      } catch (error) {
        // Silent fail - badges just won't appear
        console.error('Failed to fetch scores:', error)
      }
    }

    fetchLatestScores()
  }, [rfp.id])


  const extractWinProbabilityScore = (raw: unknown): number | null => {
    if (raw == null) return null

    if (typeof raw === 'number') {
      return raw
    }

    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw)
      return Number.isFinite(parsed) ? parsed : null
    }

    if (typeof raw === 'object') {
      const probabilityScore = (raw as { probabilityScore?: unknown }).probabilityScore
      if (typeof probabilityScore === 'number') {
        return probabilityScore
      }
    }

    return null
  }

  const getScoreTextColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 dark:text-green-400'
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  // Map Monday.com var_name colors to Vibe Label colors
  const MONDAY_TO_VIBE_COLOR_MAP: Record<string, string> = {
    'green-shadow': 'done-green',
    'grass-green': 'grass_green',
    'lime-green': 'saladish',
    'orange': 'working_orange',
    'dark-orange': 'dark-orange',
    'yellow': 'egg_yolk',
    'mustered': 'tan',
    'red-shadow': 'stuck-red',
    'dark-red': 'dark-red',
    'dark-pink': 'sofia_pink',
    'dark-purple': 'dark_purple',
    'dark_indigo': 'dark_indigo',
    'bright-blue': 'bright-blue',
    'blue-links': 'river',
    'sky': 'sky',
    'navy': 'navy',
    'australia': 'aquamarine',
    'grey': 'american_gray',
    'trolley-grey': 'steel',
    'soft-black': 'blackish',
    'sunset': 'sunset',
    'sail': 'winter',
    'eden': 'teal'
  }

  const getVibeLabelColor = (mondayColor?: string | null): string => {
    if (!mondayColor) return 'primary'
    const normalized = mondayColor.toLowerCase().replace(/_/g, '-')
    return MONDAY_TO_VIBE_COLOR_MAP[normalized] || 'primary'
  }

  return (
    <div className={`bg-white dark:bg-[#30324e] rounded-lg shadow border border-gray-200 dark:border-[#797e93] flex flex-col ${activeTab === 'chat' ? 'h-full' : 'max-h-full'}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] px-6 py-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#d5d8df]">{rfp.title}</h2>
            <div className="flex items-center mt-2 gap-2 flex-wrap">
              {/* Project Status Badge */}
              {rfp.projectStatus && rfp.projectStatusColor && (
                <Label
                  id={`detail-status-${rfp.id}`}
                  text={rfp.projectStatus}
                  size="medium"
                  color={getVibeLabelColor(rfp.projectStatusColor) as any}
                />
              )}

              {/* Req Type Badge */}
              {rfp.rfpType && rfp.rfpTypeColor && (
                <Label
                  id={`detail-type-${rfp.id}`}
                  text={rfp.rfpType}
                  size="medium"
                  color={getVibeLabelColor(rfp.rfpTypeColor) as any}
                />
              )}

              {/* Dates */}
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                {rfp.createdAt && (
                  <span>
                    Created: {new Date(rfp.createdAt).toLocaleDateString()}
                  </span>
                )}
                {rfp.proposalDue && (() => {
                  const parsed = new Date(rfp.proposalDue)
                  const due = new Date(parsed)
                  due.setHours(0, 0, 0, 0)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  const isSoon = diffDays < 15
                  const isPast = diffDays < 0
                  const label = isPast
                    ? `${parsed.toLocaleDateString()} (past due)`
                    : `${parsed.toLocaleDateString()} (${diffDays} day${diffDays === 1 ? '' : 's'})`

                  return (
                    <span className={isSoon ? 'text-red-600 dark:text-red-400' : ''}>
                      Due: {label}
                    </span>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Score Badges + Close */}
          <div className="flex items-center gap-3">
            {winProbabilityScore !== null && (
              <div className="px-3 py-1.5 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-center min-w-[80px]">
                <div className="text-[10px] text-blue-700 dark:text-blue-300 uppercase tracking-wide font-bold">Win Prob.</div>
                <div className={`text-lg font-bold ${getScoreTextColor(winProbabilityScore)}`}>{winProbabilityScore}%</div>
              </div>
            )}

            {proposalReviewScore !== null && (
              <div className="px-3 py-1.5 rounded-lg border border-green-500 bg-green-50 dark:bg-green-900/20 text-center min-w-[80px]">
                <div className="text-[10px] text-green-700 dark:text-green-300 uppercase tracking-wide font-bold">Proposal</div>
                <div className={`text-lg font-bold ${getScoreTextColor(proposalReviewScore)}`}>{proposalReviewScore}%</div>
              </div>
            )}

            {onClose && (
              <Button
                onClick={onClose}
                kind="tertiary"
                size="small"
                ariaLabel="Close detail panel"
                className="p-1"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4L12 12" />
                  <path d="M12 4L4 12" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69]">
        <TabList
          activeTabId={activeTabIndex}
          onTabChange={(index: number) => setActiveTab(tabs[index])}
          size="sm"
        >
          {/* @ts-ignore - tabInnerClassName is supported but missing from types */}
          <Tab tabInnerClassName="!text-sm">Files</Tab>
          {/* @ts-ignore */}
          <Tab tabInnerClassName="!text-sm">{`Updates ${updateCount > 0 ? `(${updateCount})` : ''}`}</Tab>
          {/* @ts-ignore */}
          <Tab tabInnerClassName="!text-sm">{`FOIA ${foiaCount > 0 ? `(${foiaCount})` : ''}`}</Tab>
          {/* @ts-ignore */}
          <Tab tabInnerClassName="!text-sm">{`Analysis ${analysisCount > 0 ? `(${analysisCount})` : ''}`}</Tab>
          {/* @ts-ignore */}
          <Tab tabInnerClassName="!text-sm">{`Proposals ${proposalCount > 0 ? `(${proposalCount})` : ''}`}</Tab>
          {/* @ts-ignore */}
          <Tab tabInnerClassName="!text-sm">
            <div className="flex items-center gap-2">
              <img src="/images/gemini-icon.svg" alt="Chat" className="w-4 h-4" />
              Chat
            </div>
          </Tab>
        </TabList>
      </div>

      {/* Tab Content */}
      <div className={`${activeTab === 'chat' ? 'p-0 overflow-hidden' : 'p-2 overflow-y-auto'} flex-1 min-h-0`}>
        {activeTab === 'files' && (
          <FilesTab
            sharePointFolderId={rfp.sharePointFolderId || null}
            sharePointUrl={rfp.sharePointUrl || null}
            rfpId={rfp.id}
            onAnalysisSuccess={() => setActiveTab('analysis')}
            onReviewSuccess={() => setActiveTab('proposals')}
            onFoiaSuccess={() => setActiveTab('foia')}
          />
        )}
        {activeTab === 'updates' && <UpdatesTab rfpId={rfp.id} />}
        {activeTab === 'foia' && <FOIATab rfpId={rfp.id} />}
        {activeTab === 'analysis' && (
          <AnalysisTab
            rfpId={rfp.id}
            sharePointUrl={rfp.sharePointUrl || null}
            rfpTitle={rfp.title}
          />
        )}
        {activeTab === 'proposals' && <ProposalsTab rfpId={rfp.id} />}
        {activeTab === 'chat' && (
          <ChatTab
            rfpId={rfp.id}
            rfpTitle={rfp.title}
          />
        )}
      </div>
    </div>
  )
}

export default RFPDetail

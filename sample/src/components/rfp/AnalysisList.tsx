import { useState } from 'react'
import { toast } from 'sonner'
import type { RFPAnalysisResult } from '@/types/analysis'
import apiClient from '@/services/apiClient'
import { extractProvider, getProviderDetails } from '@/utils/providerBadges'

interface AnalysisListProps {
  analyses: RFPAnalysisResult[]
  loading: boolean
  onSelectAnalysis: (analysis: RFPAnalysisResult) => void
  onNewAnalysis?: () => void
  onAnalysisDeleted?: () => void
}

const AnalysisList = ({ analyses, loading, onSelectAnalysis, onNewAnalysis, onAnalysisDeleted }: AnalysisListProps) => {
  const [deleting, setDeleting] = useState<string | null>(null)
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300'
    }
  }

  const getRecommendationColor = (recommendation: string | undefined) => {
    if (!recommendation) return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300'
    const rec = recommendation.toLowerCase()
    if (rec.includes('go') && !rec.includes('no-go')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
    if (rec.includes('no-go')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  }

  const getProbabilityColor = (score: number | undefined) => {
    if (!score) return 'text-gray-600 dark:text-gray-300'
    if (score >= 70) return 'text-green-600 dark:text-green-300'
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-300'
    return 'text-red-600 dark:text-red-300'
  }

  const getRiskColor = (risk: string | undefined) => {
    if (!risk) return 'text-gray-600 dark:text-gray-300'
    const r = risk.toLowerCase()
    if (r.includes('low')) return 'text-green-600 dark:text-green-300'
    if (r.includes('medium') || r.includes('moderate')) return 'text-yellow-600 dark:text-yellow-300'
    if (r.includes('high') || r.includes('critical')) return 'text-red-600 dark:text-red-300'
    return 'text-gray-600 dark:text-gray-300'
  }

  const getCapabilityColor = (match: string | undefined) => {
    if (!match) return 'text-gray-600 dark:text-gray-300'

    // Try to parse percentage
    const percentage = parseInt(match.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(percentage)) {
      if (percentage >= 70) return 'text-green-600 dark:text-green-300'
      if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-300'
      return 'text-red-600 dark:text-red-300'
    }

    const m = match.toLowerCase()
    if (m.includes('high') || m.includes('strong')) return 'text-green-600 dark:text-green-300'
    if (m.includes('medium') || m.includes('moderate')) return 'text-yellow-600 dark:text-yellow-300'
    if (m.includes('low') || m.includes('weak')) return 'text-red-600 dark:text-red-300'
    return 'text-gray-600 dark:text-gray-300'
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown'
    const seconds = timestamp._seconds || timestamp.seconds
    if (!seconds) return 'Unknown'
    return new Date(seconds * 1000).toLocaleString()
  }

  const handleDeleteAnalysis = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click when clicking delete

    // Use toast for confirmation
    toast('Are you sure you want to delete this analysis?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            setDeleting(analysisId)
            await apiClient.delete(`/rfp-analysis/${analysisId}`)

            toast.success('Analysis deleted successfully')

            // Trigger refresh
            if (onAnalysisDeleted) {
              onAnalysisDeleted()
            }
          } catch (error: any) {
            console.error('Failed to delete analysis:', error)
            toast.error('Failed to delete analysis', {
              description: error.response?.data?.error || error.message
            })
          } finally {
            setDeleting(null)
          }
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {
          // Do nothing, just dismiss
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading analyses...</span>
      </div>
    )
  }

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-[#9699a6]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-[#d5d8df] mb-2">No Analyses Yet</h3>
        <p className="text-gray-500 dark:text-[#9699a6] mb-4">
          Analyze RFP files from the Files tab to generate analysis reports.
        </p>
        {onNewAnalysis && (
          <button
            onClick={onNewAnalysis}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-[#0060b9]"
          >
            Run New Analysis
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="space-y-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-normal text-gray-900 dark:text-[#d5d8df]">
            RFP Analyses ({analyses.length})
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...analyses]
            .sort((a, b) => Date.parse(formatDate(b.createdAt)) - Date.parse(formatDate(a.createdAt)))
            .map((analysis) => {
              const providerValue = extractProvider(analysis)
              const providerDetails = getProviderDetails(providerValue)

              return (
                <div
                  key={analysis.id}
                  onClick={() => onSelectAnalysis(analysis)}
                  className="bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#797e93] rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[#323861] hover:border-primary dark:hover:border-[#69a7ef] cursor-pointer transition-colors"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-semibold text-gray-900 dark:text-[#d5d8df] text-sm truncate overflow-hidden text-ellipsis">
                        {analysis.fileNames?.[0] || analysis.rfpTitle}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                        {formatDate(analysis.createdAt)}
                      </p>
                      {analysis.fileNames && analysis.fileNames.length > 1 && (
                        <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                          + {analysis.fileNames.length - 1} additional file{analysis.fileNames.length - 1 > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <img
                        src={providerDetails.image}
                        alt={`${providerDetails.label} badge`}
                        className={`${providerDetails.iconClass} object-contain ${providerDetails.label === 'ChatGPT' ? 'dark:invert' : ''}`}
                        title={providerDetails.description}
                      />
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}
                      >
                        {analysis.status}
                      </span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-2 mb-3">
                    {(() => {
                      const raw = analysis.winProbability as unknown
                      let score: number | undefined
                      let confidence: string | undefined

                      if (raw == null) {
                        score = undefined
                      } else if (typeof raw === 'number') {
                        score = raw
                      } else if (typeof raw === 'string') {
                        const parsed = Number.parseFloat(raw)
                        score = Number.isFinite(parsed) ? parsed : undefined
                      } else if (typeof raw === 'object') {
                        const probabilityScore = (raw as { probabilityScore?: unknown }).probabilityScore
                        if (typeof probabilityScore === 'number') {
                          score = probabilityScore
                        }
                        const confidenceLevel = (raw as { confidenceLevel?: unknown }).confidenceLevel
                        if (typeof confidenceLevel === 'string') {
                          confidence = confidenceLevel
                        }
                      }

                      if (score === undefined) {
                        return null
                      }

                      return (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-[#d5d8df]">Win Probability:</span>
                          <span
                            className={`text-sm font-semibold ${getProbabilityColor(score)}`}
                            title={confidence ? `Confidence: ${confidence}` : undefined}
                          >
                            {`${score}%`}
                          </span>
                        </div>
                      )
                    })()}

                    {/* Capability Match */}
                    {analysis.requirementsAnalysis?.capabilityMatch && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-[#d5d8df]">Capability Match:</span>
                        <span className={`text-sm font-medium ${getCapabilityColor(analysis.requirementsAnalysis.capabilityMatch)}`}>
                          {analysis.requirementsAnalysis.capabilityMatch.replace(/[^0-9%]/g, '')}
                        </span>
                      </div>
                    )}

                    {/* Risk Level */}
                    {analysis.riskAssessment?.overallRiskLevel && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-[#d5d8df]">Risk Level:</span>
                        <span className={`text-sm font-medium ${getRiskColor(analysis.riskAssessment.overallRiskLevel)}`}>
                          {analysis.riskAssessment.overallRiskLevel.split(' ')[0].split('-')[0].trim()}
                        </span>
                      </div>
                    )}

                    {(() => {
                      const strategicRecommendation =
                        (analysis as unknown as { strategicRecommendation?: string | null }).strategicRecommendation ??
                        analysis.strategicRecommendations?.goNoGoRecommendation
                      const reasoning =
                        analysis.strategicRecommendations?.reasoning ||
                        (analysis as unknown as { strategicRecommendationReason?: string }).strategicRecommendationReason

                      if (!strategicRecommendation) {
                        return null
                      }

                      return (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-[#d5d8df]">Recommendation:</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRecommendationColor(
                              strategicRecommendation
                            )}`}
                            title={reasoning || undefined}
                          >
                            {strategicRecommendation}
                          </span>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Metadata */}
                  <div className="border-t pt-2 text-xs text-gray-500 dark:text-[#9699a6]">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={(e) => handleDeleteAnalysis(analysis.id, e)}
                        disabled={deleting === analysis.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1"
                        title="Delete analysis"
                      >
                        {deleting === analysis.id ? (
                          <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                      <span>By: {analysis.submittedBy}</span>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

export default AnalysisList

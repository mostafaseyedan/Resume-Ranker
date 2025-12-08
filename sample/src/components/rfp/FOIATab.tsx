import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import apiClient from '@/services/apiClient'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { FOIAAnalysis } from '@/types/analysis'
import { extractProvider, getProviderDetails } from '@/utils/providerBadges'

interface FOIATabProps {
  rfpId: string
}

const FOIATab = ({ rfpId }: FOIATabProps) => {
  const [analyses, setAnalyses] = useState<FOIAAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAnalysis, setSelectedAnalysis] = useState<FOIAAnalysis | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadAnalyses()
  }, [rfpId])

  useEffect(() => {
    const handleAnalysisComplete = () => {
      console.log('FOIA analysis complete event received, reloading analyses...')
      loadAnalyses()
    }

    window.addEventListener('foia-analysis-complete', handleAnalysisComplete)
    return () => {
      window.removeEventListener('foia-analysis-complete', handleAnalysisComplete)
    }
  }, [rfpId])

  const loadAnalyses = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/foia-analyses', {
        params: { rfpId: rfpId }
      })

      setAnalyses(response.data.analyses || [])
    } catch (err: any) {
      console.error('Failed to load FOIA analyses:', err)
      setError(err.response?.data?.error || err.message || 'Failed to load FOIA analyses')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAnalysis = (analysis: FOIAAnalysis) => {
    setSelectedAnalysis(analysis)
  }

  const handleBackToList = () => {
    setSelectedAnalysis(null)
  }

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A'

    try {
      // Handle Firestore Timestamp
      if (dateValue._seconds || dateValue.seconds) {
        const seconds = dateValue._seconds || dateValue.seconds
        return new Date(seconds * 1000).toLocaleDateString()
      }

      // Handle ISO string
      if (typeof dateValue === 'string') {
        return new Date(dateValue).toLocaleDateString()
      }

      // Handle Date object
      if (dateValue instanceof Date) {
        return dateValue.toLocaleDateString()
      }

      return 'N/A'
    } catch {
      return 'N/A'
    }
  }

  const handleDeleteAnalysis = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    toast('Are you sure you want to delete this FOIA analysis?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            setDeleting(analysisId)
            await apiClient.delete(`/foia-analysis/${analysisId}`)
            toast.success('FOIA analysis deleted successfully')
            if (selectedAnalysis?.id === analysisId) {
              setSelectedAnalysis(null)
            }
            loadAnalyses()
          } catch (error: any) {
            console.error('Failed to delete FOIA analysis:', error)
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
        onClick: () => {}
      }
    })
  }

  const renderAnalysisDetail = (analysis: FOIAAnalysis) => {
    const cendienFound = analysis.detectionResult?.cendienProposalFound
    const fileNames = analysis.metadata?.fileNames || []
    const primaryFile = fileNames[0] || 'FOIA Analysis'
    const secondaryFiles = fileNames.slice(1)
    const additionalFilesCount = secondaryFiles.length
    const providerDetails = getProviderDetails(extractProvider(analysis))

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">{primaryFile}</h2>
            {additionalFilesCount > 0 && (
              <div className="mt-2 text-xs text-gray-600 dark:text-[#9699a6]">
                <span
                  className="font-medium cursor-help"
                  title={secondaryFiles.join('\n')}
                >
                  {additionalFilesCount} Additional File{additionalFilesCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          <img
            src={providerDetails.image}
            alt={`${providerDetails.label} badge`}
            className={`${providerDetails.iconClass} object-contain ${providerDetails.label === 'ChatGPT' ? 'dark:invert' : ''}`}
            title={providerDetails.description}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {cendienFound && analysis.overallInsights?.cendienScore && (
            <div className="rounded border border-blue-100 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">Cendien Score</div>
              <div className="text-base font-semibold text-blue-900 dark:text-blue-300">
                {analysis.overallInsights.cendienScore}
              </div>
            </div>
          )}
          <div className="rounded border border-gray-200 dark:border-[#4b4e69] px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-[#9699a6]">Total Bidders</div>
            <div className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">
              {analysis.overallInsights?.totalBidders || 0}
            </div>
          </div>
          {analysis.overallInsights?.winnerScore != null && (
            <div className="rounded border border-green-100 dark:border-green-700 bg-green-50 dark:bg-green-900/30 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-green-700 dark:text-green-300">Winner Score</div>
              <div className="text-base font-semibold text-green-900 dark:text-green-300">
                {analysis.overallInsights.winnerScore}
              </div>
            </div>
          )}
        </div>

        {analysis.overallInsights?.keyTakeaways && analysis.overallInsights.keyTakeaways.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-3">
            <h3 className="text-base font-semibold text-blue-900 dark:text-blue-300 mb-3">Key Takeaways</h3>
            <div className="prose prose-sm max-w-none text-blue-800 dark:text-blue-300 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {analysis.overallInsights.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {analysis.pricingComparison && (
          <div className="space-y-3">
            {analysis.pricingComparison.winnerPricing && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded p-3">
                <h3 className="text-base font-semibold text-green-900 dark:text-green-300 mb-2">Winner Pricing</h3>
                <div className="text-base font-bold text-green-700 dark:text-green-300 mb-2">
                  {analysis.pricingComparison.winnerPricing.total || 'N/A'}
                </div>
                {analysis.pricingComparison.winnerPricing.breakdown && (
                  <div className="prose prose-sm max-w-none text-green-900 dark:text-green-300 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis.pricingComparison.winnerPricing.breakdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {cendienFound && analysis.pricingComparison.cendienPricing && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-3">
                <h3 className="text-base font-semibold text-blue-900 dark:text-blue-300 mb-2">Cendien Pricing</h3>
                <div className="text-base font-bold text-blue-700 dark:text-blue-300 mb-2">
                  {analysis.pricingComparison.cendienPricing.total}
                </div>
                {analysis.pricingComparison.cendienPricing.breakdown && (
                  <div className="prose prose-sm max-w-none text-blue-900 dark:text-blue-300 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis.pricingComparison.cendienPricing.breakdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {analysis.pricingComparison.analysis && (
              <div className="border border-gray-200 dark:border-[#4b4e69] rounded p-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df] mb-2">Pricing Analysis</h3>
                <div className="prose prose-sm max-w-none text-sm dark:text-[#d5d8df]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {analysis.pricingComparison.analysis}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {analysis.technicalApproach && (
          <div className="border border-gray-200 dark:border-[#4b4e69] rounded p-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df] mb-3">Technical Approach</h3>
            <div className="prose prose-sm max-w-none space-y-3 text-sm">
              {analysis.technicalApproach.winnerApproach && (
                <div>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {analysis.technicalApproach.winnerApproach}
                  </ReactMarkdown>
                </div>
              )}
              {cendienFound && analysis.technicalApproach.cendienApproach && (
                <div className="pt-3 border-t border-gray-200 dark:border-[#4b4e69]">
                  <p className="text-sm font-semibold text-gray-700 dark:text-[#d5d8df] mb-2">Comparison with Cendien</p>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {analysis.technicalApproach.cendienApproach}
                  </ReactMarkdown>
                </div>
              )}
              {analysis.technicalApproach.keyDifferences && analysis.technicalApproach.keyDifferences.length > 0 && (
                <div className="pt-3 border-t border-gray-200 dark:border-[#4b4e69]">
                  <p className="text-sm font-semibold text-gray-700 dark:text-[#d5d8df] mb-2">Key Differences</p>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.technicalApproach.keyDifferences.map((diff, idx) => (
                      <li key={idx}>{diff}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {analysis.winLossFactors && (
          <div className="border border-gray-200 dark:border-[#4b4e69] rounded p-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df] mb-3">Competitive Analysis</h3>
            <div className="prose prose-sm max-w-none space-y-3 text-sm">
              {analysis.winLossFactors.whyWinnerWon && analysis.winLossFactors.whyWinnerWon.length > 0 && (
                <div>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.winLossFactors.whyWinnerWon.map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cendienFound && analysis.winLossFactors.whyCendienLost && analysis.winLossFactors.whyCendienLost.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Areas Where Cendien Fell Short</p>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.winLossFactors.whyCendienLost.map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {analysis.recommendations && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-3">
            <h3 className="text-base font-semibold text-blue-900 dark:text-blue-300 mb-3">Recommendations</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300 text-sm">
              {analysis.recommendations.improvementAreas && analysis.recommendations.improvementAreas.length > 0 &&
                analysis.recommendations.improvementAreas.map((area, i) => (
                  <li key={`improve-${i}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props: any) => <span {...props} /> }}>
                      {area}
                    </ReactMarkdown>
                  </li>
                ))
              }
              {analysis.recommendations.strengthsToLeverage && analysis.recommendations.strengthsToLeverage.length > 0 &&
                analysis.recommendations.strengthsToLeverage.map((strength, i) => (
                  <li key={`strength-${i}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props: any) => <span {...props} /> }}>
                      {strength}
                    </ReactMarkdown>
                  </li>
                ))
              }
              {analysis.recommendations.strategicActions && analysis.recommendations.strategicActions.length > 0 &&
                analysis.recommendations.strategicActions.map((action, i) => (
                  <li key={`action-${i}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props: any) => <span {...props} /> }}>
                      {action}
                    </ReactMarkdown>
                  </li>
                ))
              }
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading FOIA analyses...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadAnalyses}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Retry
        </button>
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-base font-medium text-gray-900 dark:text-[#d5d8df] mb-2">No FOIA Analyses Yet</h3>
        <p className="text-gray-500 dark:text-[#9699a6] mb-4">
          Analyze FOIA response files from the Files tab to extract competitive intelligence.
        </p>
      </div>
    )
  }

  if (selectedAnalysis) {
    return (
      <div className="flex flex-col">
        <div className="border-b border-gray-200 dark:border-[#4b4e69] px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBackToList}
            className="text-sm text-gray-700 dark:text-[#d5d8df] hover:text-primary flex items-center gap-2 font-medium transition-colors"
          >
            <span>←</span>
            <span>All FOIA Analyses</span>
          </button>

          <div className="text-sm text-gray-600 dark:text-[#9699a6]">
            {selectedAnalysis.analyzedBy || 'Unknown'}
          </div>
        </div>

        <div className="px-4 py-6">
          {renderAnalysisDetail(selectedAnalysis)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="space-y-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-normal text-gray-900 dark:text-[#d5d8df]">
            FOIA Analyses ({analyses.length})
          </h3>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {analyses.map((analysis) => {
          const cendienFound = analysis.detectionResult?.cendienProposalFound
          const providerDetails = getProviderDetails(extractProvider(analysis))

          return (
            <div
              key={analysis.id}
              onClick={() => handleSelectAnalysis(analysis)}
              className="bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#797e93] rounded-lg p-4 transition-shadow hover:shadow-lg cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-[#d5d8df] truncate">
                    {analysis.overallInsights?.winnerName || 'FOIA Analysis'}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                    {formatDate(analysis.createdAt)}
                  </p>
                  {analysis.metadata?.fileNames && analysis.metadata.fileNames.length > 1 && (
                    <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                      + {analysis.metadata.fileNames.length - 1} additional file{analysis.metadata.fileNames.length - 1 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <img
                  src={providerDetails.image}
                  alt={`${providerDetails.label} badge`}
                  className={`${providerDetails.iconClass} object-contain ${providerDetails.label === 'ChatGPT' ? 'dark:invert' : ''}`}
                  title={providerDetails.description}
                />
              </div>

              {/* Summary Metrics */}
              <div className="mt-3 space-y-1">
                {cendienFound && analysis.overallInsights?.cendienScore && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-[#d5d8df]">Cendien Score</span>
                    <span className="text-sm font-semibold text-primary dark:text-[#69a7ef]">
                      {analysis.overallInsights.cendienScore}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-[#d5d8df]">Total Bidders</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-[#d5d8df]">
                    {analysis.overallInsights?.totalBidders || 0}
                  </span>
                </div>
                {cendienFound && (
                  <div className="flex items-center justify-end">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      Cendien Included
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-[#4b4e69] pt-2 text-xs text-gray-500 dark:text-[#9699a6]">
                <div className="flex items-center gap-2">
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
                  <span>By: {analysis.analyzedBy || 'Unknown'}</span>
                </div>
                <span>{formatDate(analysis.createdAt)}</span>
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

export default FOIATab

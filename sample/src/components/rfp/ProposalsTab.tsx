import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import apiClient from '@/services/apiClient'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ProposalReview } from '@/types/analysis'
import { extractProvider, getProviderDetails } from '@/utils/providerBadges'

interface Proposal {
  id: string
  proposalTitle: string
  proposalType: string
  submittedBy: string
  generatedDate: string
  status: string
  createdAt?: any
}

interface ProposalsTabProps {
  rfpId: string
}

const ProposalsTab = ({ rfpId }: ProposalsTabProps) => {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ProposalReview[]>([])
  const [selectedReview, setSelectedReview] = useState<ProposalReview | null>(null)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  useEffect(() => {
    loadProposals()
    loadReviews()
  }, [rfpId])

  useEffect(() => {
    const handleReviewComplete = () => {
      console.log('Review complete event received, reloading reviews...')
      loadReviews()
    }

    window.addEventListener('proposal-review-complete', handleReviewComplete)
    return () => {
      window.removeEventListener('proposal-review-complete', handleReviewComplete)
    }
  }, [rfpId])

  const loadProposals = async () => {
    try {
      setLoading(true)
      setError(null)

      // Note: Backend doesn't have a generated proposals endpoint yet
      // For now, we only show proposal reviews which are available
      // TODO: Implement /api/generated-proposals endpoint when proposal generation is added
      setProposals([])
    } catch (err: any) {
      console.error('Failed to load proposals:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load proposals'
      setError(errorMsg)
      toast.error('Failed to load proposals', {
        description: errorMsg
      })
    } finally {
      setLoading(false)
    }
  }

  const loadReviews = async () => {
    try {
      const response = await apiClient.get('/proposal-reviews', {
        params: { rfpId: rfpId }
      })

      setReviews(response.data.reviews || [])
    } catch (err: any) {
      console.error('Failed to load reviews:', err)
      // Don't show error toast for reviews - they're optional
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-700'
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700'
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-700'
  }

  const getScoreTextColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 dark:text-green-300'
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-300'
    return 'text-red-600 dark:text-red-300'
  }

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A'

    try {
      // Handle Firestore Timestamp
      if (dateValue._seconds || dateValue.seconds) {
        const seconds = dateValue._seconds || dateValue.seconds
        return new Date(seconds * 1000).toLocaleString()
      }

      // Handle ISO string
      if (typeof dateValue === 'string') {
        return new Date(dateValue).toLocaleString()
      }

      // Handle Date object
      if (dateValue instanceof Date) {
        return dateValue.toLocaleString()
      }

      return 'N/A'
    } catch {
      return 'N/A'
    }
  }

  const handleSelectReview = (review: ProposalReview) => {
    setSelectedReview(review)
  }

  const handleBackToReviews = () => {
    setSelectedReview(null)
  }

  const handleDeleteReview = async (reviewId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    toast('Delete this proposal review?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            setDeletingReviewId(reviewId)
            await apiClient.delete(`/proposal-review/${reviewId}`)
            toast.success('Review deleted successfully')
            if (selectedReview?.id === reviewId) {
              setSelectedReview(null)
            }
            loadReviews()
          } catch (error: any) {
            console.error('Failed to delete proposal review:', error)
            toast.error('Failed to delete review', {
              description: error.response?.data?.error || error.message
            })
          } finally {
            setDeletingReviewId(null)
          }
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => { }
      }
    })
  }

  const inlineMarkdownComponents = {
    p: (props: any) => <span {...props} />
  }

  // Consistent card styling matching analysis tab cards
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  // Helper for card classes to ensure consistency
  const cardClasses = "bg-white dark:bg-[#30324e] border border-gray-200 dark:border-[#797e93] rounded-lg p-4 hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-500 dark:hover:border-green-500 cursor-pointer transition-colors"

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  }
  const cardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    fontSize: '14px',
    color: isDark ? '#d5d8df' : '#333'
  }
  const cardBodyTextStyle: React.CSSProperties = {
    padding: 0,
    margin: 0,
    fontSize: '14px',
    color: isDark ? '#d5d8df' : '#555'
  }

  const renderReviewDetail = (review: ProposalReview) => {
    return (
      <div className="space-y-6">


        {/* Score Summary badges (separate cards) */}
        <div className={cardClasses.replace('hover:bg-green-50', '').replace('cursor-pointer', '')}>
          <div style={cardHeaderStyle}>
            <h5 style={cardTitleStyle}>Score Summary</h5>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ marginTop: 4 }}>
            <div className={`px-1 py-2 rounded-lg border text-center ${getScoreColor(review.overallScore)}`}>
              <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Overall Score</div>
              <div className="text-base font-bold">{review.overallScore}%</div>
            </div>
            <div className={`px-1 py-2 rounded-lg border text-center ${getScoreColor(review.scoreBreakdown.completeness)}`}>
              <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Completeness</div>
              <div className="text-base font-bold">{review.scoreBreakdown.completeness}%</div>
            </div>
            <div className={`px-1 py-2 rounded-lg border text-center ${getScoreColor(review.scoreBreakdown.compliance)}`}>
              <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Compliance</div>
              <div className="text-base font-bold">{review.scoreBreakdown.compliance}%</div>
            </div>
            <div className={`px-1 py-2 rounded-lg border text-center ${getScoreColor(review.scoreBreakdown.quality)}`}>
              <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Quality</div>
              <div className="text-base font-bold">{review.scoreBreakdown.quality}%</div>
            </div>
          </div>
        </div>

        {review.strengths && review.strengths.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded p-3 text-sm">
            <h3 className="text-base font-semibold text-green-900 dark:text-green-300 mb-2">Strengths</h3>
            <ul className="list-disc list-inside space-y-1 text-green-800 dark:text-green-300">
              {review.strengths.map((strength, index) => (
                <li key={index}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={inlineMarkdownComponents}
                  >
                    {strength}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        )}

        {review.riskFlags && review.riskFlags.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm">
            <h3 className="text-base font-semibold text-red-900 dark:text-red-300 mb-2">Critical Issues</h3>
            <ul className="list-disc list-inside space-y-1 text-red-800 dark:text-red-300">
              {review.riskFlags.map((flag, index) => (
                <li key={index}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={inlineMarkdownComponents}
                  >
                    {flag}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        )}

        {review.completenessAnalysis && (
          <div className={cardClasses.replace('hover:bg-green-50', '').replace('cursor-pointer', '')}>
            <div style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Completeness Analysis</h5>
            </div>
            <div className="markdown-content prose prose-sm max-w-none" style={cardBodyTextStyle}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {review.completenessAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {review.complianceIssues && review.complianceIssues.length > 0 && (
          <div className={cardClasses.replace('hover:bg-green-50', '').replace('cursor-pointer', '')}>
            <div style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Compliance Issues</h5>
            </div>
            <div style={cardBodyTextStyle}>
              <ul style={{ paddingLeft: 18, margin: 0, listStyle: 'disc' }}>
                {review.complianceIssues.map((issue, index) => (
                  <li key={index}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={inlineMarkdownComponents}>
                      {issue}
                    </ReactMarkdown>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {review.qualityAssessment && (
          <div className={cardClasses.replace('hover:bg-green-50', '').replace('cursor-pointer', '')}>
            <div style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Quality Assessment</h5>
            </div>
            <div className="prose prose-sm max-w-none" style={cardBodyTextStyle}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {review.qualityAssessment}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {review.cendienCompatibility && (
          <div className={cardClasses.replace('hover:bg-green-50', '').replace('cursor-pointer', '')}>
            <div style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Cendien Alignment</h5>
            </div>
            <div className="prose prose-sm max-w-none" style={cardBodyTextStyle}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {review.cendienCompatibility}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {review.recommendations && review.recommendations.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-3 text-sm">
            <h3 className="text-base font-semibold text-blue-900 dark:text-blue-300 mb-2">Recommendations</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
              {review.recommendations.map((rec, index) => (
                <li key={index}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={inlineMarkdownComponents}
                  >
                    {rec}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading proposals...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadProposals}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-[#0060b9]"
        >
          Retry
        </button>
      </div>
    )
  }

  // Show reviews even if there are no proposals
  const hasContent = proposals.length > 0 || reviews.length > 0

  if (!hasContent) {
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
        <h3 className="text-base font-medium text-gray-900 dark:text-[#d5d8df] mb-2">No Content Yet</h3>
        <p className="text-gray-500 dark:text-[#9699a6]">
          Proposals and reviews for this RFP will appear here.
        </p>
      </div>
    )
  }

  if (selectedReview) {
    const fileNames = selectedReview.metadata?.fileNames || []
    const primaryFile = fileNames[0] || 'Proposal Review'
    const secondaryFiles = fileNames.slice(1)
    const additionalFilesCount = secondaryFiles.length
    const providerDetails = getProviderDetails(extractProvider(selectedReview))

    return (
      <div className="flex flex-col">
        {/* Top context bar */}
        <div className="border-b border-gray-200 dark:border-[#4b4e69] px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBackToReviews}
            className="text-sm text-gray-700 dark:text-[#d5d8df] hover:text-primary flex items-center gap-2 font-medium transition-colors"
          >
            <span>←</span>
            <span>All Proposal Reviews</span>
          </button>

          <div className="text-sm text-gray-600 dark:text-[#9699a6]">
            {selectedReview.reviewedBy}
          </div>
        </div>

        {/* File names header (match AnalysisTab) */}
        <div className="border-b border-gray-200 dark:border-[#4b4e69] px-4 py-3 flex items-start justify-between gap-3">
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

        <div className="px-4 py-6">
          {renderReviewDetail(selectedReview)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="space-y-5">
        {/* Proposals Section - only show if we have proposals */}
        {proposals.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-normal text-gray-900">
                {proposals.length} Proposal{proposals.length !== 1 ? 's' : ''}
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className={cardClasses}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {proposal.proposalTitle}
                      </h4>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <span className="inline-flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          {proposal.submittedBy}
                        </span>

                        <span className="inline-flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          {formatDate(proposal.createdAt || proposal.generatedDate)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {proposal.proposalType}
                        </span>

                        {proposal.status && (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${proposal.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : proposal.status === 'in-progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {proposal.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4">
                      <button
                        onClick={() => {
                          // Open proposal in new tab/modal - to be implemented
                          window.open(`/proposal.html?id=${proposal.id}`, '_blank')
                        }}
                        className="px-3 py-1 text-sm text-primary hover:text-[#0060b9] hover:bg-blue-50 rounded transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div>
            <h3 className="text-sm font-normal text-gray-900 dark:text-[#d5d8df] mb-4">
              Proposal Reviews ({reviews.length})
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => {
                const primaryFile = review.metadata?.fileNames?.[0] || 'Proposal Review'
                const providerDetails = getProviderDetails(extractProvider(review))

                return (
                  <div
                    key={review.id}
                    onClick={() => handleSelectReview(review)}
                    className={cardClasses}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-[#d5d8df] truncate">{primaryFile}</h4>
                        <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                          {formatDate(review.createdAt)}
                        </p>
                        {review.metadata?.fileNames && review.metadata.fileNames.length > 1 && (
                          <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-1">
                            + {review.metadata.fileNames.length - 1} additional file{review.metadata.fileNames.length - 1 > 1 ? 's' : ''}
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
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getScoreColor(review.overallScore)}`}
                        >
                          {review.overallScore}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex items-center justify-between text-gray-600 dark:text-[#d5d8df]">
                        <span>Completeness</span>
                        <span className={`font-semibold ${getScoreTextColor(review.scoreBreakdown.completeness)}`}>
                          {review.scoreBreakdown.completeness}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 dark:text-[#d5d8df]">
                        <span>Compliance</span>
                        <span className={`font-semibold ${getScoreTextColor(review.scoreBreakdown.compliance)}`}>
                          {review.scoreBreakdown.compliance}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 dark:text-[#d5d8df]">
                        <span>Quality</span>
                        <span className={`font-semibold ${getScoreTextColor(review.scoreBreakdown.quality)}`}>
                          {review.scoreBreakdown.quality}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 dark:text-[#d5d8df]">
                        <span>Cendien Alignment</span>
                        <span className={`font-semibold ${getScoreTextColor(review.scoreBreakdown.cendienAlignment)}`}>
                          {review.scoreBreakdown.cendienAlignment}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#4b4e69] pt-2 text-xs text-gray-500 dark:text-[#9699a6]">
                      <button
                        onClick={(e) => handleDeleteReview(review.id, e)}
                        disabled={deletingReviewId === review.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1"
                        title="Delete review"
                      >
                        {deletingReviewId === review.id ? (
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
                      <span className="ml-auto">By: {review.reviewedBy}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProposalsTab

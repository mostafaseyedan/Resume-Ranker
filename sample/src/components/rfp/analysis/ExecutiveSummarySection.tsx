import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ExecutiveSummary } from '@/types/analysis'

interface ExecutiveSummarySectionProps {
  data?: ExecutiveSummary
}

const ExecutiveSummarySection = ({ data }: ExecutiveSummarySectionProps) => {
  if (!data) {
    return <div className="no-data">No executive summary available</div>
  }

  // Consistent card styling matching old design
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const cardStyle = {
    border: `1px solid ${isDark ? '#797e93' : '#ddd'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    background: isDark ? '#292f4c' : 'white',
    boxShadow: isDark ? '0 1px 2px rgba(9,11,25,0.5)' : '0 2px 4px rgba(0,0,0,0.1)'
  }

  const cardHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  }

  const cardTitleStyle = {
    margin: 0,
    fontWeight: 600,
    color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#333'
  }

  const cardBodyStyle = {
    padding: 0,
    margin: 0,
    fontSize: '14px',
    color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#555'
  }

  // Determine recommendation styling
  const recommendation = data.recommendedAction || 'Not specified'
  const normalizedRecommendation = recommendation.toLowerCase()
  let recommendationStyle = isDark
    ? 'background: #292f4c; border: 1px solid #4b4e69; color: #d5d8df;'
    : 'background: #f8f9fa; border: 1px solid #e2e8f0; color: #555;'

  if (normalizedRecommendation.includes('conditional')) {
    recommendationStyle = isDark
      ? 'background: rgba(234,179,8,0.15); border: 1px solid #854d0e; color: #fde68a;'
      : 'background: #fffaf0; border: 1px solid #fbd38d; color: #744210;'
  } else if (normalizedRecommendation.includes('no-go')) {
    recommendationStyle = isDark
      ? 'background: rgba(220,38,38,0.2); border: 1px solid #7f1d1d; color: #fca5a5;'
      : 'background: #fff5f5; border: 1px solid #feb2b2; color: #742a2a;'
  } else if (normalizedRecommendation.includes('go')) {
    recommendationStyle = isDark
      ? 'background: rgba(16,185,129,0.15); border: 1px solid #065f46; color: #86efac;'
      : 'background: #f0fff4; border: 1px solid #9ae6b4; color: #22543d;'
  }

  const concernsStyle = isDark
    ? 'padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.5; background: rgba(220,38,38,0.2); border: 1px solid #7f1d1d; color: #fca5a5;'
    : 'padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.5; background: #fff5f5; border: 1px solid #feb2b2; color: #742a2a;'
  const opportunitiesStyle = isDark
    ? 'padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.5; background: rgba(16,185,129,0.15); border: 1px solid #065f46; color: #86efac;'
    : 'padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.5; background: #f0fff4; border: 1px solid #9ae6b4; color: #22543d;'

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {/* Project Overview */}
        {data.projectOverview && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>RFP Overview</h5>
            </div>
            <div className="card-body markdown-content" style={cardBodyStyle}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.projectOverview}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Recommended Action */}
        {data.recommendedAction && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Recommended Action</h5>
            </div>
            <div className="card-body" style={{ padding: '12px', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', ...Object.fromEntries(recommendationStyle.split(';').map(s => s.trim()).filter(Boolean).map(s => s.split(':').map(p => p.trim()))) }}>
              <div style={{ margin: 0 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {recommendation}
                </ReactMarkdown>
              </div>
              {data.recommendationReasoning && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#2d3748' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.recommendationReasoning}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Estimated Value */}
        {data.estimatedValue && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Estimated Value</h5>
            </div>
            <div className="card-body markdown-content" style={cardBodyStyle}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.estimatedValue}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Timeline */}
        {data.timeframe && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Timeline</h5>
            </div>
            <div className="card-body markdown-content" style={cardBodyStyle}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.timeframe}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Critical Concerns */}
        {data.criticalConcerns && data.criticalConcerns.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Critical Concerns</h5>
            </div>
                <div className="card-body" style={Object.fromEntries(concernsStyle.split(';').map(s => s.trim()).filter(Boolean).map(s => s.split(':').map(p => p.trim())))}>
                  <ul style={{ paddingLeft: '18px', margin: 0, listStyle: 'disc' }}>
                    {data.criticalConcerns.map((concern, i) => (
                      <li key={i}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {concern}
                        </ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
          </div>
        )}

        {/* Key Opportunities */}
        {data.keyOpportunities && data.keyOpportunities.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Key Opportunities</h5>
            </div>
                <div className="card-body" style={Object.fromEntries(opportunitiesStyle.split(';').map(s => s.trim()).filter(Boolean).map(s => s.split(':').map(p => p.trim())))}>
                  <ul style={{ paddingLeft: '18px', margin: 0, listStyle: 'disc' }}>
                    {data.keyOpportunities.map((opportunity, i) => (
                      <li key={i}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {opportunity}
                        </ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
        )}
      </div>
    </div>
  )
}

export default ExecutiveSummarySection

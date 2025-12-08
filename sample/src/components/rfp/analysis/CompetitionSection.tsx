import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CompetitiveLandscape } from '@/types/analysis'

interface CompetitionSectionProps {
  data?: CompetitiveLandscape
}

const CompetitionSection = ({ data }: CompetitionSectionProps) => {
  console.log('[CompetitionSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No competitive landscape information available</div>
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${isDark ? '#797e93' : '#ddd'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    background: isDark ? '#292f4c' : 'white',
    boxShadow: isDark ? '0 1px 2px rgba(9,11,25,0.5)' : '0 2px 4px rgba(0,0,0,0.1)',
  }

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  }

  const cardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    color: isDark ? '#d5d8df' : '#333',
  }

  const highlightStyles = {
    info: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? '#292f4c' : '#ebf8ff',
      border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}`,
      color: isDark ? '#d5d8df' : '#1a365d',
      fontSize: '14px',
      lineHeight: 1.6,
    } as React.CSSProperties,
    success: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
      border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`,
      color: isDark ? '#86efac' : '#22543d',
      fontSize: '14px',
      lineHeight: 1.6,
    } as React.CSSProperties,
    warning: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
      border: `1px solid ${isDark ? '#854d0e' : '#fbd38d'}`,
      color: isDark ? '#fde68a' : '#744210',
      fontSize: '14px',
      lineHeight: 1.6,
    } as React.CSSProperties,
    danger: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(220,38,38,0.2)' : '#fff5f5',
      border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`,
      color: isDark ? '#fca5a5' : '#742a2a',
      fontSize: '14px',
      lineHeight: 1.6,
    } as React.CSSProperties,
    neutral: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? '#292f4c' : '#f8f9fa',
      border: `1px solid ${isDark ? '#4b4e69' : '#e2e8f0'}`,
      color: isDark ? '#d5d8df' : '#555',
      fontSize: '14px',
      lineHeight: 1.6,
    } as React.CSSProperties,
  }

  const listStyle: React.CSSProperties = {
    paddingLeft: '18px',
    margin: 0,
    listStyle: 'disc',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  }

  const renderInlineMarkdown = (value?: string) => {
    if (!value) return null
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <span style={{ margin: 0 }}>{children}</span>,
        }}
      >
        {value}
      </ReactMarkdown>
    )
  }

  const renderListItem = (value: string, key: number) => (
    <li key={key}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <span style={{ margin: 0 }}>{children}</span>,
        }}
      >
        {value}
      </ReactMarkdown>
    </li>
  )

  const competitors = Array.isArray(data.likelyCompetitors) ? data.likelyCompetitors.filter(Boolean) : []
  const advantages = Array.isArray(data.cendienAdvantages) ? data.cendienAdvantages.filter(Boolean) : []
  const competitiveRisks = Array.isArray(data.competitiveRisks) ? data.competitiveRisks.filter(Boolean) : []

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {advantages.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Cendien Advantages</h5>
            </div>
            <div className="card-body" style={highlightStyles.success}>
              <ul style={listStyle}>
                {advantages.map((item, index) => renderListItem(item, index))}
              </ul>
            </div>
          </div>
        )}

        {competitors.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Key Competitors</h5>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {competitors.map((competitor, index) => {
                if (!competitor) return null
                const name = competitor.competitor || competitor.name || `Competitor ${index + 1}`
                const strengths = Array.isArray(competitor.strengths) ? competitor.strengths.filter(Boolean) : []
                const weaknesses = Array.isArray(competitor.weaknesses) ? competitor.weaknesses.filter(Boolean) : []

                return (
                  <div key={index} style={highlightStyles.info}>
                    <div style={{ fontWeight: 600, color: isDark ? '#d5d8df' : '#1a202c', marginBottom: '6px' }}>{name}</div>
                    {competitor.winProbability && (
                      <div style={{ fontSize: '13px', color: isDark ? '#d5d8df' : '#4a5568', marginBottom: '6px' }}>
                        <strong>Win Probability:</strong>{' '}
                        {renderInlineMarkdown(competitor.winProbability)}
                      </div>
                    )}
                    {competitor.notes && (
                      <div style={{ fontSize: '13px', color: isDark ? '#d5d8df' : '#4a5568', marginBottom: '6px' }}>
                        <strong>Notes:</strong> {renderInlineMarkdown(competitor.notes)}
                      </div>
                    )}
                    {strengths.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong>Strengths</strong>
                        <ul style={{ ...listStyle, marginTop: '4px' }}>
                          {strengths.map((item, idx) => renderListItem(item, idx))}
                        </ul>
                      </div>
                    )}
                    {weaknesses.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong>Weaknesses</strong>
                        <ul style={{ ...listStyle, marginTop: '4px' }}>
                          {weaknesses.map((item, idx) => renderListItem(item, idx))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {competitiveRisks.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Competitive Risks</h5>
            </div>
            <div className="card-body" style={highlightStyles.warning}>
              <ul style={listStyle}>
                {competitiveRisks.map((risk, index) => renderListItem(risk, index))}
              </ul>
            </div>
          </div>
        )}

        {data.marketPosition && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Market Position</h5>
            </div>
            <div className="card-body" style={highlightStyles.info}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.marketPosition}</ReactMarkdown>
            </div>
          </div>
        )}

        {data.winStrategy && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Win Strategy</h5>
            </div>
            <div className="card-body" style={highlightStyles.success}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.winStrategy}</ReactMarkdown>
            </div>
          </div>
        )}

        {data.competitiveScoring && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Competitive Scoring</h5>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {[
                { label: 'Cendien Score', value: data.competitiveScoring.cendienScore, tone: 'success' as const },
                { label: 'Average Competitor', value: data.competitiveScoring.avgCompetitorScore, tone: 'neutral' as const },
                { label: 'Cendien Position', value: data.competitiveScoring.cendienPosition, tone: 'info' as const },
              ]
                .filter((metric) => metric.value)
                .map((metric) => (
                  <div key={metric.label} style={highlightStyles[metric.tone]}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: isDark ? '#9699a6' : '#718096' }}>{metric.label}</div>
                    <div style={{ fontWeight: 600, color: isDark ? '#d5d8df' : '#1a202c', marginTop: '6px' }}>{metric.value}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!advantages.length &&
          !competitors.length &&
          !competitiveRisks.length &&
          !data.marketPosition &&
          !data.winStrategy &&
          !data.competitiveScoring && (
            <div className="requirement-card" style={cardStyle}>
              <div className="card-header" style={cardHeaderStyle}>
                <h5 style={cardTitleStyle}>Competitive Overview</h5>
              </div>
              <div className="card-body" style={highlightStyles.neutral}>
                No competitive landscape data available.
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

export default CompetitionSection

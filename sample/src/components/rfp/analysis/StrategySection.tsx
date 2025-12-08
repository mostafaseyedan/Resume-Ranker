import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import type { StrategicRecommendations } from '@/types/analysis'

interface StrategySectionProps {
  data?: StrategicRecommendations
}

const StrategySection = ({ data }: StrategySectionProps) => {
  console.log('[StrategySection] Received data:', data)

  if (!data) {
    return <div className="no-data">No strategic recommendations available</div>
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

  const cardBodyStyle: React.CSSProperties = {
    padding: 0,
    margin: 0,
    fontSize: '14px',
    color: isDark ? '#d5d8df' : '#555',
    lineHeight: 1.6,
  }

  const highlightStyles = {
    info: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? '#292f4c' : '#ebf8ff',
      border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}`,
      color: isDark ? '#d5d8df' : '#1a365d',
    } as React.CSSProperties,
    success: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
      border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`,
      color: isDark ? '#86efac' : '#22543d',
    } as React.CSSProperties,
    warning: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
      border: `1px solid ${isDark ? '#854d0e' : '#fbd38d'}`,
      color: isDark ? '#fde68a' : '#744210',
    } as React.CSSProperties,
    danger: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(220,38,38,0.2)' : '#fff5f5',
      border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`,
      color: isDark ? '#fca5a5' : '#742a2a',
    } as React.CSSProperties,
    neutral: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? '#292f4c' : '#f8f9fa',
      border: `1px solid ${isDark ? '#4b4e69' : '#e2e8f0'}`,
      color: isDark ? '#d5d8df' : '#555',
    } as React.CSSProperties,
  }

  const listStyle: React.CSSProperties = {
    paddingLeft: '18px',
    margin: 0,
    listStyle: 'disc',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '14px',
  }

  const renderListCard = (
    items: string[] | undefined,
    title: string,
    tone: keyof typeof highlightStyles,
  ) => {
    if (!items || items.length === 0) return null
    const cleanItems = items.filter(Boolean)
    if (cleanItems.length === 0) return null

    return (
      <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>{title}</h5>
        </div>
        <div className="card-body" style={highlightStyles[tone]}>
          <ul style={listStyle}>
            {cleanItems.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const recTone = (() => {
    const label = data.goNoGoRecommendation?.toLowerCase() || ''
    if (label.includes('no-go')) return 'danger'
    if (label.includes('go')) return 'success'
    if (label.includes('conditional') || label.includes('hold')) return 'warning'
    return 'neutral'
  })() as keyof typeof highlightStyles

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {(data.goNoGoRecommendation || data.reasoning) && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Executive Recommendation</h5>
            </div>
            <div className="card-body" style={highlightStyles[recTone]}>
              {data.goNoGoRecommendation && (
                <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: data.reasoning ? '8px' : 0 }}>
                  {data.goNoGoRecommendation}
                </div>
              )}
              {data.reasoning && (
                <div style={{ fontSize: '14px', color: isDark ? '#d5d8df' : '#1a202c' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {data.reasoning}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}

        {renderListCard(data.keyActions, 'Immediate Actions', 'info')}
        {renderListCard(data.successFactors, 'Critical Success Factors', 'success')}
        {renderListCard(data.alternativeStrategies, 'Alternative Strategies', 'neutral')}

        {(data.investmentLevel || data.timelineRecommendation) && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Investment & Timeline Guidance</h5>
            </div>
            <div className="card-body" style={cardBodyStyle}>
              {data.investmentLevel && (
                <div style={{ ...highlightStyles.warning, marginBottom: data.timelineRecommendation ? '12px' : 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Recommended Investment Level</div>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {data.investmentLevel}
                  </ReactMarkdown>
                </div>
              )}
              {data.timelineRecommendation && (
                <div style={highlightStyles.info}>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Timeline Recommendation</div>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {data.timelineRecommendation}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}

        {data.positioningStrategy && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Positioning Strategy</h5>
            </div>
            <div className="card-body" style={highlightStyles.neutral}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {data.positioningStrategy}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {data.pursuitFocus && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Pursuit Focus</h5>
            </div>
            <div className="card-body" style={highlightStyles.info}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {data.pursuitFocus}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {data.riskPosition && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Risk Posture</h5>
            </div>
            <div className="card-body" style={highlightStyles.danger}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {data.riskPosition}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {!data.goNoGoRecommendation &&
          !data.reasoning &&
          !(data.keyActions && data.keyActions.length) &&
          !(data.successFactors && data.successFactors.length) &&
          !(data.alternativeStrategies && data.alternativeStrategies.length) &&
          !data.investmentLevel &&
          !data.timelineRecommendation &&
          !data.positioningStrategy &&
          !data.pursuitFocus &&
          !data.riskPosition && (
            <div className="requirement-card" style={cardStyle}>
              <div className="card-header" style={cardHeaderStyle}>
                <h5 style={cardTitleStyle}>Strategic Guidance</h5>
              </div>
              <div className="card-body" style={highlightStyles.neutral}>
                No strategic recommendations available.
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

export default StrategySection

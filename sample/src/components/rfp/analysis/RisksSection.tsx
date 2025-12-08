import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { RiskAssessment } from '@/types/analysis'

interface RisksSectionProps {
  data?: RiskAssessment
}

const RisksSection = ({ data }: RisksSectionProps) => {
  console.log('[RisksSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No risk assessment available</div>
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${isDark ? '#797e93' : '#ddd'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    background: isDark ? '#292f4c' : 'white',
    boxShadow: isDark ? '0 1px 2px rgba(9,11,25,0.5)' : '0 2px 4px rgba(0,0,0,0.1)'
  }

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  }

  const cardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    color: isDark ? '#d5d8df' : '#333'
  }

  const cardBodyStyle: React.CSSProperties = {
    padding: 0,
    margin: 0,
    fontSize: '14px',
    color: isDark ? '#d5d8df' : '#555'
  }

  const highlightStyles = {
    danger: {
      padding: '12px',
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: 1.5,
      background: isDark ? 'rgba(220,38,38,0.2)' : '#fff5f5',
      border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`,
      color: isDark ? '#fca5a5' : '#742a2a',
    } as React.CSSProperties,
    warning: {
      padding: '12px',
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: 1.5,
      background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
      border: `1px solid ${isDark ? '#854d0e' : '#fbd38d'}`,
      color: isDark ? '#fde68a' : '#744210',
    } as React.CSSProperties,
    success: {
      padding: '12px',
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: 1.5,
      background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
      border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`,
      color: isDark ? '#86efac' : '#22543d',
    } as React.CSSProperties,
    info: {
      padding: '12px',
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: 1.5,
      background: isDark ? '#292f4c' : '#ebf8ff',
      border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}`,
      color: isDark ? '#d5d8df' : '#1a365d',
    } as React.CSSProperties,
  }

  const wrapHighlight = (content: React.ReactNode, tone: keyof typeof highlightStyles = 'info') => (
    <div style={highlightStyles[tone]}>{content}</div>
  )

  const riskBlockStyle: React.CSSProperties = {
    border: `1px solid ${isDark ? '#797e93' : '#e2e8f0'}`,
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '12px',
    background: isDark ? '#292f4c' : 'white',
    boxShadow: isDark ? '0 1px 2px rgba(9,11,25,0.5)' : '0 1px 2px rgba(0,0,0,0.05)',
  }

  const badgeBaseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    border: '1px solid transparent',
  }

  const detailHighlightStyle: React.CSSProperties = {
    padding: '12px',
    background: isDark ? '#30324e' : '#f8fafc',
    borderRadius: '6px',
    fontSize: '14px',
    lineHeight: 1.6,
    color: isDark ? '#d5d8df' : '#2d3748',
    borderLeft: `3px solid ${isDark ? '#69a7ef' : '#3182ce'}`,
    marginTop: '12px',
  }

  const severityStyles: Record<string, React.CSSProperties> = {
    high: {
      background: isDark ? 'rgba(220,38,38,0.2)' : '#fee',
      color: isDark ? '#fca5a5' : '#c53030',
      borderColor: isDark ? '#7f1d1d' : '#feb2b2',
    },
    medium: {
      background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
      color: isDark ? '#fde68a' : '#d69e2e',
      borderColor: isDark ? '#854d0e' : '#fbd38d',
    },
    low: {
      background: '#f0fff4',
      color: '#22543d',
      borderColor: '#9ae6b4',
    },
  }

  const resolveTone = (value?: string) => {
    if (!value) return 'info'
    const normalized = value.toLowerCase()
    if (normalized.includes('high')) return 'danger'
    if (normalized.includes('medium')) return 'warning'
    return 'success'
  }

  const getSeverityBadgeStyle = (label?: string) => {
    if (!label) return severityStyles.medium
    const key = label.toLowerCase()
    if (key.includes('high')) return severityStyles.high
    if (key.includes('low')) return severityStyles.low
    return severityStyles.medium
  }

  const renderRiskGroup = (risks: Array<Record<string, any>> | undefined, title: string) => {
    if (!risks || risks.length === 0) {
      return null
    }

    return (
      <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>{title}</h5>
        </div>
        <div
          className="card-body"
          style={{
            ...cardBodyStyle,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {risks.map((risk, index) => {
            const tone = resolveTone(risk.impact || risk.likelihood)
            const badgeStyle = getSeverityBadgeStyle(risk.impact)
            return (
              <div key={index} style={riskBlockStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ margin: 0, color: isDark ? '#d5d8df' : '#1a202c', fontWeight: 600, flex: 1 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{risk.risk || 'Risk'}</ReactMarkdown>
                  </div>
                  <span style={{ ...badgeBaseStyle, ...badgeStyle }}>{risk.impact || 'Medium'}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: isDark ? '#d5d8df' : '#4a5568',
                  }}
                >
                  {risk.likelihood && (
                    <div>
                      <strong>Likelihood:</strong>{' '}
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{ p: ({ children }) => <span style={{ margin: 0 }} className={""}>{children}</span> }}
                      >
                        {risk.likelihood}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {risk.mitigation && (
                  <div
                    style={{
                      ...detailHighlightStyle,
                      borderLeftColor:
                        tone === 'danger' ? '#c53030' : tone === 'warning' ? '#d69e2e' : tone === 'success' ? '#2f855a' : '#3182ce',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Mitigation</div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{risk.mitigation}</ReactMarkdown>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {data.overallRiskLevel && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Overall Risk Level</h5>
            </div>
            <div className="card-body" style={cardBodyStyle}>
              {wrapHighlight(
                <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.5 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.overallRiskLevel}</ReactMarkdown>
                </div>,
                resolveTone(data.overallRiskLevel) as keyof typeof highlightStyles,
              )}
            </div>
          </div>
        )}

        {renderRiskGroup(data.technicalRisks, 'Technical Risks')}
        {renderRiskGroup(data.businessRisks, 'Business Risks')}
        {renderRiskGroup(data.contractualRisks, 'Contractual Risks')}

        {data.riskScore !== undefined && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Risk Score</h5>
            </div>
            <div className="card-body" style={cardBodyStyle}>
              {wrapHighlight(
                <div style={{ fontSize: '16px', fontWeight: 700, textAlign: 'center' }}>
                  {data.riskScore} / 10
                  <div style={{ fontSize: '12px', fontWeight: 400, marginTop: '4px', opacity: 0.8 }}>
                    (10 = Highest Risk)
                  </div>
                </div>,
                data.riskScore >= 7 ? 'danger' : data.riskScore >= 4 ? 'warning' : 'success',
              )}
            </div>
          </div>
        )}

        {data.redFlags && data.redFlags.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Red Flags</h5>
            </div>
            <div className="card-body" style={highlightStyles.danger}>
              <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.redFlags.map((flag, index) => (
                  <li key={index}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{flag}</ReactMarkdown>
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

export default RisksSection

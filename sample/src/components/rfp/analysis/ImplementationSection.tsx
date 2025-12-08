import type { ImplementationRoadmap, ImplementationPhase } from '@/types/analysis'

interface ImplementationSectionProps {
  data?: ImplementationRoadmap
}

const ImplementationSection = ({ data }: ImplementationSectionProps) => {
  console.log('[ImplementationSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No implementation roadmap available</div>
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
      lineHeight: 1.5,
      background: isDark ? '#292f4c' : '#ebf8ff',
      border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}`,
      color: isDark ? '#d5d8df' : '#1a365d',
    } as React.CSSProperties,
    warning: {
      padding: '12px',
      borderRadius: '6px',
      lineHeight: 1.5,
      background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
      border: `1px solid ${isDark ? '#854d0e' : '#fbd38d'}`,
      color: isDark ? '#fde68a' : '#744210',
    } as React.CSSProperties,
    danger: {
      padding: '12px',
      borderRadius: '6px',
      lineHeight: 1.5,
      background: isDark ? 'rgba(220,38,38,0.2)' : '#fff5f5',
      border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`,
      color: isDark ? '#fca5a5' : '#742a2a',
    } as React.CSSProperties,
    success: {
      padding: '12px',
      borderRadius: '6px',
      lineHeight: 1.5,
      background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
      border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`,
      color: isDark ? '#86efac' : '#22543d',
    } as React.CSSProperties,
    neutral: {
      padding: '12px',
      borderRadius: '6px',
      lineHeight: 1.5,
      background: isDark ? '#292f4c' : '#f8f9fa',
      border: `1px solid ${isDark ? '#4b4e69' : '#e2e8f0'}`,
      color: isDark ? '#d5d8df' : '#4a5568',
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

  const renderList = (items?: (string | undefined)[], tone: keyof typeof highlightStyles = 'neutral', title?: string) => {
    if (!items || items.length === 0) return null
    const cleanItems = items.filter(Boolean) as string[]
    if (cleanItems.length === 0) return null

    return (
      <div className="requirement-card" style={cardStyle}>
        {title && (
          <div className="card-header" style={cardHeaderStyle}>
            <h5 style={cardTitleStyle}>{title}</h5>
          </div>
        )}
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

  const renderPhase = (phase: ImplementationPhase | string, index: number, total: number) => {
    if (!phase) return null
    if (typeof phase === 'string') {
      return (
        <div key={index} style={{ ...highlightStyles.neutral, fontWeight: 600, color: isDark ? '#d5d8df' : '#1a202c', fontSize: '14px' }}>
          {phase}
        </div>
      )
    }

    const title = phase.phase || phase.name || `Phase ${index + 1}`
    const duration = phase.duration ? <div style={{ fontSize: '14px', color: isDark ? '#d5d8df' : '#4a5568', marginTop: '8px' }}><strong>Duration:</strong> {phase.duration}</div> : null

    const deliverablesRaw = phase.keyDeliverables
    const deliverables = Array.isArray(deliverablesRaw)
      ? deliverablesRaw
      : deliverablesRaw
      ? [deliverablesRaw]
      : []
    const deliverablesList =
      deliverables.length > 0 ? (
        <div style={{ fontSize: '14px', color: isDark ? '#d5d8df' : '#4a5568', marginTop: '8px' }}>
          <strong>Key Deliverables:</strong>
          <ul style={{ paddingLeft: '18px', margin: '6px 0 0 0', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
            {deliverables.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null

    const resources = phase.resources ? (
      <div style={{ fontSize: '14px', color: isDark ? '#d5d8df' : '#4a5568', marginTop: '8px' }}>
        <strong>Resources:</strong> {phase.resources}
      </div>
    ) : null

    const risksArray = Array.isArray(phase.risks) ? phase.risks : []
    const risks =
      risksArray.length > 0 ? (
        <div style={{ fontSize: '14px', color: isDark ? '#d5d8df' : '#4a5568', marginTop: '8px' }}>
          <strong>Risks:</strong>
          <ul style={{ paddingLeft: '18px', margin: '6px 0 0 0', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
            {risksArray.map((risk: string, idx: number) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null

    const tone: keyof typeof highlightStyles =
      index === 0 ? 'info' : index === total - 1 ? 'success' : 'neutral'

    return (
      <div key={index} style={{ ...highlightStyles[tone], display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontWeight: 600, color: isDark ? '#d5d8df' : '#1a202c', fontSize: '14px' }}>
          {index + 1}. {title}
        </div>
        {duration}
        {deliverablesList}
        {resources}
        {risks}
      </div>
    )
  }

  const phases = Array.isArray(data.phaseBreakdown)
    ? (data.phaseBreakdown.filter(Boolean) as (ImplementationPhase | string)[])
    : []
  const criticalPath = Array.isArray(data.criticalPath) ? data.criticalPath.filter(Boolean) : []
  const dependencies = Array.isArray(data.dependencies) ? data.dependencies.filter(Boolean) : []
  const qualityGates = Array.isArray(data.qualityGates) ? data.qualityGates.filter(Boolean) : []
  const successMetrics = Array.isArray(data.successMetrics) ? data.successMetrics.filter(Boolean) : []

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {phases.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Implementation Phases</h5>
            </div>
            <div className="card-body" style={{ ...cardBodyStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {phases.map((phase, index) => renderPhase(phase, index, phases.length))}
            </div>
          </div>
        )}

        {renderList(criticalPath, 'info', 'Critical Path Milestones')}
        {renderList(dependencies, 'warning', 'Key Dependencies')}
        {renderList(qualityGates, 'success', 'Quality Gates')}

        {data.riskMitigation && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Risk Mitigation Approach</h5>
            </div>
            <div className="card-body" style={highlightStyles.danger}>
              {data.riskMitigation}
            </div>
          </div>
        )}

        {renderList(successMetrics, 'success', 'Success Metrics')}

        {!phases.length &&
          !criticalPath.length &&
          !dependencies.length &&
          !qualityGates.length &&
          !successMetrics.length &&
          !data.riskMitigation && (
            <div className="requirement-card" style={cardStyle}>
              <div className="card-header" style={cardHeaderStyle}>
                <h5 style={cardTitleStyle}>Implementation Summary</h5>
              </div>
              <div className="card-body" style={highlightStyles.neutral}>
                Implementation roadmap identified but not structured.
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

export default ImplementationSection

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import type { RequirementsAnalysis } from '@/types/analysis'

interface RequirementsSectionProps {
  data?: RequirementsAnalysis
}

const RequirementsSection = ({ data }: RequirementsSectionProps) => {
  console.log('[RequirementsSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No requirements analysis available</div>
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  // Consistent card styling matching old design
  const cardStyle: React.CSSProperties = {
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

  const cardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    color: isDark ? '#d5d8df' : '#333'
  }

  const getPriorityBadgeStyle = (priority?: string) => {
    const p = priority?.toLowerCase()
    if (p === 'high') {
      return {
        background: isDark ? 'rgba(220,38,38,0.2)' : '#fee',
        color: isDark ? '#fca5a5' : '#c53030',
        border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`
      }
    }
    if (p === 'medium') {
      return {
        background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
        color: isDark ? '#fde68a' : '#d69e2e',
        border: `1px solid ${isDark ? '#854d0e' : '#fbd38d'}`
      }
    }
    return {
      background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
      color: isDark ? '#86efac' : '#38a169',
      border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`
    }
  }

  const getCapabilityBadgeStyle = (capability?: string) => {
    const label = capability?.toLowerCase()
    if (label === 'full' || label === 'extensive' || label === 'high') {
      return { background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4', color: isDark ? '#86efac' : '#22543d', border: `1px solid ${isDark ? '#065f46' : '#68d391'}` }
    }
    if (label === 'partial' || label === 'medium') {
      return { background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0', color: isDark ? '#fde68a' : '#744210', border: `1px solid ${isDark ? '#854d0e' : '#f6d55c'}` }
    }
    if (label === 'none' || label === 'low') {
      return { background: isDark ? 'rgba(220,38,38,0.2)' : '#fed7d7', color: isDark ? '#fca5a5' : '#742a2a', border: `1px solid ${isDark ? '#7f1d1d' : '#fc8181'}` }
    }
    return { background: isDark ? '#292f4c' : '#edf2f7', color: isDark ? '#d5d8df' : '#2d3748', border: `1px solid ${isDark ? '#4b4e69' : '#cbd5f5'}` }
  }

  const requirementBlockStyle: React.CSSProperties = {
    border: `1px solid ${isDark ? '#797e93' : '#e2e8f0'}`,
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '12px',
    background: isDark ? '#292f4c' : 'white',
    boxShadow: isDark ? '0 1px 2px rgba(9,11,25,0.5)' : '0 1px 2px rgba(0,0,0,0.05)',
  }

  const renderRequirementItem = (req: any, index: number) => {
    const capabilityLabel = req.cendienCapability || req.capabilityConfidence
    const capabilityScoreValue = Number(req.capabilityScore)
    const showCapabilityScore = !Number.isNaN(capabilityScoreValue)

    return (
      <div key={index} style={requirementBlockStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div style={{ margin: 0, color: isDark ? '#d5d8df' : '#1a202c', fontWeight: 600, flex: 1 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {req.requirement}
            </ReactMarkdown>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', ...getPriorityBadgeStyle(req.priority) }}>
              {req.priority || 'Medium'}
            </span>
            {capabilityLabel && (
              <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, ...getCapabilityBadgeStyle(capabilityLabel) }}>
                {capabilityLabel}
              </span>
            )}
            {showCapabilityScore && (
              <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, border: `1px solid ${isDark ? '#4b4e69' : '#cbd5f5'}`, color: isDark ? '#d5d8df' : '#2d3748', background: isDark ? '#20233a' : '#f7fafc' }}>
                Score {capabilityScoreValue.toFixed(1)}/10
              </span>
            )}
          </div>
        </div>
        {req.capabilityDetails && (
          <div style={{ padding: '12px', background: isDark ? '#30324e' : '#f8f9fa', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', color: isDark ? '#d5d8df' : '#555', borderLeft: `3px solid ${isDark ? '#69a7ef' : '#007bff'}` }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {req.capabilityDetails}
            </ReactMarkdown>
          </div>
        )}
      </div>
    )
  }

  const renderRequirementsGroup = (requirements: any[] | undefined, title: string) => {
    if (!requirements || requirements.length === 0) return null

    return (
      <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>{title}</h5>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {requirements.map((req, i) => renderRequirementItem(req, i))}
        </div>
      </div>
    )
  }

  // Parse capability match percentage
  const rawCapabilityMatch = data.capabilityMatch || ''
  const capabilityValueMatch = parseInt(String(rawCapabilityMatch).replace(/[^0-9]/g, ''), 10)
  const hasCapabilityNumber = !isNaN(capabilityValueMatch)

  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-700'
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700'
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-700'
  }

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {/* Capability Match */}
        {hasCapabilityNumber ? (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Capability Assessment</h5>
            </div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div className={`px-3 py-2 rounded-lg border text-center ${getScoreColor(capabilityValueMatch)}`} style={{ width: 'fit-content' }}>
                <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Capability Match</div>
                <div className="text-lg font-bold">{capabilityValueMatch}%</div>
              </div>
              <div style={{ fontSize: '14px', color: isDark ? '#d5d8df' : '#4a5568' }}>
                Overall capability alignment with RFP requirements.
              </div>
            </div>
          </div>
        ) : data.capabilityMatch ? (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Capability Assessment</h5>
            </div>
            <div className="card-body" style={{ padding: '12px', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', background: isDark ? '#292f4c' : '#edf2f7', border: `1px solid ${isDark ? '#4b4e69' : '#cbd5f5'}`, color: isDark ? '#d5d8df' : '#2d3748' }}>
              Capability match could not be quantified from the analysis.
            </div>
          </div>
        ) : null}

        {/* Key Gaps */}
        {data.keyGaps && data.keyGaps.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Key Gaps Identified</h5>
            </div>
            <div className="card-body" style={{ padding: '12px', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', background: isDark ? 'rgba(220,38,38,0.2)' : '#fff5f5', border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`, color: isDark ? '#fca5a5' : '#742a2a' }}>
              <ul style={{ paddingLeft: '18px', margin: 0, listStyle: 'disc' }}>
                {data.keyGaps.map((gap, i) => (
                  <li key={i}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {gap}
                    </ReactMarkdown>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommended Partners */}
        {data.recommendedPartners && data.recommendedPartners.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Recommended Partners</h5>
            </div>
            <div className="card-body" style={{ padding: '12px', borderRadius: '6px', fontSize: '14px', lineHeight: '1.5', background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4', border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`, color: isDark ? '#86efac' : '#22543d' }}>
              <ul style={{ paddingLeft: '18px', margin: 0, listStyle: 'disc' }}>
                {data.recommendedPartners.map((partner, i) => (
                  <li key={i}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {partner}
                    </ReactMarkdown>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Requirements Groups */}
        {renderRequirementsGroup(data.functionalRequirements, 'Functional Requirements')}
        {renderRequirementsGroup(data.technicalRequirements, 'Technical Requirements')}
      </div>
    </div>
  )
}

export default RequirementsSection

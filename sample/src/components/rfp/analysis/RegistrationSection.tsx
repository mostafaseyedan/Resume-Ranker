import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { RegistrationRequirement, RegistrationRequirements } from '@/types/analysis'

interface RegistrationSectionProps {
  data?: RegistrationRequirements
}

const RegistrationSection = ({ data }: RegistrationSectionProps) => {
  console.log('[RegistrationSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No registration requirements available</div>
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
    success: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
      border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`,
      color: isDark ? '#86efac' : '#22543d',
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

  const getStatusTone = (statusLabel = '') => {
    const label = statusLabel.toLowerCase()
    if (label.includes('pending') || label.includes('progress') || label.includes('in progress')) return 'warning'
    if (label.includes('missing') || label.includes('required') || label.includes('no') || label.includes('not')) return 'danger'
    if (label.includes('current') || label.includes('active') || label.includes('complete') || label.includes('yes')) return 'success'
    return 'neutral'
  }

  const getStatusBadgeStyle = (statusLabel = ''): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      border: '1px solid transparent',
    }
    const label = statusLabel.toLowerCase()
    if (label.includes('current') || label.includes('active') || label.includes('complete') || label.includes('yes')) {
      return { ...base, background: '#f0fff4', color: '#22543d', borderColor: '#9ae6b4' }
    }
    if (label.includes('pending') || label.includes('progress') || label.includes('in progress')) {
      return { ...base, background: '#fffaf0', color: '#744210', borderColor: '#f6d55c' }
    }
    if (label.includes('missing') || label.includes('required') || label.includes('no') || label.includes('not')) {
      return { ...base, background: '#fff5f5', color: '#742a2a', borderColor: '#feb2b2' }
    }
    return { ...base, background: '#edf2f7', color: '#2d3748', borderColor: '#cbd5f5' }
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

  const renderRegistrationCard = (items: RegistrationRequirement[] | undefined, title: string) => {
    if (!items || items.length === 0) return null
    const filtered = items.filter(Boolean)
    if (filtered.length === 0) return null

    return (
      <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>{title}</h5>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((item, index) => {
            if (!item) return null
            const name = item.registration || item.certification || item.name || `Requirement ${index + 1}`
            const status = item.cendienStatus || 'Unknown'
            const tone = getStatusTone(status) as keyof typeof highlightStyles
            const badgeStyle = getStatusBadgeStyle(status)

            return (
              <div key={index} style={highlightStyles[tone]}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontWeight: 600, color: isDark ? '#d5d8df' : '#1a202c' }}>{name}</div>
                  <span style={badgeStyle}>{status}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', color: isDark ? '#d5d8df' : '#4a5568', fontSize: '13px' }}>
                  {item.authority && (
                    <span>
                      <strong>Authority:</strong> {renderInlineMarkdown(item.authority)}
                    </span>
                  )}
                  {item.timeToObtain && (
                    <span>
                      <strong>Time to Obtain:</strong> {renderInlineMarkdown(item.timeToObtain)}
                    </span>
                  )}
                  {item.cost && (
                    <span>
                      <strong>Cost:</strong> {renderInlineMarkdown(item.cost)}
                    </span>
                  )}
                  {item.teamMemberStatus && (
                    <span>
                      <strong>Team Status:</strong> {renderInlineMarkdown(item.teamMemberStatus)}
                    </span>
                  )}
                </div>
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
        {renderRegistrationCard(data.requiredRegistrations, 'Required Registrations')}
        {renderRegistrationCard(data.requiredCertifications, 'Required Certifications')}

        {data.complianceRequirements && data.complianceRequirements.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Compliance Requirements</h5>
            </div>
            <div className="card-body" style={highlightStyles.info}>
              <ul style={listStyle}>
                {data.complianceRequirements.map((req, index) => renderListItem(req, index))}
              </ul>
            </div>
          </div>
        )}

        {data.gapsToAddress && data.gapsToAddress.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Gaps to Address</h5>
            </div>
            <div className="card-body" style={highlightStyles.warning}>
              <ul style={listStyle}>
                {data.gapsToAddress.map((gap, index) => renderListItem(gap, index))}
              </ul>
            </div>
          </div>
        )}

        {data.complianceRisk && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Compliance Risk Assessment</h5>
            </div>
            <div className="card-body" style={highlightStyles.danger}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <p style={{ margin: 0 }}>{children}</p> }}>
                {data.complianceRisk}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {!data.requiredRegistrations &&
          !data.requiredCertifications &&
          !(data.complianceRequirements && data.complianceRequirements.length) &&
          !(data.gapsToAddress && data.gapsToAddress.length) &&
          !data.complianceRisk && (
            <div className="requirement-card" style={cardStyle}>
              <div className="card-header" style={cardHeaderStyle}>
                <h5 style={cardTitleStyle}>Registration Overview</h5>
              </div>
              <div className="card-body" style={highlightStyles.neutral}>
                No registration requirements data available.
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

export default RegistrationSection

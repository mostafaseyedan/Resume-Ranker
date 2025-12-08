import type { DeadlinesTimeline } from '@/types/analysis'

interface TimelineSectionProps {
  data?: DeadlinesTimeline
}

const TimelineSection = ({ data }: TimelineSectionProps) => {
  console.log('[TimelineSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No timeline information available</div>
  }

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
    color: isDark ? '#d5d8df' : '#333'
  }

  const listStyle: React.CSSProperties = {
    paddingLeft: '18px',
    margin: 0,
    listStyle: 'disc',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  }

  const stats = [
    { label: 'Proposal Due', value: data.submissionDeadline || 'TBD' },
    { label: 'Project Start', value: data.projectStartDate || 'TBD' },
    { label: 'Duration', value: data.projectDuration || 'TBD' }
  ]

  const milestones = Array.isArray(data.keyMilestones) ? data.keyMilestones.filter(Boolean) : []
  const phasesRaw = (data.milestones || data.phaseBreakdown) as DeadlinesTimeline['milestones']
  const phases = Array.isArray(phasesRaw) ? phasesRaw.filter(Boolean) : []

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        <div className="requirement-card" style={cardStyle}>
          <div className="card-header" style={cardHeaderStyle}>
            <h5 style={cardTitleStyle}>Submission Overview</h5>
          </div>
          <div className="card-body" style={{ padding: 0, margin: 0, fontSize: '14px', color: isDark ? '#d5d8df' : '#555' }}>
            <ul style={listStyle}>
              {stats.map((stat) => (
                <li key={stat.label}>
                  <strong>{stat.label}:</strong> {stat.value}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {milestones.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Key Milestones</h5>
            </div>
            <div className="card-body" style={{ padding: 0, margin: 0, fontSize: '14px', color: isDark ? '#d5d8df' : '#555' }}>
              <ul style={listStyle}>
                {milestones.map((milestone, index) => {
                  const title = milestone?.milestone || 'Milestone'
                  const date = milestone?.date ? `: ${milestone.date}` : ''
                  const description = milestone?.description
                    ? <div style={{ marginTop: '4px', fontSize: '13px', color: isDark ? '#9699a6' : '#6c757d' }}>{milestone.description}</div>
                    : null
                  return (
                    <li key={index}>
                      <strong>{title}</strong>
                      <span>{date}</span>
                      {description}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {phases.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Implementation Phases</h5>
            </div>
            <div className="card-body" style={{ padding: 0, margin: 0, fontSize: '14px', color: isDark ? '#d5d8df' : '#555' }}>
              <ul style={listStyle}>
                {phases.map((phase, index) => {
                  if (typeof phase === 'string') {
                    return <li key={index}>{phase}</li>
                  }
                  const label = phase?.phase || phase?.name || `Phase ${index + 1}`
                  const duration = phase?.duration ? ` — ${phase.duration}` : ''
                  const deliverables = phase?.keyDeliverables
                    ? Array.isArray(phase.keyDeliverables)
                      ? phase.keyDeliverables.join(', ')
                      : phase.keyDeliverables
                    : ''
                  const resources = phase?.resources ? `Resources: ${phase.resources}` : ''
                  return (
                    <li key={index}>
                      <strong>{label}</strong>
                      <span>{duration}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: isDark ? '#9699a6' : '#6c757d', marginTop: '4px' }}>
                        {deliverables && <span><strong>Deliverables:</strong> {deliverables}</span>}
                        {resources && <span>{resources}</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimelineSection

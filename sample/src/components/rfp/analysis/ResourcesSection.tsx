import type { ResourcePlanning } from '@/types/analysis'

interface ResourcesSectionProps {
  data?: ResourcePlanning
}

const ResourcesSection = ({ data }: ResourcesSectionProps) => {
  console.log('[ResourcesSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No resource planning information available</div>
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

  // (Removed unused listStyle; lists now use Tailwind prose classes for spacing.)

  const renderHighlight = (
    content: React.ReactNode,
    tone: keyof typeof highlightStyles = 'info',
  ) => <div style={highlightStyles[tone]}>{content}</div>


  const renderRequiredSkills = () => {
    if (!data.requiredSkills || data.requiredSkills.length === 0) return null

    const skills = data.requiredSkills
      .map((skill) => {
        if (typeof skill === 'string') {
          return {
            name: skill,
            level: undefined,
            duration: undefined,
            availability: undefined,
          }
        }
        return {
          name: skill.skill || 'Skill',
          level: skill.level,
          duration: skill.duration,
          availability: skill.availability,
        }
      })
      .filter((skill) => skill.name)

    if (skills.length === 0) return null

    return (
      <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>Priority Skills & Certifications</h5>
        </div>
        <div className="card-body" style={cardBodyStyle}>
          {renderHighlight(
            <div className="prose prose-sm max-w-none text-sm leading-6">
              <ul className="list-disc list-inside space-y-1">
                {skills.map((skill, index) => (
                  <li key={index}>
                    <strong>{skill.name}</strong>
                    <div className="mt-1 text-sm">
                      {skill.level && <span><strong>Level:</strong> {skill.level}</span>}
                      {skill.level && (skill.duration || skill.availability) && <span> • </span>}
                      {skill.duration && <span><strong>Duration:</strong> {skill.duration}</span>}
                      {skill.duration && skill.availability && <span> • </span>}
                      {skill.availability && <span><strong>Availability:</strong> {skill.availability}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>,
            'info',
          )}
        </div>
      </div>
    )
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
          <div className="prose prose-sm max-w-none text-sm leading-6">
            <ul className="list-disc list-inside">
              {cleanItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {(data.estimatedEffort || data.teamComposition || data.recruitmentNeeds) && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Resource Planning Overview</h5>
            </div>
            <div className="card-body" style={{ ...cardBodyStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.estimatedEffort &&
                renderHighlight(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Estimated Effort</div>
                    <div className="prose prose-sm max-w-none text-sm leading-6">
                      <p>{typeof data.estimatedEffort === 'string' ? data.estimatedEffort : String(data.estimatedEffort)}</p>
                    </div>
                  </div>,
                  'info',
                )}
              {data.teamComposition &&
                renderHighlight(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Team Composition</div>
                    <div className="prose prose-sm max-w-none text-sm leading-6">
                      <p>{typeof data.teamComposition === 'string' ? data.teamComposition : String(data.teamComposition)}</p>
                    </div>
                  </div>,
                  'success',
                )}
              {data.recruitmentNeeds &&
                renderHighlight(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Recruitment Needs</div>
                    <div className="prose prose-sm max-w-none text-sm leading-6">
                      <p>{typeof data.recruitmentNeeds === 'string' ? data.recruitmentNeeds : String(data.recruitmentNeeds)}</p>
                    </div>
                  </div>,
                  'warning',
                )}
            </div>
          </div>
        )}

        {renderRequiredSkills()}
        {renderListCard(data.resourceGaps, 'Resource Gaps', 'danger')}
        {renderListCard(data.capacityRisks, 'Capacity & Delivery Risks', 'warning')}

        {(data.partnerStrategy || data.benchStrategy) && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Coverage Strategy</h5>
            </div>
            <div className="card-body" style={{ ...cardBodyStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.partnerStrategy &&
                renderHighlight(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Partner Strategy</div>
                    <div className="prose prose-sm max-w-none text-sm leading-6">
                      <p>{data.partnerStrategy}</p>
                    </div>
                  </div>,
                  'success',
                )}
              {data.benchStrategy &&
                renderHighlight(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Bench & Backfill Approach</div>
                    <div className="prose prose-sm max-w-none text-sm leading-6">
                      <p>{data.benchStrategy}</p>
                    </div>
                  </div>,
                  'neutral',
                )}
            </div>
          </div>
        )}

        {!data.estimatedEffort &&
          !data.teamComposition &&
          !data.recruitmentNeeds &&
          !(data.requiredSkills && data.requiredSkills.length) &&
          !(data.resourceGaps && data.resourceGaps.length) &&
          !(data.capacityRisks && data.capacityRisks.length) &&
          !data.partnerStrategy &&
          !data.benchStrategy && (
            <div className="requirement-card" style={cardStyle}>
              <div className="card-header" style={cardHeaderStyle}>
                <h5 style={cardTitleStyle}>Resource Planning Overview</h5>
              </div>
              <div className="card-body" style={highlightStyles.neutral}>
                No resource planning data available.
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

export default ResourcesSection

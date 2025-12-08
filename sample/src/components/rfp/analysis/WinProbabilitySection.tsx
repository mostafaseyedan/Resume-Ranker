import type { WinProbability } from '@/types/analysis'

interface WinProbabilitySectionProps {
  data?: WinProbability
}

const WinProbabilitySection = ({ data }: WinProbabilitySectionProps) => {
  console.log('[WinProbabilitySection] Received data:', data)

  if (!data) {
    return <div className="no-data">No win probability analysis available</div>
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
    info: {
      padding: '12px',
      borderRadius: '6px',
      background: isDark ? '#292f4c' : '#ebf8ff',
      border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}`,
      color: isDark ? '#d5d8df' : '#1a365d',
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

  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-700'
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700'
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-700'
  }

  const renderListCard = (
    title: string,
    items: string[] | undefined,
    tone: keyof typeof highlightStyles,
    description?: string,
  ) => {
    if (!items || items.length === 0) return null
    return (
      <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>{title}</h5>
        </div>
        <div className="card-body" style={highlightStyles[tone]}>
          {description && <div style={{ fontSize: '13px', marginBottom: '6px' }}>{description}</div>}
          <ul style={listStyle}>
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        <div className="requirement-card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h5 style={cardTitleStyle}>Win Probability</h5>
        </div>
        <div
          className="card-body"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div className={`px-3 py-2 rounded-lg border text-center ${getScoreColor(data.probabilityScore ?? 0)}`} style={{ width: 'fit-content' }}>
            <div className="text-[10px] text-gray-600 dark:text-[#c3c6d4] uppercase tracking-wide">Win Probability</div>
            <div className="text-lg font-bold">{data.probabilityScore ?? 0}%</div>
          </div>

          {data.confidenceLevel && (
            <div style={{ fontSize: '14px' }}>
              <strong>Confidence Level:</strong>&nbsp;
              <span style={{ fontWeight: 600 }}>{data.confidenceLevel}</span>
            </div>
          )}
          {data.summary && (
            <div style={{ fontSize: '13px', color: isDark ? '#d5d8df' : '#1a202c' }}>
              {data.summary}
            </div>
          )}
        </div>
      </div>

        {data.scoringFactors && data.scoringFactors.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Scoring Factors</h5>
            </div>
            <div className="card-body" style={highlightStyles.info}>
              <ul style={{ ...listStyle, gap: '10px' }}>
                {data.scoringFactors.map((factor, index) => {
                  if (!factor) return null
                  const weight =
                    factor.weight !== undefined
                      ? typeof factor.weight === 'object'
                        ? factor.weight.value
                        : factor.weight
                      : undefined
                  const score =
                    factor.cendienScore !== undefined
                      ? typeof factor.cendienScore === 'object'
                        ? factor.cendienScore.value
                        : factor.cendienScore
                      : undefined

                  return (
                    <li key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 600, color: isDark ? '#d5d8df' : '#1a202c' }}>{factor.factor || 'Factor'}</div>
                      <div style={{ fontSize: '12px', color: isDark ? '#d5d8df' : '#4a5568' }}>
                        {weight !== undefined && <span>Weight: {weight}/10</span>}
                        {weight !== undefined && score !== undefined && <span> &nbsp;|&nbsp; </span>}
                        {score !== undefined && <span>Cendien Score: {score}/10</span>}
                      </div>
                      {factor.reasoning && (
                        <div style={{ fontSize: '13px', color: isDark ? '#d5d8df' : '#1a202c' }}>{factor.reasoning}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {renderListCard('Strength Areas', data.strengthAreas, 'success')}
        {renderListCard('Improvement Areas', data.improvementAreas, 'warning')}
        {renderListCard('Deal Breakers', data.dealBreakers, 'danger', 'Critical factors that could eliminate this pursuit:')}
      </div>
    </div>
  )
}

export default WinProbabilitySection

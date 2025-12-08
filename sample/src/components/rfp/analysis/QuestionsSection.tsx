import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { QuestionsClarifications } from '@/types/analysis'

interface QuestionsSectionProps {
  data?: QuestionsClarifications
  primaryContactEmail?: string
  organizationName?: string
}

const normalizeQuestions = (...sources: unknown[]): string[] => {
  const collected: string[] = []

  const pushNormalized = (raw: unknown) => {
    if (!raw) return

    if (Array.isArray(raw)) {
      raw.forEach((entry) => {
        if (typeof entry === 'string') {
          const cleaned = entry.trim()
          if (cleaned) collected.push(cleaned)
        } else if (entry && typeof entry === 'object') {
          const maybeQuestion =
            (entry as Record<string, unknown>).question ??
            (entry as Record<string, unknown>).text ??
            (entry as Record<string, unknown>).value
          if (typeof maybeQuestion === 'string') {
            const cleaned = maybeQuestion.trim()
            if (cleaned) collected.push(cleaned)
          }
        }
      })
      return
    }

    if (typeof raw === 'string') {
      raw
        .split(/\r?\n+/)
        .map((line) => line.trim().replace(/^[-*\d.\)\s]+/, '').trim())
        .filter((line) => line.length > 0)
        .forEach((line) => collected.push(line))
      return
    }
  }

  sources.forEach(pushNormalized)

  return collected
}

const QuestionsSection = ({ data, primaryContactEmail, organizationName }: QuestionsSectionProps) => {
  console.log('[QuestionsSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No questions or clarifications available</div>
  }

  const questions = normalizeQuestions(
    (data as unknown as { questions?: unknown; questionList?: unknown }).questions ??
      (data as unknown as { questions?: unknown; questionList?: unknown }).questionList,
    (data as unknown as Record<string, unknown>).businessQuestions,
    (data as unknown as Record<string, unknown>).technicalQuestions,
    (data as unknown as Record<string, unknown>).contractualQuestions,
    (data as unknown as Record<string, unknown>).timelineQuestions
  )
  const priorityLevel = typeof data.priorityLevel === 'string' ? data.priorityLevel : undefined
  const recommendedApproach =
    typeof data.recommendedApproach === 'string' ? data.recommendedApproach : undefined

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

  const handleEmailQuestions = () => {
    if (questions.length === 0) {
      alert('No questions to email')
      return
    }

    if (!primaryContactEmail) {
      alert('No primary contact email found. Please check the Stakeholders section.')
      return
    }

    const orgName = organizationName || 'Organization'
    const subject = `RFP Clarification Questions - ${orgName}`
    const body = `Dear RFP Contact,\n\n${
      recommendedApproach ? recommendedApproach + '\n\n' : ''
    }Please see below for our clarification questions:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nThank you for your consideration.`

    window.location.href = `mailto:${primaryContactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="analysis-content">
      <div className="requirements-list">
        {/* Recommended Approach */}
        {recommendedApproach && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Recommended Approach</h5>
              <button
                onClick={handleEmailQuestions}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0060b9] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                title="Send questions via email"
                type="button"
              >
                Email Questions
              </button>
            </div>
            <div
              className="card-body"
              style={{ padding: '12px', borderRadius: '6px', background: isDark ? '#292f4c' : '#ebf8ff', border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}` }}
            >
              <div className="text-sm leading-6" style={{ color: isDark ? '#d5d8df' : '#334155' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{recommendedApproach}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Questions List */}
        {questions.length > 0 && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Questions for Clarification</h5>
            </div>
            <div className="card-body" style={{ padding: 0, margin: 0 }}>
              {questions.map((question, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px 0' }}>
                  <span style={{
                    flexShrink: 0,
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isDark ? '#13377433' : '#dbeafe',
                    color: isDark ? '#69a7ef' : '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, paddingTop: '2px', margin: 0 }}>
                    <div className="text-sm leading-6 text-slate-700 dark:text-[#d5d8df]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{question}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priority Level */}
        {priorityLevel && (
          <div className="requirement-card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h5 style={cardTitleStyle}>Priority Level</h5>
            </div>
            <div className="card-body" style={{ padding: 0, margin: 0 }}>
              <span style={{
                display: 'inline-block',
                padding: '6px 12px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '14px',
                ...(priorityLevel.toLowerCase() === 'high'
                  ? (isDark
                      ? { background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid #7f1d1d' }
                      : { background: '#fee', color: '#c53030', border: '1px solid #feb2b2' })
                  : priorityLevel.toLowerCase() === 'medium'
                    ? (isDark
                        ? { background: 'rgba(234,179,8,0.15)', color: '#fde68a', border: '1px solid #854d0e' }
                        : { background: '#fffaf0', color: '#d69e2e', border: '1px solid #fbd38d' })
                    : (isDark
                        ? { background: 'rgba(16,185,129,0.15)', color: '#86efac', border: '1px solid #065f46' }
                        : { background: '#f0fff4', color: '#38a169', border: '1px solid #9ae6b4' }))
              }}>
                {priorityLevel}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestionsSection

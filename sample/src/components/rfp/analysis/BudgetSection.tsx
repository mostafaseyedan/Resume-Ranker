import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import type { BudgetAnalysis, BudgetItem } from '@/types/analysis'

interface BudgetSectionProps {
  data?: BudgetAnalysis
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
  color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#333',
}

const cardBodyStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  fontSize: '14px',
  color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#555',
  lineHeight: 1.6,
}

const highlightStyles: Record<string, React.CSSProperties> = {
  info: {
    padding: '12px',
    borderRadius: '6px',
    background: isDark ? '#292f4c' : '#ebf8ff',
    border: `1px solid ${isDark ? '#4b4e69' : '#90cdf4'}`,
    color: isDark ? '#d5d8df' : '#1a365d',
  },
  success: {
    padding: '12px',
    borderRadius: '6px',
    background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fff4',
    border: `1px solid ${isDark ? '#065f46' : '#9ae6b4'}`,
    color: isDark ? '#86efac' : '#22543d',
  },
  warning: {
    padding: '12px',
    borderRadius: '6px',
    background: isDark ? 'rgba(234,179,8,0.15)' : '#fffaf0',
    border: `1px solid ${isDark ? '#854d0e' : '#fbd38d'}`,
    color: isDark ? '#fde68a' : '#744210',
  },
  danger: {
    padding: '12px',
    borderRadius: '6px',
    background: isDark ? 'rgba(220,38,38,0.2)' : '#fff5f5',
    border: `1px solid ${isDark ? '#7f1d1d' : '#feb2b2'}`,
    color: isDark ? '#fca5a5' : '#742a2a',
  },
}

const wrapHighlight = (content: React.ReactNode, tone: keyof typeof highlightStyles = 'info') => (
  <div style={highlightStyles[tone]}>{content}</div>
)

const renderCard = (title: string, body: React.ReactNode) => (
  <div key={title} className="requirement-card" style={cardStyle}>
    <div className="card-header" style={cardHeaderStyle}>
      <h5 style={cardTitleStyle}>{title}</h5>
    </div>
    <div className="card-body" style={cardBodyStyle}>{body}</div>
  </div>
)

const renderMarkdown = (value?: string, tone: keyof typeof highlightStyles = 'info') => {
  if (!value) return null
  return wrapHighlight(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {value}
    </ReactMarkdown>,
    tone,
  )
}

const renderBreakdownItem = (item: BudgetItem, index: number) => {
  if (!item) return null
  if (typeof item === 'string') {
    return <li key={index} style={{ marginBottom: '8px' }}>{item}</li>
  }

  const details: string[] = []
  if (item.estimatedCost) details.push(`Amount: ${item.estimatedCost}`)
  if (item.notes) details.push(`Notes: ${item.notes}`)

  return (
    <li key={index} style={{ marginBottom: '10px' }}>
      <strong>{item.category || 'Category'}</strong>
      {details.length > 0 && (
        <span style={{ display: 'block', color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#4a5568', fontSize: '13px', marginTop: '4px' }}>{details.join(' | ')}</span>
      )}
    </li>
  )
}

const renderListCard = (title: string, items: string[], tone: keyof typeof highlightStyles = 'info') => {
  if (!items.length) return null
  return renderCard(
    title,
    wrapHighlight(
      <ul style={{ paddingLeft: '18px', margin: 0 }}>
        {items.map((entry, index) => (
          <li key={index} style={{ marginBottom: '6px' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry}</ReactMarkdown>
          </li>
        ))}
      </ul>,
      tone,
    ),
  )
}

const renderSummaryGrid = (values: Array<{ label: string; value?: string }>) => {
  const present = values.filter((entry) => entry.value)
  if (!present.length) return null

  return renderCard(
    'Financial Summary',
    <div
      style={{
        display: 'grid',
        gap: '12px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}
    >
      {present.map((entry) => (
        <div
          key={entry.label}
          style={{
            border: `1px solid ${isDark ? '#4b4e69' : '#e2e8f0'}`,
            borderRadius: '6px',
            padding: '12px',
            background: isDark ? '#292f4c' : '#f8fafc',
          }}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: isDark ? '#9699a6' : '#718096' }}>{entry.label}</div>
          <div style={{ fontWeight: 600, color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#d5d8df' : '#1a202c', marginTop: '6px' }}>{entry.value}</div>
        </div>
      ))}
    </div>,
  )
}

const renderProposedPricing = (data: BudgetAnalysis['proposedPricing']) => {
  if (!data) return null

  const rows: string[] = []
  if (data.totalProjectCost) rows.push(`<strong>Total Project Cost:</strong> ${data.totalProjectCost}`)
  if (data.implementationCost) rows.push(`<strong>Implementation Cost:</strong> ${data.implementationCost}`)
  if (data.ongoingSupportCost) rows.push(`<strong>Ongoing Support:</strong> ${data.ongoingSupportCost}`)
  if (data.monthlyRate) rows.push(`<strong>Monthly Rate:</strong> ${data.monthlyRate}`)
  if (data.hourlyRates) rows.push(`<strong>Hourly Rates:</strong> ${data.hourlyRates}`)

  if (!rows.length && !data.pricingJustification) return null

  return renderCard(
    "Cendien's Proposed Pricing",
    <div>
      {rows.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {rows.map((row, index) => (
            <div key={index} style={{ marginBottom: '6px' }} dangerouslySetInnerHTML={{ __html: row }} />
          ))}
        </div>
      )}
      {data.pricingJustification && (
        wrapHighlight(
          <div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Pricing Rationale</div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.pricingJustification}</ReactMarkdown>
          </div>,
          'info',
        )
      )}
    </div>,
  )
}

const BudgetSection = ({ data }: BudgetSectionProps) => {
  console.log('[BudgetSection] Received data:', data)

  if (!data) {
    return <div className="no-data">No budget analysis available</div>
  }

  const cards: React.ReactNode[] = []

  const summaryCard = renderSummaryGrid([
    { label: 'Total Budget', value: data.totalBudget },
    { label: 'Cendien Cost Estimate', value: data.cendienCostEstimate },
    { label: 'Profit Margin Estimate', value: data.profitMarginEstimate },
  ])
  if (summaryCard) cards.push(summaryCard)

  if (data.pricingStrategy) {
    cards.push(
      renderCard('Pricing Strategy', renderMarkdown(data.pricingStrategy) ?? data.pricingStrategy),
    )
  }

  if (data.paymentTerms) {
    cards.push(renderCard('Payment Terms', renderMarkdown(data.paymentTerms) ?? data.paymentTerms))
  }

  if (data.competitivePricing) {
    cards.push(
      renderCard('Competitive Pricing', renderMarkdown(data.competitivePricing) ?? data.competitivePricing),
    )
  }

  if (data.budgetBreakdown && data.budgetBreakdown.length > 0) {
    cards.push(
      renderCard(
        'Budget Breakdown',
        <ul style={{ paddingLeft: '18px', margin: 0 }}>
          {data.budgetBreakdown.map((item, index) => renderBreakdownItem(item, index))}
        </ul>,
      ),
    )
  }

  if (data.profitabilityAnalysis) {
    cards.push(
      renderCard('Profitability Analysis', renderMarkdown(data.profitabilityAnalysis) ?? data.profitabilityAnalysis),
    )
  }

  if (data.budgetRisks && data.budgetRisks.length > 0) {
    cards.push(renderListCard('Budget Risks', data.budgetRisks, 'danger'))
  }

  if (data.costRisks && data.costRisks.length > 0) {
    cards.push(renderListCard('Cost Risks', data.costRisks, 'warning'))
  }

  if (data.recommendedPricing) {
    cards.push(
      renderCard('Recommended Pricing Strategy', renderMarkdown(data.recommendedPricing, 'warning') ?? data.recommendedPricing),
    )
  }

  const pricingCard = renderProposedPricing(data.proposedPricing)
  if (pricingCard) cards.push(pricingCard)

  if (cards.length === 0) {
    return <div className="no-data">No budget analysis available</div>
  }

  return (
    <div className="analysis-content">
      <div className="requirements-list">{cards}</div>
    </div>
  )
}

export default BudgetSection

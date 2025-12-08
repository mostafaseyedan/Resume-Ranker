interface ProviderDetails {
  label: string
  image: string
  description: string
  iconClass: string
}

const PROVIDER_MAP: Record<string, ProviderDetails> = {
  gemini: {
    label: 'Gemini',
    image: '/images/gemini.png',
    description: 'Gemini (with all of our internal knowledge)',
    iconClass: 'w-7 h-7'
  },
  openai: {
    label: 'ChatGPT',
    image: '/images/chatgpt.png',
    description: 'ChatGPT 5.1 (limited knowledge)',
    iconClass: 'w-8 h-7'
  }
}

export const extractProvider = (record?: any): string | undefined => {
  if (!record || typeof record !== 'object') return undefined
  return (
    record.provider ||
    record.llmProvider ||
    record.selectedProvider ||
    record.llmOptions?.provider ||
    record.metadata?.llmProvider ||
    record.metadata?.provider
  )
}

export const getProviderDetails = (provider?: string): ProviderDetails => {
  const normalized = (provider || '').toLowerCase()
  if (normalized === 'openai' || normalized === 'chatgpt') {
    return PROVIDER_MAP.openai
  }
  return PROVIDER_MAP.gemini
}

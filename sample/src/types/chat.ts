// Chat-related TypeScript types
// Based on server/modules/aiChatService.js

export interface ChatMessage {
  id: string
  userMessage: string
  aiResponse: string
  timestamp: string
  tokens?: number
}

export interface ChatSession {
  rfpAnalysisId: string
  userId: string
  messages: ChatMessage[]
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface ChatResponse {
  content: string
  metadata: {
    rfpAnalysisId: string
    userId: string
    timestamp: string
    tokensUsed?: number
  }
}

export interface ChatHistoryResponse {
  success: boolean
  history: ChatMessage[]
  total: number
}

export interface ChatStats {
  messageCount: number
  totalTokens: number
  firstMessageAt: string | null
  lastMessageAt: string | null
  error?: string
}

// NLUX adapter types
export interface StreamChunk {
  content: string
  partial: boolean
  complete?: boolean
  metadata?: {
    rfpAnalysisId: string
    userId: string
    timestamp: string
    fullResponse?: string
  }
  error?: string
}

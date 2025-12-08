import { useEffect, useRef, useState } from 'react'
import { AiChat } from '@nlux/react'
import type { ChatAdapter, ChatItem } from '@nlux/react'
import '@nlux/themes/nova.css'
import './custom-chat-theme.css'
import { toast } from 'sonner'
import apiClient from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { StreamChunk, ChatHistoryResponse } from '@/types/chat'

interface ChatTabProps {
  rfpId: string
  rfpTitle?: string
}

const ChatTab = ({ rfpId, rfpTitle }: ChatTabProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([])
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()

  const getUserInitials = (name: string | undefined): string => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const userInitials = getUserInitials(user?.name)
  const userName = user?.name || 'You'

  useEffect(() => {
    loadLatestAnalysis()
  }, [rfpId])

  // Listen for new analyses being completed
  useEffect(() => {
    const handleAnalysisComplete = () => {
      console.log('[ChatTab] Analysis complete event received, reloading analyses...')
      loadLatestAnalysis()
    }

    window.addEventListener('rfp-analysis-complete', handleAnalysisComplete)
    return () => {
      window.removeEventListener('rfp-analysis-complete', handleAnalysisComplete)
    }
  }, [rfpId])

  const loadLatestAnalysis = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.get('/rfp-analyses', {
        params: { rfpId }
      })

      const analyses = response.data.analyses || []

      if (analyses.length > 0) {
        const latestAnalysisId = analyses[0].id
        setAnalysisId(latestAnalysisId)

        // Load chat history for this analysis
        await loadChatHistory(latestAnalysisId)

        setIsLoading(false)
      } else {
        setError('No analysis available for this RFP')
        setIsLoading(false)
      }
    } catch (err: any) {
      console.error('[ChatTab] Failed to load analysis:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load analysis'
      setError(errorMsg)
      setIsLoading(false)
    }
  }

  const loadChatHistory = async (analysisId: string) => {
    try {
      console.log('[ChatTab] Loading chat history for analysis:', analysisId)

      const response = await apiClient.get<ChatHistoryResponse>(`/chat-history/${analysisId}`)

      if (response.data.success && response.data.history.length > 0) {
        // Convert backend format to NLUX format
        const convertedHistory: ChatItem[] = response.data.history.flatMap(item => [
          { role: 'user', message: item.userMessage },
          { role: 'assistant', message: item.aiResponse }
        ])

        setChatHistory(convertedHistory)
        console.log('[ChatTab] Loaded', response.data.total, 'chat exchanges')
      } else {
        setChatHistory([])
      }
    } catch (err: any) {
      console.error('[ChatTab] Failed to load chat history:', err)
      // Don't show error to user, just start with empty history
      setChatHistory([])
    }
  }

  const clearChatHistory = async () => {
    if (!analysisId) return

    if (!confirm('Are you sure you want to clear all chat history? This will also reset the chat session and reload the RFP context.')) {
      return
    }

    try {
      console.log('[ChatTab] Clearing chat history for analysis:', analysisId)

      const response = await apiClient.delete(`/chat-history/${analysisId}`)

      if (response.data.success) {
        // Reset chat state without page reload
        setChatHistory([])
        setError(null)
        toast.success('Chat history cleared successfully')

        // Optionally reload chat history from server to sync
        await loadChatHistory(analysisId)
      } else {
        toast.error('Failed to clear chat history')
      }
    } catch (err: any) {
      console.error('[ChatTab] Failed to clear chat history:', err)
      toast.error('Failed to clear chat history', {
        description: err.response?.data?.error || err.message
      })
    }
  }

  const chatAdapter: ChatAdapter = {
    streamText: async (prompt: string, observer: any) => {
      if (!analysisId) {
        observer.error(new Error('No analysis selected'))
        return
      }

      try {
        console.log('[ChatTab] Streaming prompt:', prompt)

        const response = await fetch('/api/chat-gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            prompt: prompt,
            rfpId: analysisId,
            stream: true
          })
        })

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('Response body is null')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim()

              if (jsonStr === '[DONE]') {
                observer.complete()
                return
              }

              if (jsonStr) {
                try {
                  const data: StreamChunk = JSON.parse(jsonStr)

                  if (data.error) {
                    observer.error(new Error(data.error))
                    return
                  }

                  if (data.content) {
                    observer.next(data.content)
                  }

                  if (data.complete) {
                    observer.complete()
                    return
                  }
                } catch (e) {
                  console.warn('[ChatTab] Failed to parse chunk:', jsonStr)
                }
              }
            } else if (line.trim()) {
              observer.next(line)
            }
          }
        }

        if (buffer.trim()) {
          observer.next(buffer)
        }

        observer.complete()

      } catch (error: any) {
        console.error('[ChatTab] Streaming error:', error)
        observer.error(error)
        toast.error('Chat error', {
          description: error.message || 'Failed to get response'
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading chat...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadLatestAnalysis}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-[#0060b9]"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!analysisId) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 dark:text-[#9699a6] mb-4">No analysis available</div>
      </div>
    )
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  return (
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      {/* Chat box (header + chat) with unified surface */}
      <div className="flex flex-col h-full w-full bg-white dark:bg-[#292f4c]">
        {/* Header with Clear History button (removed conversation count) */}
        <div className="flex items-center justify-end p-2">
          <button
            onClick={clearChatHistory}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-[#30324e] text-gray-600 dark:text-[#d5d8df] rounded hover:bg-gray-200 dark:hover:bg-[#323861] transition-colors"
            title="Clear all chat history and reset session"
          >
            Clear History
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <AiChat
            adapter={chatAdapter}
            initialConversation={chatHistory}
            messageOptions={{
              markdownLinkTarget: 'blank'
            }}
            displayOptions={{
              colorScheme: isDark ? 'dark' : 'light',
              width: '100%',
              height: '100%'
            }}
            personaOptions={{
            assistant: {
              name: 'RFP AI Assistant',
              tagline: rfpTitle ? `Analyzing: ${rfpTitle}` : 'Ask me anything about this RFP',
              avatar: (
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 8.016A8.522 8.522 0 008.016 16h-.032A8.521 8.521 0 000 8.016v-.032A8.521 8.521 0 007.984 0h.032A8.522 8.522 0 0016 7.984v.032z" fill="url(#prefix__paint0_radial_980_20147)"/>
                  <defs>
                    <radialGradient id="prefix__paint0_radial_980_20147" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)">
                      <stop offset=".067" stopColor="#9168C0"/>
                      <stop offset=".343" stopColor="#5684D1"/>
                      <stop offset=".672" stopColor="#1BA1E3"/>
                    </radialGradient>
                  </defs>
                </svg>
              )
            },
            user: {
              name: userName,
              avatar: (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#3B82F6',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
                  }}
                >
                  {userInitials}
                </div>
              )
            }
          }}
            conversationOptions={{
              layout: 'bubbles',
              autoScroll: true
            }}
            composerOptions={{
              placeholder: 'Ask me anything about this RFP analysis...',
              autoFocus: false
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default ChatTab

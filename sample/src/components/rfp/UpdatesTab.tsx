import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import apiClient from '@/services/apiClient'

interface Update {
  id: string
  creator: {
    id: string
    name: string
    email: string | null
  }
  body: string
  createdAt: string
  updatedAt: string
  relativeTime: string
}

interface UpdatesTabProps {
  rfpId: string
}

const UpdatesTab = ({ rfpId }: UpdatesTabProps) => {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUpdates()
  }, [rfpId])

  const loadUpdates = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[UpdatesTab] Loading updates for item:', rfpId)

      const response = await apiClient.get(`/monday/items/${rfpId}/updates`)

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch updates')
      }

      setUpdates(response.data.updates || [])
      console.log(`[UpdatesTab] Loaded ${response.data.updates?.length || 0} updates`)
    } catch (err: any) {
      console.error('[UpdatesTab] Failed to load updates:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load updates'
      setError(errorMsg)
      toast.error('Failed to load updates', {
        description: errorMsg
      })
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (email: string | null): string => {
    if (!email) return '#9CA3AF'

    // Generate consistent color based on email hash
    const hash = email.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0)

    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316'  // orange
    ]

    return colors[Math.abs(hash) % colors.length]
  }

  const renderHtmlContent = (html: string): React.ReactNode => {
    // Create a temporary container to parse HTML
    const container = document.createElement('div')
    container.innerHTML = html

    // Process images: convert img tags to render as proper images
    const images = container.querySelectorAll('img')
    images.forEach((img) => {
      const originalSrc = img.getAttribute('src')
      const assetId = img.getAttribute('data-asset_id')

      // Create a wrapper div for the image
      const wrapper = document.createElement('div')
      wrapper.className = 'my-3 inline-block max-w-full'

      const newImg = document.createElement('img')

      // If it's a Monday.com protected image with assetId, proxy it through our backend
      if (assetId && originalSrc && originalSrc.includes('monday.com')) {
        newImg.src = `/api/monday/image-proxy?assetId=${assetId}`
        newImg.setAttribute('data-asset_id', assetId)
      } else {
        // Use original src for non-Monday images
        newImg.src = originalSrc || ''
      }

      newImg.className = 'max-w-full h-auto rounded border border-gray-200 dark:border-[#4b4e69]'
      newImg.style.maxHeight = '400px'
      newImg.alt = 'Update image'

      wrapper.appendChild(newImg)
      img.replaceWith(wrapper)
    })

    // Style remaining elements
    const paragraphs = container.querySelectorAll('p')
    paragraphs.forEach((p) => {
      p.className = 'mb-3 text-gray-700 dark:text-[#d5d8df] leading-relaxed'
    })

    const divs = container.querySelectorAll('div')
    divs.forEach((d) => {
      if (!d.className || !d.className.includes('my-3')) {
        d.className = 'mb-2 text-gray-700 dark:text-[#d5d8df]'
      }
    })

    const breaks = container.querySelectorAll('br')
    breaks.forEach((br) => {
      br.className = 'block mb-1'
    })

    const links = container.querySelectorAll('a')
    links.forEach((link) => {
  link.className = 'text-primary hover:text-[#0060b9] dark:text-[#69a7ef] dark:hover:text-[#8bbcf3] underline font-medium transition-colors'
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
    })

    const boldElements = container.querySelectorAll('b, strong')
    boldElements.forEach((el) => {
      el.className = 'font-semibold text-gray-900 dark:text-[#d5d8df]'
    })

    const underlineElements = container.querySelectorAll('u')
    underlineElements.forEach((el) => {
      el.className = 'underline decoration-2 decoration-blue-500'
    })

    return (
      <div
        className="prose prose-sm max-w-none text-gray-700 dark:text-[#d5d8df]"
        dangerouslySetInnerHTML={{ __html: container.innerHTML }}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading updates...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadUpdates}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-[#0060b9]"
        >
          Retry
        </button>
      </div>
    )
  }

  if (updates.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-[#9699a6]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-[#d5d8df] mb-2">No Updates Yet</h3>
        <p className="text-gray-500 dark:text-[#9699a6]">This RFP has no activity updates.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#181b34] dark:to-[#181b34] rounded-lg p-6">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-200 dark:from-blue-900 dark:to-blue-700"></div>

        {/* Updates */}
        <div className="space-y-6">
          {updates.map((update) => (
            <div key={update.id} className="relative pl-16">
              {/* Avatar circle */}
              <div
                className="absolute left-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold border-4 border-white dark:border-[#30324e] shadow-lg ring-2 ring-gray-200 dark:ring-[#4b4e69]"
                style={{ backgroundColor: getAvatarColor(update.creator.email) }}
                title={update.creator.name}
              >
                {getInitials(update.creator.name)}
              </div>

              {/* Update card */}
              <div className="bg-white dark:bg-[#30324e] border border-gray-300 dark:border-[#4b4e69] rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-[#797e93]">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-50 to-white dark:from-[#292f4c] dark:to-[#30324e] px-4 py-3 border-b border-gray-200 dark:border-[#4b4e69] rounded-t-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-[#d5d8df]">{update.creator.name}</h4>
                      {update.creator.email && (
                        <p className="text-xs text-gray-600 dark:text-[#9699a6] mt-0.5">{update.creator.email}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end ml-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap dark:bg-blue-900 dark:text-blue-200">
                        {update.relativeTime}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-[#9699a6] mt-1">
                        {new Date(update.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body with HTML rendering */}
                <div className="p-4">
                  <div className="text-sm text-gray-700 dark:text-[#d5d8df] break-words leading-relaxed">
                    {renderHtmlContent(update.body)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default UpdatesTab

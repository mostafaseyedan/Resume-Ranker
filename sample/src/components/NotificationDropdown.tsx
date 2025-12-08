import { useState, useRef, useEffect } from 'react'
import { Bell, CircleCheck, Info } from 'lucide-react'
import { Button } from '@vibe/core'
import '@vibe/core/tokens'

// Types based on the 5 selected events
export type NotificationType =
    | 'dashboard_summary'
    | 'process_started'
    | 'rfp_analysis_completed'
    | 'proposal_review_completed'
    | 'foia_analysis_completed'

export interface Notification {
    id: string
    type: NotificationType
    title: string
    message: string
    timestamp: string
    read: boolean
    metadata?: any
}

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Start with empty list or load from localStorage
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('notifications')
            if (saved) {
                try {
                    return JSON.parse(saved)
                } catch (e) {
                    console.error('Failed to parse notifications', e)
                }
            }
        }
        return []
    })

    const unreadCount = notifications.filter(n => !n.read).length

    // Persist notifications whenever they change
    useEffect(() => {
        localStorage.setItem('notifications', JSON.stringify(notifications))
    }, [notifications])

    // Listen for global app notifications
    useEffect(() => {
        const handleNotification = (event: CustomEvent<Notification>) => {
            setNotifications(prev => {
                // Deduplication: Check if ID already exists
                if (prev.some(n => n.id === event.detail.id)) {
                    return prev
                }
                return [event.detail, ...prev]
            })
        }

        window.addEventListener('app-notification', handleNotification as EventListener)

        return () => {
            window.removeEventListener('app-notification', handleNotification as EventListener)
        }
    }, [])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleMarkAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, read: true } : n))
        )
    }

    const handleMarkAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'dashboard_summary':
                return <Info className="h-4 w-4 text-blue-500" />
            case 'process_started':
                return <Bell className="h-4 w-4 text-yellow-500" />
            case 'rfp_analysis_completed':
            case 'proposal_review_completed':
            case 'foia_analysis_completed':
                return <CircleCheck className="h-4 w-4 text-green-500" />
            default:
                return <Bell className="h-4 w-4 text-gray-500" />
        }
    }

    const formatTime = (isoString: string) => {
        const date = new Date(isoString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()

        // Less than 1 minute
        if (diff < 1000 * 60) {
            return 'Just now'
        }

        // Less than 1 hour
        if (diff < 1000 * 60 * 60) {
            const minutes = Math.floor(diff / (1000 * 60))
            return `${minutes}m ago`
        }

        // Less than 24 hours
        if (diff < 1000 * 60 * 60 * 24) {
            const hours = Math.floor(diff / (1000 * 60 * 60))
            return `${hours}h ago`
        }

        return date.toLocaleDateString()
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                kind="tertiary"
                size="small"
                className="relative"
                ariaLabel="Notifications"
            >
                <Bell className="h-5 w-5 text-gray-600 dark:text-[#9699a6]" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#30324e]"></span>
                )}
            </Button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 sm:w-[28rem] origin-top-right rounded-md bg-white dark:bg-[#30324e] shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-200 dark:border-[#4b4e69]">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#4b4e69]">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#d5d8df]">Notifications</h3>
                        {unreadCount > 0 && (
                            <Button
                                onClick={handleMarkAllAsRead}
                                kind="tertiary"
                                size="small"
                                className="text-xs !p-0 h-auto min-h-0 text-primary hover:text-[#0060b9] dark:text-[#69a7ef] dark:hover:text-[#8bbcf3] font-medium"
                            >
                                Mark all as read
                            </Button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-gray-500 dark:text-[#9699a6]">
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-[#4b4e69]">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#323861] transition-colors cursor-pointer border-l-2 ${!notification.read ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-500' : 'border-transparent'}`}
                                        onClick={() => {
                                            handleMarkAsRead(notification.id)
                                            if (notification.metadata?.rfp) {
                                                window.dispatchEvent(new CustomEvent('open-rfp-detail', {
                                                    detail: notification.metadata.rfp
                                                }))
                                                setIsOpen(false)
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar / Icon */}
                                            <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center">
                                                {getIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900 dark:text-[#d5d8df]' : 'text-gray-600 dark:text-[#9699a6]'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-[#9699a6] mt-0.5 break-words">
                                                    {notification.message}
                                                </p>
                                            </div>

                                            {/* Time & Dot */}
                                            <div className="flex flex-col items-end gap-1 min-w-[60px]">
                                                <span className="text-[10px] text-gray-400 dark:text-[#797e93]">
                                                    {formatTime(notification.timestamp)}
                                                </span>
                                                {!notification.read && (
                                                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationDropdown

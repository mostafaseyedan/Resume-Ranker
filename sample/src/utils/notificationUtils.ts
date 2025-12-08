
export interface NotificationEventDetail {
    id: string
    type: string
    title: string
    message: string
    timestamp: string
    read: boolean
    metadata?: any
}

export const emitNotification = (
    type: string,
    title: string,
    message: string,
    metadata?: any,
    id?: string
) => {
    const event = new CustomEvent<NotificationEventDetail>('app-notification', {
        detail: {
            id: id || Math.random().toString(36).substring(7),
            type,
            title,
            message,
            timestamp: new Date().toISOString(),
            read: false,
            metadata
        }
    })
    window.dispatchEvent(event)
}

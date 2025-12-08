import { create } from 'zustand'

interface User {
  email: string
  name: string
}

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  refreshInterval: NodeJS.Timeout | null
  checkAuth: () => Promise<void>
  logout: () => void
  startRefreshInterval: () => void
  stopRefreshInterval: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  refreshInterval: null,

  checkAuth: async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        set({
          isAuthenticated: data.authenticated,
          user: data.user || null,
          isLoading: false
        })

        // Start periodic refresh check if authenticated
        if (data.authenticated) {
          get().startRefreshInterval()
        }
      } else {
        set({ isAuthenticated: false, user: null, isLoading: false })
        get().stopRefreshInterval()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      set({ isAuthenticated: false, user: null, isLoading: false })
      get().stopRefreshInterval()
    }
  },

  startRefreshInterval: () => {
    const state = get()

    // Clear existing interval if any
    if (state.refreshInterval) {
      clearInterval(state.refreshInterval)
    }

    // Check auth status and refresh token every 5 minutes
    const interval = setInterval(async () => {
      try {
        const statusResponse = await fetch('/api/auth/status', { credentials: 'include' })

        if (!statusResponse.ok) {
          // Try to refresh the token
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          })

          if (!refreshResponse.ok) {
            // Refresh failed, user needs to re-authenticate
            console.warn('[Auth] Token refresh failed, redirecting to login')
            get().stopRefreshInterval()
            window.location.href = '/api/auth/microsoft/signin'
          } else {
            console.log('[Auth] Token refreshed successfully')
          }
        }
      } catch (error) {
        console.error('[Auth] Periodic auth check failed:', error)
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    set({ refreshInterval: interval })
  },

  stopRefreshInterval: () => {
    const state = get()
    if (state.refreshInterval) {
      clearInterval(state.refreshInterval)
      set({ refreshInterval: null })
    }
  },

  logout: () => {
    // Stop refresh interval
    get().stopRefreshInterval()
    // Redirect to backend logout endpoint
    window.location.href = '/api/auth/logout'
  }
}))

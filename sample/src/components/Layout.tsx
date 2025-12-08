import { useAuthStore } from '@/stores/authStore'
import ThemeToggle from './ThemeToggle'
import NotificationDropdown from './NotificationDropdown'
import { Button } from '@vibe/core'
import '@vibe/core/tokens'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className="h-screen bg-gray-50 dark:bg-[#181b34] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-[#30324e] shadow-sm border-b dark:border-[#4b4e69] flex-shrink-0">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0 flex items-center gap-3">
            <img
              alt="logo"
              loading="lazy"
              width="30"
              height="30"
              decoding="async"
              className="flex-shrink-0"
              style={{color: 'transparent'}}
              src="/images/cendien_corp_logo.jpg"
            />
            <h1 className="text-base font-semibold text-gray-700 dark:text-[#d5d8df]">SalesIQ</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-5">
            <nav className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#9699a6] sm:gap-5">
              <a
                href="https://reconrfp.cendien.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#323861] hover:text-gray-900 dark:hover:text-[#d5d8df]"
              >
                RFPHub
              </a>
              <a
                href="https://cendien.monday.com/boards/4374039553"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#323861] hover:text-gray-900 dark:hover:text-[#d5d8df]"
              >
                Monday
              </a>
              <a
                href="https://resume.cendien.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#323861] hover:text-gray-900 dark:hover:text-[#d5d8df]"
              >
                TalentMax
              </a>
              <a
                href="https://rag.cendien.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-[#323861] hover:text-gray-900 dark:hover:text-[#d5d8df]"
              >
                RAG
              </a>
            </nav>
            {/* Theme toggle */}
            <ThemeToggle />
            <NotificationDropdown />
            <Button
              onClick={logout}
              kind="tertiary"
              size="small"
              ariaLabel="Logout"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </Button>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

export default Layout

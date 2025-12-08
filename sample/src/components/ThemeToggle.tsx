import { useEffect, useState } from 'react'
import { Button } from '@vibe/core'
import '@vibe/core/tokens'

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  useEffect(() => {
    if (theme === 'dark') {
      // Add dark class to html element for Tailwind
      document.documentElement.classList.add('dark')
      // Add Vibe dark theme class to body element
      document.body.classList.remove('light-app-theme')
      document.body.classList.add('dark-app-theme')
      localStorage.setItem('theme', 'dark')
    } else {
      // Add light class to html element for Tailwind
      document.documentElement.classList.remove('dark')
      // Add Vibe light theme class to body element
      document.body.classList.remove('dark-app-theme')
      document.body.classList.add('light-app-theme')
      localStorage.setItem('theme', 'light')
    }
  }, [theme])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
  }

  return (
    <Button
      onClick={toggle}
      kind="tertiary"
      size="small"
      ariaLabel={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        // Moon icon
        <svg className="h-5 w-5 text-gray-600 dark:text-[#9699a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ) : (
        // Sun icon
        <svg className="h-5 w-5 text-gray-600 dark:text-[#9699a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0l-1.414 1.414M7.05 16.95l-1.414 1.414" />
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
        </svg>
      )}
    </Button>
  )
}

export default ThemeToggle

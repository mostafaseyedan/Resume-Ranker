import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Initialize theme before rendering to avoid FOUC
(() => {
  try {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = saved ?? (prefersDark ? 'dark' : 'light')
    if (theme === 'dark') {
      // Tailwind dark mode (html element)
      document.documentElement.classList.add('dark')
      // Vibe dark mode (body element)
      document.body.classList.add('dark-app-theme')
      document.body.classList.remove('light-app-theme')
    } else {
      // Tailwind light mode (html element)
      document.documentElement.classList.remove('dark')
      // Vibe light mode (body element)
      document.body.classList.add('light-app-theme')
      document.body.classList.remove('dark-app-theme')
    }
  } catch {
    // noop
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@vibe/core'
import '@vibe/core/tokens'

const Login = () => {
  const navigate = useNavigate()

  const handleLogin = () => {
    // Redirect to backend Microsoft OAuth endpoint
    window.location.href = '/api/auth/microsoft/signin'
  }

  useEffect(() => {
    // Check if user is already authenticated
    fetch('/api/auth/status', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          navigate('/', { replace: true })
        }
      })
      .catch(() => {
        // User not authenticated, stay on login page
      })
  }, [navigate])

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-white dark:bg-[#181b34]">
      {/* Left side: Login form */}
      <div className="relative flex flex-col gap-2 p-2">
        <div className="absolute left-5 top-5 flex">
          <img
            src="/images/cendien_corp_logo.jpg"
            alt="AI RFP Service Logo"
            className="h-auto w-[70px] max-h-[70px] object-contain"
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[320px]">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-[#d5d8df]">Login to access the app</h1>
              </div>

              <div className="grid gap-2">
                <Button
                  onClick={handleLogin}
                  kind="secondary"
                  className="w-full justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="h-4 w-4 flex-shrink-0">
                    <path fill="#f35325" d="M1 1h10v10H1z"></path>
                    <path fill="#81bc06" d="M12 1h10v10H12z"></path>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"></path>
                    <path fill="#ffba08" d="M12 12h10v10H12z"></path>
                  </svg>
                  Continue with Microsoft
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Background image */}
      <div className="relative hidden overflow-hidden bg-muted dark:bg-[#30324e] lg:block">
        <img
          src="/images/team2.png"
          alt="Team collaboration"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
    </div>
  )
}

export default Login

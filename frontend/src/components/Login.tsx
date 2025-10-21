import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';

const Login: React.FC = () => {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((error) => {
      console.error('Login error:', error);
    });
  };

  useEffect(() => {
    // Auto-initiate login if user lands on login page
    const urlParams = new URLSearchParams(window.location.search);
    const autoLogin = urlParams.get('auto');
    if (autoLogin === 'true') {
      handleLogin();
    }
  }, []);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col">
        <div className="pt-8 pl-2">
          <img
            src="/cendien-logo.svg"
            alt="Cendien's AI Resume Service"
            className="w-[300px] h-auto"
          />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xs">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Login to access the app</h1>
              </div>

              <div className="grid gap-2">
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 w-[320px] h-[40px] px-6 shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                    <path fill="#f35325" d="M1 1h10v10H1z"></path>
                    <path fill="#81bc06" d="M12 1h10v10H12z"></path>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"></path>
                    <path fill="#ffba08" d="M12 12h10v10H12z"></path>
                  </svg>
                  Continue with Microsoft
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block overflow-hidden">
        <img
          src="/team2.png"
          alt="Team collaboration"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
};

export default Login;
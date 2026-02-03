import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';
import { Button } from '@vibe/core';
import '@vibe/core/tokens';

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
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xs">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Login to access the app</h1>
              </div>

              <div className="grid gap-2">
                <Button
                  onClick={handleLogin}
                  kind="secondary"
                  size="medium"
                  leftIcon={() => (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                      <path fill="#f35325" d="M1 1h10v10H1z"></path>
                      <path fill="#81bc06" d="M12 1h10v10H12z"></path>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"></path>
                      <path fill="#ffba08" d="M12 12h10v10H12z"></path>
                    </svg>
                  )}
                  className="w-[320px] h-[40px] !bg-white !border-gray-300 !text-gray-900 hover:!bg-gray-50 shadow-sm"
                >
                  Continue with Microsoft
                </Button>
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
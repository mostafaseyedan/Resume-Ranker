import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';

const MicrosoftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 23 23"
    className="h-4 w-4 shrink-0"
    aria-hidden
  >
    <path fill="#f35325" d="M1 1h10v10H1z" />
    <path fill="#81bc06" d="M12 1h10v10H12z" />
    <path fill="#05a6f0" d="M1 12h10v10H1z" />
    <path fill="#ffba08" d="M12 12h10v10H12z" />
  </svg>
);

const Login: React.FC = () => {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((error) => {
      if (error.errorCode === 'interaction_in_progress') {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('msal.'))
          .forEach((k) => sessionStorage.removeItem(k));
        instance.loginRedirect(loginRequest).catch(console.error);
      } else {
        console.error('Login error:', error);
      }
    });
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auto') === 'true') {
      handleLogin();
    }
  }, []);

  return (
    <div className="grid min-h-screen bg-gray-50 dark:bg-canvas lg:grid-cols-2">
      <div className="relative flex flex-col bg-white dark:bg-surface">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <BrandLogo size={44} />
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-ink">Welcome back</h1>
                  <p className="text-sm text-muted-foreground">Sign in to continue to TalentMax</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-gray-300 dark:border-line bg-white dark:bg-canvas-deep px-4 text-sm font-medium text-gray-900 dark:text-ink shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover"
              >
                <MicrosoftIcon />
                Continue with Microsoft
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-muted dark:bg-canvas-deep lg:block">
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

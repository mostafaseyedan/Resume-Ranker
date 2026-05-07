import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { Toaster } from 'sonner';
import { msalConfig } from './config/msalConfig';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './index.css';

const msalInstance = new PublicClientApplication(msalConfig);

const App: React.FC = () => {
  const [msalReady, setMsalReady] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => {
      msalInstance.handleRedirectPromise().catch((error) => {
        console.error('MSAL redirect error:', error);
      });
      setMsalReady(true);
    });
  }, []);

  if (!msalReady) return null;

  return (
    <MsalProvider instance={msalInstance}>
      <ThemeProvider>
        <Router>
          <div className="App">
            <Toaster position="top-right" richColors closeButton />
            <AuthenticatedTemplate>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthenticatedTemplate>

            <UnauthenticatedTemplate>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </UnauthenticatedTemplate>
          </div>
        </Router>
      </ThemeProvider>
    </MsalProvider>
  );
};

export default App;

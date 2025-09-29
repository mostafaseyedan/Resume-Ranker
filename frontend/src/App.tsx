import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './config/msalConfig';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './index.css';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL instance and handle redirects
const initializeMsal = async () => {
  await msalInstance.initialize();

  // Handle redirect promise after initialization
  msalInstance.handleRedirectPromise().then((response) => {
    if (response) {
      console.log('Login successful:', response);
    }
  }).catch((error) => {
    console.error('MSAL redirect error:', error);
  });
};

// Initialize MSAL
initializeMsal();

const App: React.FC = () => {
  return (
    <MsalProvider instance={msalInstance}>
      <Router>
        <div className="App">
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
    </MsalProvider>
  );
};

export default App;

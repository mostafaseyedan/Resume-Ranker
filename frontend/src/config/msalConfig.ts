import { Configuration, RedirectRequest } from '@azure/msal-browser';

// MSAL configuration
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
    authority: import.meta.env.VITE_AZURE_AUTHORITY || `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  }
};

// Add scopes for access token request
export const loginRequest: RedirectRequest = {
  scopes: ['User.Read'],
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
};

// Add scopes for API access
export const apiRequest = {
  scopes: ['User.Read'],
};
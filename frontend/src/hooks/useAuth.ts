import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';
import { apiService } from '../services/apiService';

export const useAuth = () => {
  const { instance, accounts } = useMsal();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authenticateWithBackend = async () => {
      if (accounts.length > 0) {
        try {
          // Get access token from MSAL
          const tokenResponse = await instance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0]
          });

          // Send token to backend for session creation
          await apiService.login(tokenResponse.accessToken, window.location.origin + '/auth/callback');

          setIsAuthenticated(true);
        } catch (error) {
          console.error('Backend authentication failed:', error);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    authenticateWithBackend();
  }, [accounts, instance]);

  return { isAuthenticated, isLoading };
};
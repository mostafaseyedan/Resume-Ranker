import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';

const photoCache = new Map<string, string>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Fetches the signed-in user's Microsoft 365 profile photo (User.Read).
 * Returns a blob object URL; cached per email for the session.
 */
export function useGraphUserPhoto(email?: string | null): string | null {
  const { instance, accounts } = useMsal();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const account = accounts[0];
    if (!account || !email) {
      setPhotoUrl(null);
      return;
    }

    const accountEmail = normalizeEmail(account.username || '');
    const targetEmail = normalizeEmail(email);
    if (accountEmail !== targetEmail) {
      setPhotoUrl(null);
      return;
    }

    const cached = photoCache.get(accountEmail);
    if (cached) {
      setPhotoUrl(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        });
        if (!response.ok || cancelled) {
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        photoCache.set(accountEmail, objectUrl);
        setPhotoUrl(objectUrl);
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, accounts, instance]);

  return photoUrl;
}

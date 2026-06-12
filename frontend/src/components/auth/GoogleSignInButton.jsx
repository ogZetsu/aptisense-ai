import React, { useEffect, useRef, useState } from 'react';
import { loginWithGoogle } from '../../services/api';

export function GoogleSignInButton({ mode = 'continue_with', onSuccess, onError, disabled = false }) {
  const googleButtonRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) {
      onError?.('Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    let cancelled = false;
    const scriptId = 'google-identity-services';

    const initializeGoogle = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            onError?.('Google sign-in failed. Please try again.');
            return;
          }

          setLoading(true);
          try {
            const res = await loginWithGoogle(response.credential);
            const token = res.access_token || res.token;
            const user = res.user || res;
            onSuccess?.(user, token);
          } catch (err) {
            onError?.(err?.response?.data?.detail || 'Google login failed');
          } finally {
            setLoading(false);
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: mode,
      });
    };

    const existing = document.getElementById(scriptId);
    if (existing) {
      if (window.google?.accounts?.id && googleButtonRef.current) {
        initializeGoogle();
      } else {
        existing.addEventListener('load', initializeGoogle);
      }
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => onError?.('Unable to load Google Sign-In. Please retry.');
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, mode, onSuccess, onError]);

  return (
    <div className={`google-signin-wrap${disabled ? ' is-disabled' : ''}`}>
      <div ref={googleButtonRef} />
      {loading && <p className="auth-helper-text">Signing in with Google...</p>}
    </div>
  );
}

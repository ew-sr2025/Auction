import { useEffect, useRef } from 'react';

let googleScriptPromise;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        googleScriptPromise = null;
        reject(new Error('Google kirish oynasini yuklab bo‘lmadi'));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleSignInButton({ disabled, onCredential, onError }) {
  const buttonRef = useRef(null);
  const disabledRef = useRef(disabled);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  disabledRef.current = disabled;
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return undefined;

    let active = true;
    loadGoogleIdentity()
      .then((google) => {
        if (!active || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (disabledRef.current) return;
            if (!credential) {
              onErrorRef.current(new Error('Google tokeni olinmadi'));
              return;
            }
            onCredentialRef.current(credential);
          },
        });
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 360,
          locale: 'uz',
        });
      })
      .catch((error) => {
        if (active) onErrorRef.current(error);
      });

    return () => {
      active = false;
      if (buttonRef.current) buttonRef.current.replaceChildren();
    };
  }, [clientId]);

  if (!clientId) {
    return <p className="muted small">Google orqali kirish sozlanmagan.</p>;
  }

  return <div className="google-signin" ref={buttonRef} />;
}

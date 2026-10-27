import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// WebAuthn RP ID is fixed to the stable production hostname.
// Redirect deployment-specific Vercel URLs before mounting the app so a passkey
// request cannot accidentally run under a different origin.
const canonicalHost = 'ex1-passkey.vercel.app';
if (window.location.hostname.endsWith('.vercel.app') && window.location.hostname !== canonicalHost) {
  window.location.replace(`https://${canonicalHost}${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

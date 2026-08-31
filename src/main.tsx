import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { registerSW } from 'virtual:pwa-register';
import { logErrorToFirestore } from './lib/diagnostics';

// Register PWA service worker — NOT immediate so it doesn't block the first paint
if ('serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: false,
      onRegisterError(error) {
        console.warn('[PWA] Service worker registration notice (non-fatal):', error);
      }
    });
  } catch (e) {
    console.warn('[PWA] Service worker register failed (non-fatal):', e);
  }
}

// ── Global failure observability (Phase 22) ─────────────────────────────────
// Captures uncaught errors and unhandled promise rejections so production
// failures surface in the error_logs collection even when no UI path catches
// them. Rate-limited and secret-free (see lib/diagnostics.ts).
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('QuotaExceeded') || msg.includes('CacheStorage') || msg.includes('beforeinstallprompt')) {
    console.warn('[Storage/PWA] Non-fatal browser notice:', msg);
    return;
  }
  logErrorToFirestore({
    message: msg || 'Unknown window error',
    stack: event.error instanceof Error ? event.error.stack : undefined,
    category: 'UNKNOWN_ERROR'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? '');
  if (msg.includes('QuotaExceeded') || msg.includes('CacheStorage') || msg.includes('idb-set') || msg.includes('beforeinstallprompt')) {
    console.warn('[Storage/PWA] Non-fatal browser storage notice:', msg);
    return;
  }
  logErrorToFirestore({
    message: msg || 'Unhandled promise rejection',
    stack: reason instanceof Error ? reason.stack : undefined,
    category: 'UNKNOWN_ERROR'
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

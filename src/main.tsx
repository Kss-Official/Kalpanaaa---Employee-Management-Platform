import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { registerSW } from 'virtual:pwa-register';
import { logErrorToFirestore } from './lib/diagnostics';

// Register PWA service worker — NOT immediate so it doesn't block the first paint
if ('serviceWorker' in navigator) {
  registerSW({ immediate: false });
}

// ── Global failure observability (Phase 22) ─────────────────────────────────
// Captures uncaught errors and unhandled promise rejections so production
// failures surface in the error_logs collection even when no UI path catches
// them. Rate-limited and secret-free (see lib/diagnostics.ts).
window.addEventListener('error', (event) => {
  logErrorToFirestore({
    message: event.message || 'Unknown window error',
    stack: event.error instanceof Error ? event.error.stack : undefined,
    category: 'UNKNOWN_ERROR'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  logErrorToFirestore({
    message: reason instanceof Error ? reason.message : String(reason ?? 'Unhandled promise rejection'),
    stack: reason instanceof Error ? reason.stack : undefined,
    category: 'UNKNOWN_ERROR'
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

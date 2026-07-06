import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from '@/App.jsx'
import '@/index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // Only enable in production to keep dev console clean
  enabled: import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
});

if (import.meta.env.DEV) {
  const originalError = console.error;
  console.error = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('QUIC_TOO_MANY_RTOS')) return;
    originalError(...args);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary
    fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>A critical error occurred</h2>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '8px 20px', cursor: 'pointer' }}>
            Reload page
          </button>
        </div>
      </div>
    }
  >
    <App />
  </Sentry.ErrorBoundary>
)
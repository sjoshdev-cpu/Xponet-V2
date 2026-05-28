import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if (import.meta.env.DEV) {
  const originalError = console.error;
  console.error = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('QUIC_TOO_MANY_RTOS')) return;
    originalError(...args);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
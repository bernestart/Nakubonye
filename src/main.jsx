import "./lib/authFetch.js";
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

// Validate token before boot: keep valid sessions, clear stale ones (Roadmap P1 cleanup).
try {
  const tok = localStorage.getItem('auth_token');
  // Synchronous: obviously-bad format (Better Auth tokens are >=20 chars)
  if (tok && tok.length < 20) {
    console.log('[boot] removed malformed token');
    localStorage.removeItem('auth_token');
  } else if (tok) {
    // Async: verify against /api/whoami, clear only on real 401
    fetch('https://nakubonye.bernestart.workers.dev/api/whoami')
      .then(r => { if (r.status === 401) { console.log('[boot] removed stale token'); localStorage.removeItem('auth_token'); } })
      .catch(() => { /* network error — keep token, next request will retry */ });
  }
} catch(e) {}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#ff5555', background: '#111', height: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ fontSize: 18 }}>App Crashed!</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{this.state.error.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#888' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

ReactDOM.
// P5: Global Error Logger
window.addEventListener('error', (event) => {
  try {
    fetch('https://nakubonye.bernestart.workers.dev/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: event.message,
        stack: event.error?.stack || '',
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).catch(() => {});
  } catch (e) {}
});
window.addEventListener('unhandledrejection', (event) => {
  try {
    fetch('https://nakubonye.bernestart.workers.dev/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: event.reason?.message || String(event.reason),
        stack: event.reason?.stack || '',
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).catch(() => {});
  } catch (e) {}
});

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </ErrorBoundary>
)

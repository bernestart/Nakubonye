import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

// FORCE CLEAR BAD TOKEN SO APP BOOTS
try { localStorage.removeItem('auth_token'); } catch(e) {}

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </ErrorBoundary>
)

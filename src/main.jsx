import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

const root = createRoot(document.getElementById('root'))

root.render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

// Hide the splash screen the moment React has mounted.
// Slight delay (180ms) so the transition is smooth rather than jarring.
requestAnimationFrame(() => {
  setTimeout(() => {
    const splash = document.getElementById('nk-splash')
    if (!splash) return
    splash.classList.add('nk-hidden')
    setTimeout(() => splash.remove(), 400)
  }, 180)
})

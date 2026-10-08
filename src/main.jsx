import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { Capacitor } from '@capacitor/core'
import { AndroidSystemBars } from 'capacitor-android-system-bars'
import { SplashScreen } from '@capacitor/splash-screen'
import { shareContent } from './lib/share.js'

// Global share shim
if (Capacitor.isNativePlatform()) {
  try {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data) => shareContent(data || {}),
    })
  } catch (e) { console.warn('share shim failed', e) }
}

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

// ---------- Native system bars ----------
if (Capacitor.isNativePlatform()) {
  AndroidSystemBars.initialize()
    .then(async (info) => {
      console.log('[SystemBars] init', info)
      await AndroidSystemBars.setSystemBarsStyle({
        statusBar:     { style: 'DARK', color: '#4C1D95' },
        navigationBar: { style: 'DARK', color: '#1A0A38' },
      })
      const insets = await AndroidSystemBars.getInsets()
      const r = document.documentElement
      r.style.setProperty('--safe-top',    `${insets.top}px`)
      r.style.setProperty('--safe-bottom', `${insets.bottom}px`)
      console.log('[SystemBars] insets', insets)
    })
    .catch((e) => console.error('[SystemBars] init failed:', e))
}

requestAnimationFrame(() => {
  setTimeout(() => {
    const splash = document.getElementById('nk-splash')
    if (splash) {
      splash.classList.add('nk-hidden')
      setTimeout(() => splash.remove(), 400)
    }
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {})
    }
  }, 180)
})

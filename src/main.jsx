import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { Capacitor } from '@capacitor/core'
import { AndroidSystemBars } from 'capacitor-android-system-bars'
import { SplashScreen } from '@capacitor/splash-screen'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './lib/supabase'
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

// ---------- Push notifications ----------
let pushListenersSetup = false

async function setupPush() {
  if (!Capacitor.isNativePlatform()) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return  // not logged in — nothing to register

  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') {
    console.log('[Push] permission not granted:', perm.receive)
    return
  }

  // Android O+ requires a channel for notifications to appear
  try {
    await PushNotifications.createChannel({
      id: 'default',
      name: 'Default',
      description: 'General notifications',
      importance: 5,
      visibility: 1,
    })
  } catch (e) { console.warn('[Push] channel create failed:', e) }

  // Set up listeners once (avoid duplicate handlers on repeated sign-ins)
  if (!pushListenersSetup) {
    pushListenersSetup = true

    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] FCM token received:', token.value.slice(0, 20) + '…')
      const { error } = await supabase
        .from('device_tokens')
        .upsert(
          { user_id: user.id, token: token.value, platform: 'android' },
          { onConflict: 'user_id,token' }
        )
      if (error) console.error('[Push] save token failed:', error)
      else console.log('[Push] ✅ token saved to Supabase')
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] registration error:', err)
    })

    PushNotifications.addListener('pushNotificationReceived', (n) => {
      console.log('[Push] received:', n)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] action performed:', action)
      // Later: navigate based on action.notification.data.url
    })
  }

  // Trigger the token registration
  await PushNotifications.register()
}

// Bootstrap push: once now (if already logged in), and on every sign-in
if (Capacitor.isNativePlatform()) {
  setupPush().catch(e => console.error('[Push] setup failed:', e))

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      setupPush().catch(e => console.error('[Push] post-login setup failed:', e))
    }
  })
}

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
    })
    .catch((e) => console.error('[SystemBars] init failed:', e))
}

// ---------- React ----------
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

// Hide HTML + native splash
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

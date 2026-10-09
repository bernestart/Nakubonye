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
import { LocalNotifications } from '@capacitor/local-notifications'
import { supabase } from './lib/supabase'
import { shareContent } from './lib/share.js'
import { syncMissedNotifications, markPushReceived, markNotifSeen } from './lib/notifSync.js'

// ---------- Push tap buffer (survives async setup) ----------
// Android cold-starts the app on tap. setupPush() awaits auth before
// registering listeners — the tap event fires before that. Buffer it.
window.__nkPendingTap = window.__nkPendingTap || null

function bufferTap(payload) {
  if (!payload) return
  window.__nkPendingTap = payload
  try {
    window.dispatchEvent(new CustomEvent("nk-push-tapped", { detail: payload }))
  } catch (e) { console.warn("[Push] tap dispatch failed", e) }
}

if (Capacitor.isNativePlatform()) {
  try {
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[Push] action performed (early):", action)
      bufferTap(action?.notification)
    })
    LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const extra = action?.notification?.extra || {}
      bufferTap({ data: extra })
    })
  } catch (e) { console.warn("[Push] early tap listeners failed", e) }
}

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

  // Android O+ also requires a channel for LOCAL notifications
  try {
    await LocalNotifications.createChannel({
      id: 'default',
      name: 'Default',
      description: 'General notifications',
      importance: 5,
      visibility: 1,
    })
  } catch (e) { console.warn('[Local] channel create failed:', e) }

  // Set up listeners once (avoid duplicate handlers on repeated sign-ins)
  if (!pushListenersSetup) {
    pushListenersSetup = true

    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] FCM token received:', token.value.slice(0, 20) + '…')
      const { data: { user: freshUser } } = await supabase.auth.getUser()
      if (!freshUser) { console.log('[Push] no user — skipping token save'); return }
      const { error } = await supabase
        .from('device_tokens')
        .upsert(
          { user_id: freshUser.id, token: token.value, platform: 'android' },
          { onConflict: 'token' }
        )
      if (error) console.error('[Push] save token failed:', error)
      else console.log('[Push] ✅ token transferred to', freshUser.id)
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] registration error:', err)
    })

    PushNotifications.addListener('pushNotificationReceived', async (n) => {
      console.log('[Push] received:', n)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          markPushReceived(user.id)
          const notifId = n?.data?.notification_id
          if (notifId) markNotifSeen(user.id, notifId)
        }
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('nk-push-received', { detail: n }))
      } catch (e) { console.warn('[Push] dispatch failed', e) }

      // Show native heads-up in the system shade even though app is foregrounded
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Date.now() % 2147483647),
            title: n.title || 'Nakubonye',
            body: n.body || '',
            channelId: 'default',
            autoCancel: true,
            extra: n.data || {},
          }],
        })
      } catch (e) { console.warn('[Local] schedule failed', e) }
    })

    // Tap listeners registered at module load (see bufferTap above)

    // Local-notification tap listener registered at module load
  }

  // Trigger the token registration
  await PushNotifications.register()
}

// Bootstrap push: once now (if already logged in), and on every sign-in
if (Capacitor.isNativePlatform()) {
  setupPush().catch(e => console.error('[Push] setup failed:', e))

  // Catch-up: boot
  setTimeout(() => { syncMissedNotifications().catch(() => {}) }, 3500)

  // Catch-up: network regain
  window.addEventListener('online', () => {
    // Delay: give FCM a moment to flush any queued pushes first
    setTimeout(() => { syncMissedNotifications().catch(() => {}) }, 5000)
  })

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      setupPush().catch(e => console.error('[Push] post-login setup failed:', e))
      setTimeout(() => { syncMissedNotifications().catch(() => {}) }, 2000)
    }
    if (event === 'SIGNED_OUT') {
      // Release this device's token so the logged-out user stops receiving
      supabase.rpc('deactivate_my_device_token')
        .then(({ error }) => {
          if (error) console.warn('[Push] deactivate RPC failed:', error)
          else console.log('[Push] token released on sign-out')
        })
        .catch(e => console.warn('[Push] deactivate failed', e))
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

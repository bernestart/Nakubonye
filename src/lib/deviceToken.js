import { API_BASE_URL } from './api';

const KEY_FCM_TOKEN = 'nk-fcm-token'

export function cacheFcmToken(token) {
  try { if (token) localStorage.setItem(KEY_FCM_TOKEN, token) } catch {}
}

export function getCachedFcmToken() {
  try { return localStorage.getItem(KEY_FCM_TOKEN) } catch { return null }
}

/**
 * Bind this device's FCM token to the currently signed-in user.
 * Idempotent. Uses onConflict:'token' so the physical token row is
 * TRANSFERRED from whichever user previously owned it (last-active-user-wins).
 * Must be called while authenticated. No-op if FCM token not yet cached.
 */
export async function bindDeviceToken() {
  const token = getCachedFcmToken()
  if (!token) return false
  const whoamiRes = await fetch(`${API_BASE_URL}/api/whoami`).then(r => r.json()).catch(() => ({ success: false }))
  const user = whoamiRes.success ? whoamiRes.user : null
  if (!user) return false
  const bindRes = await fetch(`${API_BASE_URL}/api/device-tokens/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'android' })
      }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
      const error = bindRes.success ? null : { message: bindRes.error || 'Bind failed' }
  if (error) { console.warn('[token] bind failed', error); return false }
  console.log('[token] bound to', user.id)
  return true
}

/**
 * Detach this device from the currently signed-in user.
 * MUST be called BEFORE signOut(), otherwise auth.uid()
 * is null inside the RPC and the delete silently no-ops.
 */
export async function detachDeviceToken() {
  try {
    const whoamiRes = await fetch(`${API_BASE_URL}/api/whoami`).then(r => r.json()).catch(() => ({ success: false }))
    const user = whoamiRes.success ? whoamiRes.user : null
    if (!user) return
    const dtRes = await fetch(`${API_BASE_URL}/api/device-tokens/deactivate`, { method: 'POST' }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
    const error = dtRes.success ? null : { message: dtRes.error || 'Deactivate failed' }
    if (error) console.warn('[token] detach RPC failed', error)
    else console.log('[token] detached for', user.id)
  } catch (e) { console.warn('[token] detach failed', e) }
}

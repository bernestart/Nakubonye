import { supabase } from './supabase'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      { user_id: user.id, token, platform: 'android' },
      { onConflict: 'token' }
    )
  if (error) { console.warn('[token] bind failed', error); return false }
  console.log('[token] bound to', user.id)
  return true
}

/**
 * Detach this device from the currently signed-in user.
 * MUST be called BEFORE supabase.auth.signOut(), otherwise auth.uid()
 * is null inside the RPC and the delete silently no-ops.
 */
export async function detachDeviceToken() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('deactivate_my_device_token')
    if (error) console.warn('[token] detach RPC failed', error)
    else console.log('[token] detached for', user.id)
  } catch (e) { console.warn('[token] detach failed', e) }
}

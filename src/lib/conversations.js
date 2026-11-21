import { API_BASE_URL } from './api'

// Find or create the canonical DM conversation between the signed-in user and another user.
// The Worker (Neon) decides; identity comes from the session token, never from the client.
export async function findOrCreateConversation(otherUserId) {
  if (!otherUserId) return null
  const token = localStorage.getItem('auth_token')
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE_URL}/api/conversations/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ otherUserId: String(otherUserId) })
    })
    const json = await res.json().catch(() => null)
    if (json && json.success && json.id != null) return Number(json.id)
    console.warn('open conversation failed', json && json.error)
  } catch (e) { console.warn('open conversation failed', e) }
  return null
}

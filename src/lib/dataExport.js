import { API_BASE_URL } from './api';

// Gathers everything a user owns into a single JSON blob.
// Doesn't touch messages (privacy — those belong to both parties).
// Doesn't touch other users' data.
export async function buildUserExport(userId) {
  if (!userId) throw new Error("No user")

  const safe = async (fn) => {
    try { return await fn() } catch (e) { return { error: String(e) } }
  }

  const expRes = await fetch(`${API_BASE_URL}/api/user/data-export`).then(r => r.json()).catch(() => ({ success: false }))
  const exp = expRes.success ? (expRes.data || {}) : {}
  const profile = exp.profile ?? null
  const photos = exp.photos ?? []
  const posts = exp.posts ?? []
  const communityPosts = exp.communityPosts ?? []
  const reels = exp.reels ?? []
  const stories = exp.stories ?? []
  const comments = exp.comments ?? []
  const reactions = exp.likes ?? []
  const followsOut = exp.following ?? []
  const followsIn = exp.followers ?? []
  const matches = exp.matches ?? []
  const communityMemberships = exp.communities ?? []
  const listingSaves = exp.listingSaves ?? []
  const reelSaves = exp.reelSaves ?? []
  const userSettings = exp.settings ?? null
  const discoveryPreferences = exp.discoveryPreferences ?? null
  const notifications = exp.notifications ?? []
  const loginEvents = exp.loginEvents ?? []

  return {
    export_version: 1,
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profile || null,
    profile_photos: photos || [],
    user_posts: posts || [],
    community_posts: communityPosts || [],
    reels: reels || [],
    stories: stories || [],
    comments: comments || [],
    reactions: reactions || [],
    following: followsOut || [],
    followers: followsIn || [],
    matches: matches || [],
    communities: communityMemberships || [],
    listing_saves: listingSaves || [],
    reel_saves: reelSaves || [],
    settings: userSettings || null,
    discovery_preferences: discoveryPreferences || null,
    notifications: notifications || [],
    login_activity: loginEvents || [],
  }
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || ("nakubonye-export-" + Date.now() + ".json")
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

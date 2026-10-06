import { supabase } from "./supabase"

// Gathers everything a user owns into a single JSON blob.
// Doesn't touch messages (privacy — those belong to both parties).
// Doesn't touch other users' data.
export async function buildUserExport(userId) {
  if (!userId) throw new Error("No user")

  const safe = async (fn) => {
    try { return await fn() } catch (e) { return { error: String(e) } }
  }

  const [
    profile,
    photos,
    posts,
    communityPosts,
    reels,
    stories,
    comments,
    reactions,
    followsOut,
    followsIn,
    matches,
    communityMemberships,
    listingSaves,
    reelSaves,
    userSettings,
    discoveryPreferences,
    notifications,
    loginEvents,
  ] = await Promise.all([
    safe(() => supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then((r) => r.data)),
    safe(() => supabase.from("profile_photos").select("id, storage_path, is_primary, display_order, created_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("user_posts").select("id, content, image_path, image_paths, audience, created_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("community_posts").select("id, community_id, content, image_path, image_paths, created_at").eq("author_id", userId).then((r) => r.data)),
    safe(() => supabase.from("reels").select("id, video_url, thumbnail_url, caption, created_at, view_count").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("stories").select("id, media_url, media_type, caption, created_at, expires_at, audience").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("user_post_comments").select("id, post_id, content, created_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("user_post_likes").select("post_id, reaction, created_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("follows").select("following_id, created_at").eq("follower_id", userId).then((r) => r.data)),
    safe(() => supabase.from("follows").select("follower_id, created_at").eq("following_id", userId).then((r) => r.data)),
    safe(() => supabase.from("matches").select("user_one_id, user_two_id, created_at").or("user_one_id.eq." + userId + ",user_two_id.eq." + userId).then((r) => r.data)),
    safe(() => supabase.from("community_memberships").select("community_id, role, joined_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("listing_saves").select("listing_id, created_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("reel_saves").select("reel_id, created_at").eq("user_id", userId).then((r) => r.data)),
    safe(() => supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle().then((r) => r.data)),
    safe(() => supabase.from("discovery_preferences").select("*").eq("user_id", userId).maybeSingle().then((r) => r.data)),
    safe(() => supabase.from("notifications").select("id, type, body, created_at, read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500).then((r) => r.data)),
    safe(() => supabase.from("login_events").select("device_hint, method, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200).then((r) => r.data)),
  ])

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

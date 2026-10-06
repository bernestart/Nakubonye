import { supabase } from "./supabase"

let __ctxCache = new Map()

async function loadContext(viewerId, ownerId) {
  if (!viewerId || !ownerId || viewerId === ownerId) return { matched: false, isFollowerOfOwner: false }
  const key = viewerId + ":" + ownerId
  if (__ctxCache.has(key)) return __ctxCache.get(key)

  const [followRes, matchRes] = await Promise.all([
    supabase.from("follows").select("follower_id").eq("follower_id", viewerId).eq("following_id", ownerId).maybeSingle(),
    supabase.from("matches").select("id")
      .or("and(user_one_id.eq." + viewerId + ",user_two_id.eq." + ownerId + "),and(user_one_id.eq." + ownerId + ",user_two_id.eq." + viewerId + ")")
      .maybeSingle(),
  ])

  // "my followers" level means: viewer is one of owner's followers
  // (owner's followers = rows where following_id = owner, follower_id = viewer)
  const ctx = {
    matched: !!matchRes.data,
    isFollowerOfOwner: !!followRes.data,
  }

  __ctxCache.set(key, ctx)
  return ctx
}

export async function canSeeField({ viewerId, ownerId, settings, field }) {
  if (!ownerId) return false
  if (viewerId === ownerId) return true

  const levelMap = {
    phone: 'phone_visibility',
    email: 'email_visibility',
    birthday: 'birthday_visibility',
    relationship: 'relationship_visibility',
    contact_info: 'contact_info_visibility',
    followers_list: 'followers_list_visibility',
    matches_list: 'matches_list_visibility',
    communities_membership: 'communities_membership_visibility',
  }
  const key = levelMap[field]
  if (!key) return true
  const level = (settings && settings[key]) || 'everyone'

  if (level === 'everyone') return true
  if (level === 'only_me') return false

  const ctx = await loadContext(viewerId, ownerId)
  if (level === 'matches') return ctx.matched
  if (level === 'followers') return ctx.isFollowerOfOwner
  return false
}

export function invalidateVisibilityCache() {
  __ctxCache = new Map()
}

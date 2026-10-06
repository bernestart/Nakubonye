import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const DEFAULTS = {
  who_can_message: 'everyone',
  who_can_request: 'everyone',
  who_can_comment: 'everyone',
  who_can_story_reply: 'everyone',
  who_can_tag: 'everyone',
  allow_story_replies: true,
  allow_sharing_to_story: true,
  profile_visibility: 'public',
  discoverable_phone: true,
  discoverable_email: true,
  discoverable_search_engines: false,
  discoverable_suggestions: true,
  who_can_see_online: 'everyone',
  who_can_see_location: 'matches',
  show_activity_status: true,
  show_read_receipts: true,
  show_typing_indicator: true,
  show_location_on_profile: true,
  phone_visibility: 'only_me',
  email_visibility: 'only_me',
  birthday_visibility: 'everyone',
  relationship_visibility: 'everyone',
  contact_info_visibility: 'only_me',
  followers_list_visibility: 'everyone',
  matches_list_visibility: 'everyone',
  communities_membership_visibility: 'everyone',
  notif_likes: true,
  notif_comments: true,
  notif_matches: true,
  notif_messages: true,
  notif_story_replies: true,
  notif_reel_activity: true,
  notif_commerce: true,
}

const Ctx = createContext({ settings: DEFAULTS, update: () => {}, loading: true })

export function SettingsProvider({ children }) {
  const { session } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!session?.user?.id) { setSettings(DEFAULTS); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) {
      setSettings({ ...DEFAULTS, ...data })
    } else {
      // Row missing — insert defaults
      await supabase.from('user_settings').insert({ user_id: session.user.id })
      setSettings(DEFAULTS)
    }
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  const update = useCallback(async (patch) => {
    if (!session?.user?.id) return
    // Optimistic — flip immediately
    setSettings((s) => ({ ...s, ...patch }))
    // Write to DB
    await supabase
      .from('user_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
  }, [session?.user?.id])

  return (
    <Ctx.Provider value={{ settings, update, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSettings() {
  return useContext(Ctx)
}

// Reusable audience levels
export const VISIBILITY_LEVELS = [
  { id: 'everyone',  label: 'Everyone',      sub: 'Anyone on Nakubonye' },
  { id: 'followers', label: 'My followers',  sub: 'People who follow you' },
  { id: 'matches',   label: 'Matches',       sub: 'People you matched with' },
  { id: 'only_me',   label: 'Only me',       sub: 'Just for you' },
]

export const AUDIENCE_LEVELS = [
  { id: 'everyone',  label: 'Everyone',           sub: 'Anyone on Nakubonye' },
  { id: 'matches',   label: 'Matches',            sub: 'People you have matched with' },
  { id: 'following', label: 'People I follow',    sub: 'Accounts you follow' },
  { id: 'nobody',    label: 'Nobody',             sub: 'No one can do this' },
]

export const PROFILE_VISIBILITY_LEVELS = [
  { id: 'public',  label: 'Public',      sub: 'Anyone can see your profile' },
  { id: 'matches', label: 'Matches only',sub: 'Only people you matched with' },
]

export const LOCATION_LEVELS = [
  { id: 'everyone', label: 'Everyone',  sub: 'Show your location to all' },
  { id: 'matches',  label: 'Matches',   sub: 'Only matched people see it' },
  { id: 'nobody',   label: 'Nobody',    sub: 'Hide your location entirely' },
]

export const REQUEST_LEVELS = [
  { id: 'everyone',  label: 'Everyone',        sub: 'Anyone can send requests' },
  { id: 'following', label: 'People I follow', sub: 'Only accounts you follow' },
  { id: 'nobody',    label: 'Nobody',          sub: 'No one can send you requests' },
]

export const TAG_LEVELS = [
  { id: 'everyone',  label: 'Everyone',        sub: 'Anyone can tag you' },
  { id: 'following', label: 'People I follow', sub: 'Only accounts you follow' },
  { id: 'nobody',    label: 'Nobody',          sub: 'No one can tag you' },
]

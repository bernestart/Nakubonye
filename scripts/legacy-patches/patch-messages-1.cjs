const fs = require('fs')
const p = 'src/screens/Messages.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Import isOnline
const IMP = `import { publicPhotoUrl } from '../lib/photo'`
if (!s.includes(IMP)) throw new Error('photo import anchor missing')
if (!s.includes('isOnline'))
  s = s.replace(IMP, IMP + `\nimport { isOnline } from '../lib/usePresence'`)

// 2. Add pull-to-refresh + realtime states
const ST = `  const [error, setError] = useState('')`
if (!s.includes(ST)) throw new Error('error state anchor missing')
if (!s.includes('pullDistance'))
  s = s.replace(ST, ST + `
  const [pullDistance, setPullDistance] = useState(0)
  const pullingRef = useRef(false)
  const pullStartY = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef(null)`)

// Add useRef import
const REACT_IMP = `import { useCallback, useEffect, useState } from 'react'`
if (!s.includes('useRef'))
  s = s.replace(REACT_IMP, `import { useCallback, useEffect, useRef, useState } from 'react'`)

// 3. Fetch last_seen_at in the profiles query
const PROF_MATCH_OLD = `      .select('id, display_name, username, is_verified')
      .in('id', otherIds)`
if (!s.includes(PROF_MATCH_OLD)) throw new Error('profiles query anchor missing')
s = s.replace(PROF_MATCH_OLD, `      .select('id, display_name, username, is_verified, last_seen_at')
      .in('id', otherIds)`)

const PROF_DIRECT_OLD = `          .from('profiles').select('id, display_name, username, is_verified').in('id', freshIds)`
if (!s.includes(PROF_DIRECT_OLD)) throw new Error('direct profiles query anchor missing')
s = s.replace(PROF_DIRECT_OLD, `          .from('profiles').select('id, display_name, username, is_verified, last_seen_at').in('id', freshIds)`)

// 4. Attach last_seen_at + fix c.id bug
const ITEM_MATCH_OLD = `        photo_url: publicPhotoUrl(pmap.get(otherId)),
        preview: conv?.last_message_preview || null,`
if (!s.includes(ITEM_MATCH_OLD)) throw new Error('match item anchor missing')
s = s.replace(ITEM_MATCH_OLD, `        photo_url: publicPhotoUrl(pmap.get(otherId)),
        last_seen_at: p.last_seen_at || null,
        preview: conv?.last_message_preview || null,`)

const ITEM_DIRECT_OLD = `          photo_url: publicPhotoUrl(dcPhotoMap.get(other)),
          preview: c.last_message_preview || null,
          lastMessageAt: c.last_message_at || c.id,`
if (!s.includes(ITEM_DIRECT_OLD)) throw new Error('direct item anchor missing')
s = s.replace(ITEM_DIRECT_OLD, `          photo_url: publicPhotoUrl(dcPhotoMap.get(other)),
          last_seen_at: p.last_seen_at || null,
          preview: c.last_message_preview || null,
          lastMessageAt: c.last_message_at || c.created_at,`)

// 5. Realtime — subscribe to messages table on mount
const LOAD_EFF = `  useEffect(() => { load() }, [load])`
if (!s.includes(LOAD_EFF)) throw new Error('load effect anchor missing')
s = s.replace(LOAD_EFF, `${LOAD_EFF}

  // Realtime — reload list when new messages arrive in any of my conversations
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    let debounce = null
    const schedule = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => load(), 400)
    }
    const ch = supabase
      .channel('messages-list-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, schedule)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, schedule)
      .subscribe()
    return () => {
      if (debounce) clearTimeout(debounce)
      supabase.removeChannel(ch)
    }
  }, [session?.user?.id, load])

  // Pull-to-refresh
  function onTouchStart(e) {
    const el = scrollRef.current
    if (!el || el.scrollTop > 0 || refreshing) return
    pullStartY.current = e.touches[0].clientY
    pullingRef.current = true
  }
  function onTouchMove(e) {
    if (!pullingRef.current) return
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy > 0) setPullDistance(Math.min(dy * 0.5, 100))
  }
  async function onTouchEnd() {
    if (!pullingRef.current) return
    pullingRef.current = false
    const d = pullDistance
    setPullDistance(0)
    if (d < 60) return
    setRefreshing(true)
    try { await load() } catch {}
    setRefreshing(false)
  }`)

// 6. Wire scroll container with pull handlers
const SCROLL_OLD = `      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">`
if (!s.includes(SCROLL_OLD)) throw new Error('scroll container anchor missing')
s = s.replace(SCROLL_OLD, `      {pullDistance > 0 && (
        <div className="grid place-items-center py-2 text-purple-300 text-[11.5px] font-semibold" style={{ opacity: Math.min(1, pullDistance / 60) }}>
          {pullDistance >= 60 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 pb-4"
           onTouchStart={onTouchStart}
           onTouchMove={onTouchMove}
           onTouchEnd={onTouchEnd}>`)

// 7. Add online dot + media preview fallback in the render
const AVATAR_OPEN = `                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/8">`
if (!s.includes(AVATAR_OPEN)) throw new Error('avatar anchor missing')
s = s.replace(AVATAR_OPEN, `                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/8">`)

// Insert online dot after the avatar div closes — find the closing tag sequence
const AVATAR_CLOSE = `                  </div>
                </div>

                <div className="flex-1 min-w-0">`
if (!s.includes(AVATAR_CLOSE)) throw new Error('avatar close anchor missing')
s = s.replace(AVATAR_CLOSE, `                  </div>
                  {item.last_seen_at && isOnline(item.last_seen_at, 3) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0B14]" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.9)" }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">`)

// Fix preview fallback
const PREVIEW_OLD = `                      {item.preview || 'Say hello 👋'}`
if (!s.includes(PREVIEW_OLD)) throw new Error('preview anchor missing')
s = s.replace(PREVIEW_OLD, `                      {item.preview
                        ? item.preview
                        : (item.lastMessageAt && item.conversationId
                            ? '📎 Attachment'
                            : 'Say hello 👋')}`)

fs.writeFileSync(p, s)
console.log('OK messages patched')

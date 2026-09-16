import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Lock, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'

export default function CommunityChat({ communityId, isMember, isPremium }) {
  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef(null)
  const myId = session?.user?.id

  const load = useCallback(async () => {
    if (!myId || !communityId) return
    setLoading(true); setError('')

    const { data: rows, error: err } = await supabase
      .from('community_messages')
      .select('id, sender_id, content, created_at, highlighted_until')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (err) { setError(err.message); setLoading(false); return }

    const list = rows || []
    setMessages(list)

    const ids = [...new Set(list.map((r) => r.sender_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username, is_verified')
        .in('id', ids)
      const pMap = new Map()
      ;(profs || []).forEach((p) => pMap.set(p.id, p))
      setProfiles(pMap)

      const { data: photoRows } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', ids)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      const phMap = new Map()
      ;(photoRows || []).forEach((p) => {
        if (!phMap.has(p.user_id)) phMap.set(p.user_id, p.storage_path)
      })
      setPhotos(phMap)
    }

    setLoading(false)
  }, [myId, communityId])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!communityId) return
    const ch = supabase
      .channel('community-chat-' + communityId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages',
          filter: 'community_id=eq.' + communityId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [communityId])

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function send() {
    const body = text.trim()
    if (!body || sending || !myId) return
    setSending(true); tap('light')

    setText('')
    const { error: err } = await supabase
      .from('community_messages')
      .insert({
        community_id: communityId,
        sender_id: myId,
        content: body,
      })

    if (err) {
      setError(err.message)
      setText(body)
    }
    setSending(false)
  }

  async function highlightMessage(messageId) {
    if (!confirm('Highlight this message for 24 hours? Costs 25 coins.')) return
    tap('medium')
    setError('')
    const { data, error: err } = await supabase.rpc('highlight_community_message', { p_message_id: messageId })
    if (err) {
      if (/insufficient/i.test(err.message)) setError('Not enough coins. Get more in Wallet.')
      else if (/already highlighted/i.test(err.message)) setError('This message is already highlighted.')
      else if (/sender/i.test(err.message)) setError('Only you can highlight your own messages.')
      else setError(err.message)
      return
    }
    load()
  }

  if (!isMember) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
          <Send size={22} strokeWidth={1.8} className="text-muted" />
        </div>
        <p className="text-cream font-semibold text-[14.5px] mb-1">Join to chat</p>
        <p className="text-muted text-[12.5px]">Only members can send messages here.</p>
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="text-center py-8">
        <div className="rounded-3xl overflow-hidden border border-purple-500/30 mb-5"
          style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.25) 0%, rgba(236,72,153,0.15) 100%)' }}
        >
          <div className="absolute inset-0 opacity-40" />
          <div className="relative p-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center mx-auto mb-4 shadow-[0_10px_30px_rgba(124,58,237,0.55)]">
              <Lock size={24} strokeWidth={2.4} className="text-white" />
            </div>
            <h2 className="text-cream text-[20px] font-extrabold tracking-tight mb-2">
              Community chat is Premium
            </h2>
            <p className="text-muted text-[13.5px] leading-relaxed mb-5 px-3">
              Talk live with everyone in this community. Premium unlocks the chat in every community you join.
            </p>
            <button
              onClick={() => { tap('light'); nav('/premium') }}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-bold text-[14px] shadow-[0_10px_28px_rgba(124,58,237,0.5)]"
            >
              <Lock size={16} strokeWidth={2.4} />
              Unlock with Premium
            </button>
          </div>
        </div>
        <p className="text-subtle text-[11.5px] leading-relaxed">
          You can still read and post in the Feed for free.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '400px' }}>
      {error && (
        <div className="text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-3">
          {error}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3"
        style={{ maxHeight: '420px', minHeight: '260px' }}
      >
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-cream font-semibold text-[14.5px] mb-1">No messages yet</p>
            <p className="text-muted text-[12.5px]">Say hello to the community.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myId
            const p = profiles.get(m.sender_id)
            const photo = photos.get(m.sender_id)
            const name = p?.display_name || p?.username || 'Someone'
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
                {!mine && (
                  <button
                    onClick={() => { tap('light'); nav('/profile/' + m.sender_id) }}
                    className="shrink-0"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-elevated border border-white/8">
                      {photo ? (
                        <img src={publicPhotoUrl(photo)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] font-black text-purple-400">
                          {name[0]}
                        </div>
                      )}
                    </div>
                  </button>
                )}

                <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mine && (
                    <p className="text-[10.5px] text-subtle font-medium mb-0.5 px-1">
                      {name}
                    </p>
                  )}
                  <div
                    className={`px-3.5 py-2 text-[14px] leading-[1.4] break-words rounded-2xl ${
                      mine
                        ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-br-md shadow-[0_4px_14px_rgba(124,58,237,0.35)]'
                        : 'bg-elevated text-cream border border-white/8 rounded-bl-md'
                    }${
                      m.highlighted_until && new Date(m.highlighted_until) > new Date()
                        ? ' ring-2 ring-amber-400/70 shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                        : ''
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className="flex items-center gap-1 px-1 mt-0.5">
                    <p className="text-[10px] text-subtle">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {mine && !(m.highlighted_until && new Date(m.highlighted_until) > new Date()) && (
                      <button
                        onClick={() => highlightMessage(m.id)}
                        className="text-amber-400 hover:text-amber-300"
                        aria-label="Highlight message"
                        title="Highlight for 25 coins"
                      >
                        <Sparkles size={11} strokeWidth={2.3} />
                      </button>
                    )}
                    {m.highlighted_until && new Date(m.highlighted_until) > new Date() && (
                      <Sparkles size={11} strokeWidth={2.4} className="text-amber-400" />
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 pt-2 border-t border-white/8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder="Write a message…"
          className="flex-1 bg-elevated border border-white/8 rounded-[22px] px-4 py-2.5 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none max-h-28"
          style={{ minHeight: 44 }}
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white disabled:opacity-40 shrink-0"
          aria-label="Send"
        >
          <Send size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Sparkles, MessageCircle, Zap, RefreshCw, Coins } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'

export default function Notifications() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const uid = session.user.id

    const events = []

    // 1. Likes received
    const { data: likesRows, error: likesErr } = await supabase
      .rpc('get_likes_received', { p_limit: 30 })

    if (!likesErr && likesRows) {
      likesRows.forEach((r) => {
        events.push({
          key: 'like-' + r.id,
          type: 'like',
          user_id: r.id,
          display_name: r.display_name,
          username: r.username,
          photo_url: publicPhotoUrl(r.primary_photo),
          created_at: r.liked_at,
          route: '/profile/' + r.id,
        })
      })
    }

    // 2. Matches
    const { data: matchRows } = await supabase
      .from('matches')
      .select('id, user_one_id, user_two_id, created_at')
      .or(`user_one_id.eq.${uid},user_two_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(30)

    const matchOtherIds = []
    ;(matchRows || []).forEach((m) => {
      const other = m.user_one_id === uid ? m.user_two_id : m.user_one_id
      matchOtherIds.push(other)
    })

    let matchProfiles = new Map()
    let matchPhotos = new Map()
    if (matchOtherIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', matchOtherIds)
      ;(profs || []).forEach((p) => matchProfiles.set(p.id, p))

      const { data: photos } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', matchOtherIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      ;(photos || []).forEach((p) => {
        if (!matchPhotos.has(p.user_id)) matchPhotos.set(p.user_id, p.storage_path)
      })
    }

    ;(matchRows || []).forEach((m) => {
      const other = m.user_one_id === uid ? m.user_two_id : m.user_one_id
      const p = matchProfiles.get(other)
      events.push({
        key: 'match-' + m.id,
        type: 'match',
        user_id: other,
        display_name: p?.display_name,
        username: p?.username,
        photo_url: publicPhotoUrl(matchPhotos.get(other)),
        created_at: m.created_at,
        route: '/messages/' + other,
      })
    })

    // 3. Paid direct message openers received (someone paid coins to DM me)
    const { data: myProfSeen } = await supabase
      .from('profiles')
      .select('notifications_seen_at')
      .eq('id', uid)
      .maybeSingle()
    const seenAt = myProfSeen?.notifications_seen_at
      ? new Date(myProfSeen.notifications_seen_at)
      : new Date(0)

    const { data: dmRows } = await supabase
      .from('conversations')
      .select('id, initiator_id, recipient_id, created_at')
      .eq('is_direct', true)
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(30)

    const newDMs = (dmRows || []).filter((c) => new Date(c.created_at) > seenAt)

    if (newDMs.length) {
      const senderIds = newDMs.map((c) => c.initiator_id)
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', senderIds)
      const uProfiles = new Map((profs || []).map((p) => [p.id, p]))

      const { data: photos } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', senderIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      const uPhotos = new Map()
      ;(photos || []).forEach((ph) => {
        if (!uPhotos.has(ph.user_id)) uPhotos.set(ph.user_id, ph.storage_path)
      })

      newDMs.forEach((c) => {
        const sender = c.initiator_id
        const prof = uProfiles.get(sender)
        events.push({
          key: 'dm-' + c.id,
          type: 'dm',
          user_id: sender,
          display_name: prof?.display_name,
          username: prof?.username,
          photo_url: publicPhotoUrl(uPhotos.get(sender)),
          created_at: c.created_at,
          route: '/messages/' + sender,
        })
      })
    }

    // 4. Super requests received
    const { data: superRows } = await supabase
      .from('super_requests')
      .select('id, sender_id, message, status, created_at')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)

    if (superRows?.length) {
      const senderIds = superRows.map((r) => r.sender_id)
      const { data: profs } = await supabase
        .from('profiles').select('id, display_name, username').in('id', senderIds)
      const pMap = new Map((profs || []).map((p) => [p.id, p]))
      const { data: photos } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', senderIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      const photoMap = new Map()
      ;(photos || []).forEach((p) => {
        if (!photoMap.has(p.user_id)) photoMap.set(p.user_id, p.storage_path)
      })

      superRows.forEach((r) => {
        // Only show pending ones — answered requests go away
        if (r.status !== 'pending') return
        const p = pMap.get(r.sender_id)
        events.push({
          key: 'super-' + r.id,
          id: r.id,
          status: r.status,
          type: 'super',
          user_id: r.sender_id,
          display_name: p?.display_name,
          username: p?.username,
          photo_url: publicPhotoUrl(photoMap.get(r.sender_id)),
          preview: r.message,
          created_at: r.created_at,
          route: '/profile/' + r.sender_id,
        })
      })
    }

    // 5. Coins earned (positive transactions, past 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: coinRows } = await supabase
      .from('coin_transactions')
      .select('id, amount, description, transaction_type, created_at')
      .eq('user_id', uid)
      .gt('amount', 0)
      .gt('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    ;(coinRows || []).forEach((t) => {
      events.push({
        key: 'coin-' + t.id,
        type: 'coins',
        amount: t.amount,
        description: t.description || 'Coins earned',
        transaction_type: t.transaction_type,
        created_at: t.created_at,
      })
    })

    // Sort all by date descending, keep top 60
    events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setItems(events.slice(0, 60))
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  async function respondToRequest(requestId, accept) {
    const { data, error: err } = await supabase.rpc('respond_to_super_request', {
      p_request_id: requestId,
      p_accept: accept,
    })
    if (err) { setError(err.message); return }

    // Remove the card from the list immediately
    setItems((cur) => cur.filter((x) => !(x.type === 'super' && x.id === requestId)))

    if (accept && data?.match_id) {
      // Find the sender's user id and navigate to chat
      const item = items.find((x) => x.type === 'super' && x.id === requestId)
      if (item?.user_id) nav('/messages/' + item.user_id)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Notifications</span>
        <div className="flex-1" />
        <button
          onClick={load}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Refresh"
        >
          <RefreshCw size={17} strokeWidth={2.3} />
        </button>
      </header>

      {error && (
        <div className="mx-3 mt-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {loading ? (
          <div className="flex flex-col gap-2 pt-3">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty />
        ) : (
          <div className="pt-3">
            {/* Super Requests pending — big cards at top */}
            {items.some((x) => x.type === 'super') && (
              <>
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-2 mb-2">
                  Super requests
                </p>
                <div className="flex flex-col gap-2.5 mb-5">
                  {items.filter((x) => x.type === 'super').map((it) => (
                    <SuperRequestCard
                      key={it.key}
                      item={it}
                      onAccept={() => respondToRequest(it.id, true)}
                      onDecline={() => respondToRequest(it.id, false)}
                      onOpen={() => nav(it.route)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Everything else grouped by time */}
            {(() => {
              const nonSuper = items.filter((x) => x.type !== 'super')
              if (!nonSuper.length) return null
              const groups = { today: [], week: [], earlier: [] }
              const now = new Date()
              const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const weekAgo = new Date(now.getTime() - 7 * 86400000)
              nonSuper.forEach((it) => {
                const d = new Date(it.created_at)
                if (d >= startOfToday) groups.today.push(it)
                else if (d >= weekAgo) groups.week.push(it)
                else groups.earlier.push(it)
              })

              return (
                <>
                  {groups.today.length > 0 && (
                    <>
                      <GroupLabel>Today</GroupLabel>
                      <div className="flex flex-col gap-1 mb-4">
                        {groups.today.map((it) => (
                          <Row key={it.key} item={it} onOpen={() => nav(it.route)} />
                        ))}
                      </div>
                    </>
                  )}
                  {groups.week.length > 0 && (
                    <>
                      <GroupLabel>This week</GroupLabel>
                      <div className="flex flex-col gap-1 mb-4">
                        {groups.week.map((it) => (
                          <Row key={it.key} item={it} onOpen={() => nav(it.route)} />
                        ))}
                      </div>
                    </>
                  )}
                  {groups.earlier.length > 0 && (
                    <>
                      <GroupLabel>Earlier</GroupLabel>
                      <div className="flex flex-col gap-1">
                        {groups.earlier.map((it) => (
                          <Row key={it.key} item={it} onOpen={() => nav(it.route)} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ item, onOpen }) {
  // Special card for coins earned — gold, distinct from regular notifications
  if (item.type === 'coins') {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-3 p-3 rounded-2xl text-left transition-colors"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(236,72,153,0.12) 100%)',
          border: '1px solid rgba(245,158,11,0.45)',
          boxShadow: '0 4px 18px rgba(245,158,11,0.18)',
        }}
      >
        <div className="shrink-0 w-12 h-12 rounded-full grid place-items-center"
             style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)', boxShadow: '0 6px 18px rgba(245,158,11,0.5)' }}>
          <Coins size={22} strokeWidth={2.4} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-200 text-[14px] font-bold truncate">
            {item.description}
          </p>
          <p className="text-amber-300/70 text-[12.5px] truncate">Coins reward</p>
        </div>
        <span className="text-amber-300 text-[15px] font-black shrink-0">
          +{item.amount}
        </span>
      </button>
    )
  }

  const meta = TYPE_META[item.type]
  const Icon = meta.Icon
  const isPremium = item.type === 'dm' || item.type === 'super'
  const premiumStyle = isPremium
    ? {
        background:
          item.type === 'super'
            ? 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(236,72,153,0.08) 100%)'
            : 'linear-gradient(135deg, rgba(168,85,247,0.14) 0%, rgba(236,72,153,0.08) 100%)',
        border:
          item.type === 'super'
            ? '1px solid rgba(245,158,11,0.5)'
            : '1px solid rgba(168,85,247,0.5)',
        boxShadow:
          item.type === 'super'
            ? '0 4px 18px rgba(245,158,11,0.18)'
            : '0 4px 18px rgba(168,85,247,0.2)',
      }
    : {}
  const premiumLabel =
    item.type === 'super' ? 'SUPER REQUEST' : 'PAID DM'
  const premiumLabelColor =
    item.type === 'super' ? '#F59E0B' : '#A855F7'

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3 p-3 rounded-2xl text-left transition-colors"
      style={isPremium ? premiumStyle : undefined}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-elevated border border-white/8">
          {item.photo_url ? (
            <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-base font-black text-purple-400">
              {(item.display_name || '?')[0]}
            </div>
          )}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full grid place-items-center border-2"
          style={{ background: meta.bg, borderColor: '#0B0B14' }}
        >
          <Icon size={10} strokeWidth={2.6} className="text-white" fill="currentColor" />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-cream text-[14px] font-semibold truncate">
          {item.display_name || item.username || 'Someone'}
        </p>
        {isPremium && (
          <span
            className="inline-block text-[9.5px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded mb-0.5"
            style={{ background: premiumLabelColor, color: '#0B0B14' }}
          >
            {premiumLabel}
          </span>
        )}
        <p className="text-muted text-[12.5px] truncate">
          {meta.label}
          {item.preview ? ` · ${item.preview}` : ''}
        </p>
      </div>

      <span className="text-subtle text-[10.5px] font-medium shrink-0">
        {relTime(item.created_at)}
      </span>
    </button>
  )
}

const TYPE_META = {
  like:    { Icon: Heart,          label: 'Liked you',          bg: '#EC4899' },
  match:   { Icon: Sparkles,       label: 'It’s a match',       bg: '#7C3AED' },
  message: { Icon: MessageCircle,  label: 'New message',        bg: '#8B5CF6' },
  super:   { Icon: Zap,            label: 'Sent a Super request', bg: '#F59E0B' },
  coins:   { Icon: Coins,          label: 'Coins earned',        bg: '#F59E0B' },
  dm:      { Icon: MessageCircle,  label: 'Sent you a DM',      bg: '#A855F7' },
}

function relTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  if (diff < 604800) return Math.floor(diff / 86400) + 'd'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Empty() {
  return (
    <div className="pt-16 text-center px-6">
      <div className="w-14 h-14 rounded-3xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
        <Sparkles size={22} strokeWidth={1.8} className="text-muted" />
      </div>
      <p className="text-cream font-semibold text-[15px] mb-1">All caught up</p>
      <p className="text-muted text-[13px]">Likes, matches, and messages will appear here.</p>
    </div>
  )
}


function SuperRequestCard({ item, onAccept, onDecline, onOpen }) {
  return (
    <div className="rounded-2xl p-3.5 border border-purple-500/40 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)' }}
    >
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

      <div className="relative flex items-start gap-3">
        <button onClick={onOpen} className="shrink-0">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border-2 border-purple-500/60">
            {item.photo_url ? (
              <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-lg font-black text-purple-400">
                {(item.display_name || '?')[0]}
              </div>
            )}
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-cream text-[14.5px] font-bold truncate">
              {item.display_name || item.username || 'Someone'}
            </p>
            <span className="shrink-0 w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center">
              <Zap size={9} strokeWidth={2.8} className="text-white" fill="currentColor" />
            </span>
          </div>
          <p className="text-purple-300 text-[11px] font-bold tracking-wide uppercase mb-1">
            Sent a Super request
          </p>
          {item.preview && (
            <p className="text-cream/90 text-[13px] leading-snug line-clamp-2 mb-3">
              “{item.preview}”
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onAccept}
              className="flex-1 h-9 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[13px] shadow-[0_6px_20px_rgba(124,58,237,0.5)]"
            >
              Accept & match
            </button>
            <button
              onClick={onDecline}
              className="h-9 px-4 rounded-full bg-white/[0.06] border border-white/12 text-muted font-semibold text-[13px]"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupLabel({ children }) {
  return (
    <p className="text-subtle text-[10.5px] font-black tracking-[0.16em] uppercase px-2 mb-2">
      {children}
    </p>
  )
}

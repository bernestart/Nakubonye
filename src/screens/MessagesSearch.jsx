import { useEffect, useState, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Search, MessageCircle, Users } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function MessagesSearch() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [searchParams] = useSearchParams()

  const [query, setQuery] = useState(() => searchParams.get("q") || "")
  const [loading, setLoading] = useState(false)
  const [dmResults, setDmResults] = useState([])
  const [groupResults, setGroupResults] = useState([])
  const [commResults, setCommResults] = useState([])
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || !myId) {
      setDmResults([]); setGroupResults([]); setCommResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const [dmRes, groupRes, commRes] = await Promise.all([
          supabase.from("messages")
            .select("id, conversation_id, sender_id, content, created_at")
            .ilike("content", "%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(30),
          supabase.from("group_messages")
            .select("id, group_id, sender_id, content, created_at")
            .ilike("content", "%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(30),
          supabase.from("community_messages")
            .select("id, community_id, sender_id, content, created_at")
            .ilike("content", "%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(30),
        ])
        if (cancelled) return

        // Enrich with sender names
        const allSenderIds = [
          ...new Set([
            ...(dmRes.data || []).map((r) => r.sender_id),
            ...(groupRes.data || []).map((r) => r.sender_id),
            ...(commRes.data || []).map((r) => r.sender_id),
          ])
        ]
        let profMap = new Map()
        if (allSenderIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name, username")
            .in("id", allSenderIds)
          ;(profs || []).forEach((p) => profMap.set(p.id, p))
        }

        // For group + community, fetch names
        const groupIds = [...new Set((groupRes.data || []).map((r) => r.group_id))]
        const commIds = [...new Set((commRes.data || []).map((r) => r.community_id))]
        let groupMap = new Map(), commMap = new Map()
        if (groupIds.length > 0) {
          const { data: groups } = await supabase.from("groups").select("id, name").in("id", groupIds)
          ;(groups || []).forEach((g) => groupMap.set(g.id, g))
        }
        if (commIds.length > 0) {
          const { data: comms } = await supabase.from("communities").select("id, name, slug, emoji").in("id", commIds)
          ;(comms || []).forEach((c) => commMap.set(c.id, c))
        }

        // For DM, fetch conversation partner info
        const dmConvIds = [...new Set((dmRes.data || []).map((r) => r.conversation_id))]
        let convMap = new Map()
        if (dmConvIds.length > 0) {
          const { data: convs } = await supabase
            .from("conversations")
            .select("id, user_one_id, user_two_id")
            .in("id", dmConvIds)
          const otherIds = []
          ;(convs || []).forEach((c) => {
            const otherId = c.user_one_id === myId ? c.user_two_id : c.user_one_id
            convMap.set(c.id, otherId)
            if (otherId) otherIds.push(otherId)
          })
          if (otherIds.length > 0) {
            const { data: profs2 } = await supabase
              .from("profiles")
              .select("id, display_name, username")
              .in("id", otherIds)
            ;(profs2 || []).forEach((p) => profMap.set(p.id, p))
          }
        }

        setDmResults((dmRes.data || []).map((r) => ({
          ...r,
          _sender: profMap.get(r.sender_id),
          _peer: profMap.get(convMap.get(r.conversation_id)),
          _peerId: convMap.get(r.conversation_id),
        })))
        setGroupResults((groupRes.data || []).map((r) => ({
          ...r,
          _sender: profMap.get(r.sender_id),
          _group: groupMap.get(r.group_id),
        })))
        setCommResults((commRes.data || []).map((r) => ({
          ...r,
          _sender: profMap.get(r.sender_id),
          _comm: commMap.get(r.community_id),
        })))
      } catch (e) {
        console.warn("global search failed", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, myId])

  function hl(text, q) {
    if (!q || !text) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-purple-500/30 text-cream rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  const total = dmResults.length + groupResults.length + commResults.length

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <header className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 80))}
            placeholder="Search all messages…"
            className="w-full h-10 rounded-full bg-white/[0.06] border border-white/10 pl-10 pr-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        {query.trim().length < 2 ? (
          <p className="text-muted text-[13px] text-center py-16 px-6">
            Search across every conversation you're part of.
          </p>
        ) : loading ? (
          <p className="text-muted text-[13px] text-center py-6">Searching…</p>
        ) : total === 0 ? (
          <p className="text-muted text-[13px] text-center py-16 px-6">No messages match "{query}".</p>
        ) : (
          <>
            <p className="px-4 pt-3 pb-2 text-muted text-[11.5px] font-medium">
              {total} {total === 1 ? "result" : "results"} across {[dmResults.length > 0, groupResults.length > 0, commResults.length > 0].filter(Boolean).length} conversation{[dmResults.length > 0, groupResults.length > 0, commResults.length > 0].filter(Boolean).length === 1 ? "" : "s"}
            </p>

            {dmResults.length > 0 && (
              <div className="mb-3">
                <p className="px-4 py-2 text-purple-400 text-[11px] font-black tracking-wider uppercase">Direct messages</p>
                {dmResults.map((r) => (
                  <button
                    key={"dm-" + r.id}
                    onClick={() => { tap("light"); nav("/messages/" + r._peerId) }}
                    className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03]"
                  >
                    <MessageCircle size={16} className="text-muted mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-cream text-[12.5px] font-bold truncate">
                          {r.sender_id === myId ? "You" : (r._sender?.display_name || r._sender?.username || "Someone")}
                          {" "}
                          {r._peer && <span className="text-muted font-normal">→ {r._peer.display_name || r._peer.username}</span>}
                        </span>
                        <span className="text-subtle text-[10.5px] shrink-0 ml-auto">
                          {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-cream/85 text-[13px] leading-snug break-words">{hl(r.content, query.trim())}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {groupResults.length > 0 && (
              <div className="mb-3">
                <p className="px-4 py-2 text-purple-400 text-[11px] font-black tracking-wider uppercase">Group chats</p>
                {groupResults.map((r) => (
                  <button
                    key={"g-" + r.id}
                    onClick={() => { tap("light"); nav("/groups/" + r.group_id) }}
                    className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03]"
                  >
                    <Users size={16} className="text-muted mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-cream text-[12.5px] font-bold truncate">
                          {r._group?.name || "Group"}
                          <span className="text-muted font-normal"> · {r.sender_id === myId ? "You" : (r._sender?.display_name || r._sender?.username || "Someone")}</span>
                        </span>
                        <span className="text-subtle text-[10.5px] shrink-0 ml-auto">
                          {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-cream/85 text-[13px] leading-snug break-words">{hl(r.content, query.trim())}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {commResults.length > 0 && (
              <div>
                <p className="px-4 py-2 text-purple-400 text-[11px] font-black tracking-wider uppercase">Community chats</p>
                {commResults.map((r) => (
                  <button
                    key={"c-" + r.id}
                    onClick={() => { tap("light"); nav("/communities/" + (r._comm?.slug || r.community_id)) }}
                    className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03]"
                  >
                    <span className="shrink-0 text-[16px]">{r._comm?.emoji || "🌐"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-cream text-[12.5px] font-bold truncate">
                          {r._comm?.name || "Community"}
                          <span className="text-muted font-normal"> · {r.sender_id === myId ? "You" : (r._sender?.display_name || r._sender?.username || "Someone")}</span>
                        </span>
                        <span className="text-subtle text-[10.5px] shrink-0 ml-auto">
                          {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-cream/85 text-[13px] leading-snug break-words">{hl(r.content, query.trim())}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

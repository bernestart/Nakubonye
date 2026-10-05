import { useEffect, useState, useRef } from "react"
import { X, Search, MessageCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

// source: 'dm' | 'group' | 'community'
// targetId: conversationId | groupId | communityId
export default function ChatSearchSheet({ source, targetId, onClose, onJump }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }

    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        let rows = []

        if (source === "dm") {
          const { data } = await supabase
            .from("messages")
            .select("id, sender_id, content, created_at")
            .eq("conversation_id", targetId)
            .ilike("content", "%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(50)
          rows = (data || []).map((r) => ({ ...r, _source: "dm" }))
        } else if (source === "group") {
          const { data } = await supabase
            .from("group_messages")
            .select("id, sender_id, content, created_at")
            .eq("group_id", targetId)
            .ilike("content", "%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(50)
          rows = (data || []).map((r) => ({ ...r, _source: "group" }))
        } else if (source === "community") {
          const { data } = await supabase
            .from("community_messages")
            .select("id, sender_id, content, created_at")
            .eq("community_id", targetId)
            .ilike("content", "%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(50)
          rows = (data || []).map((r) => ({ ...r, _source: "community" }))
        }

        if (cancelled) return

        // Enrich with sender names
        const ids = [...new Set(rows.map((r) => r.sender_id))]
        let profMap = new Map()
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name, username")
            .in("id", ids)
          ;(profs || []).forEach((p) => profMap.set(p.id, p))
        }

        setResults(rows.map((r) => ({
          ...r,
          _sender: profMap.get(r.sender_id),
        })))
      } catch (e) {
        console.warn("chat search failed", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, source, targetId])

  // Highlight matches
  function renderHighlighted(text, q) {
    if (!q) return text
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

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-[#0B0B14]" onClick={(e) => e.stopPropagation()}>
      <div className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <X size={20} />
        </button>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 80))}
            placeholder="Search this conversation…"
            className="w-full h-10 rounded-full bg-white/[0.06] border border-white/10 pl-10 pr-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 ? (
          <p className="text-muted text-[13px] text-center py-16 px-6">
            Type at least 2 characters to search messages.
          </p>
        ) : loading ? (
          <p className="text-muted text-[13px] text-center py-6">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-muted text-[13px] text-center py-16 px-6">No messages match "{query}".</p>
        ) : (
          <div className="flex flex-col">
            <p className="px-4 py-2 text-muted text-[11.5px] font-medium">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            {results.map((r) => (
              <button
                key={r._source + "-" + r.id}
                onClick={() => { tap("light"); onJump?.(r) }}
                className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03]"
              >
                <MessageCircle size={16} className="text-muted mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-cream text-[12.5px] font-bold truncate">
                      {r.sender_id === myId ? "You" : (r._sender?.display_name || r._sender?.username || "Someone")}
                    </span>
                    <span className="text-subtle text-[10.5px] shrink-0">
                      {new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-cream/85 text-[13.5px] leading-snug break-words">
                    {renderHighlighted(r.content || "", query.trim())}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

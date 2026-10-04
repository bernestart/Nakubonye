import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

export default function Poll({ postId, postType = "personal" }) {
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [counts, setCounts] = useState(new Map()) // optionId → count
  const [myVotes, setMyVotes] = useState(new Set()) // optionIds I voted
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!postId) return
    setLoading(true)
    const { data: p } = await supabase
      .from("polls")
      .select("id, question, multiple_choice, closes_at")
      .eq("post_id", postId)
      .eq("post_type", postType)
      .maybeSingle()

    if (!p) { setPoll(null); setLoading(false); return }
    setPoll(p)

    const [optsRes, votesRes] = await Promise.all([
      supabase.from("poll_options").select("id, label, display_order").eq("poll_id", p.id).order("display_order", { ascending: true }),
      supabase.from("poll_votes").select("option_id, user_id").eq("poll_id", p.id),
    ])

    const opts = optsRes.data || []
    setOptions(opts)

    const cMap = new Map()
    const mySet = new Set()
    ;(votesRes.data || []).forEach((v) => {
      cMap.set(v.option_id, (cMap.get(v.option_id) || 0) + 1)
      if (v.user_id === myId) mySet.add(v.option_id)
    })
    setCounts(cMap)
    setMyVotes(mySet)
    setLoading(false)
  }

  useEffect(() => { load() }, [postId, postType, myId])

  async function vote(optionId) {
    if (!poll || !myId || busy) return
    tap("light")
    setBusy(true)

    const already = myVotes.has(optionId)
    const nextVotes = new Set(myVotes)
    const nextCounts = new Map(counts)

    if (already) {
      nextVotes.delete(optionId)
      nextCounts.set(optionId, Math.max(0, (nextCounts.get(optionId) || 1) - 1))
      setMyVotes(nextVotes); setCounts(nextCounts)
      await supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("option_id", optionId).eq("user_id", myId)
    } else {
      // Single choice — remove any other vote first
      if (!poll.multiple_choice && myVotes.size > 0) {
        for (const oid of myVotes) {
          nextCounts.set(oid, Math.max(0, (nextCounts.get(oid) || 1) - 1))
          await supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("option_id", oid).eq("user_id", myId)
        }
        nextVotes.clear()
      }
      nextVotes.add(optionId)
      nextCounts.set(optionId, (nextCounts.get(optionId) || 0) + 1)
      setMyVotes(nextVotes); setCounts(nextCounts)
      await supabase.from("poll_votes").insert({ poll_id: poll.id, option_id: optionId, user_id: myId })
    }
    setBusy(false)
  }

  if (loading || !poll || options.length === 0) return null

  const totalVotes = [...counts.values()].reduce((s, n) => s + n, 0)
  const hasVoted = myVotes.size > 0
  const isClosed = poll.closes_at && new Date(poll.closes_at) < new Date()

  return (
    <div className="px-3 pb-3">
      {poll.question && (
        <p className="text-cream font-bold text-[14px] mb-3 leading-snug">{poll.question}</p>
      )}
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const votes = counts.get(o.id) || 0
          const pct = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100)
          const isMine = myVotes.has(o.id)
          return (
            <button
              key={o.id}
              onClick={() => !isClosed && vote(o.id)}
              disabled={isClosed || busy}
              className="relative w-full h-11 rounded-xl border overflow-hidden text-left transition-all disabled:opacity-70"
              style={{
                borderColor: isMine ? "rgba(236,72,153,0.6)" : "rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {/* Filled bar */}
              <span
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: (hasVoted || isClosed) ? pct + "%" : "0%",
                  background: isMine
                    ? "linear-gradient(90deg, rgba(236,72,153,0.30) 0%, rgba(168,85,247,0.30) 100%)"
                    : "rgba(255,255,255,0.08)",
                }}
              />
              <div className="relative px-3.5 h-full flex items-center justify-between gap-2">
                <span className="text-cream text-[13.5px] font-semibold truncate flex items-center gap-2">
                  {isMine && <Check size={14} strokeWidth={3} className="text-pink-400 shrink-0" />}
                  {o.label}
                </span>
                {(hasVoted || isClosed) && (
                  <span className="text-muted text-[12px] font-bold shrink-0">{pct}%</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-[11.5px] text-muted">
        <span>
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          {poll.multiple_choice && " · Multiple choice"}
        </span>
        {hasVoted && <span>Tap to {poll.multiple_choice ? "toggle" : "change"}</span>}
        {isClosed && <span className="text-red-300 font-bold">Closed</span>}
      </div>
    </div>
  )
}

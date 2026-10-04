import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

// metadata.poll = { question, options: [{ key, label }], multiple_choice }
export default function PollMessage({ messageSource, messageId, poll, isMine }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [counts, setCounts] = useState(new Map())
  const [myVotes, setMyVotes] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!poll || !messageId || !messageSource) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from("chat_poll_votes")
        .select("option_key, user_id")
        .eq("message_source", messageSource)
        .eq("message_id", messageId)
      if (cancelled) return
      const cMap = new Map()
      const mySet = new Set()
      ;(rows || []).forEach((r) => {
        cMap.set(r.option_key, (cMap.get(r.option_key) || 0) + 1)
        if (r.user_id === myId) mySet.add(r.option_key)
      })
      setCounts(cMap)
      setMyVotes(mySet)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [messageSource, messageId, poll, myId])

  async function vote(optionKey) {
    if (!poll || !myId || busy) return
    tap("light")
    setBusy(true)
    const already = myVotes.has(optionKey)
    const nextVotes = new Set(myVotes)
    const nextCounts = new Map(counts)

    if (already) {
      nextVotes.delete(optionKey)
      nextCounts.set(optionKey, Math.max(0, (nextCounts.get(optionKey) || 1) - 1))
      setMyVotes(nextVotes); setCounts(nextCounts)
      await supabase.from("chat_poll_votes").delete()
        .eq("message_source", messageSource).eq("message_id", messageId)
        .eq("option_key", optionKey).eq("user_id", myId)
    } else {
      if (!poll.multiple_choice && myVotes.size > 0) {
        for (const k of myVotes) {
          nextCounts.set(k, Math.max(0, (nextCounts.get(k) || 1) - 1))
          await supabase.from("chat_poll_votes").delete()
            .eq("message_source", messageSource).eq("message_id", messageId)
            .eq("option_key", k).eq("user_id", myId)
        }
        nextVotes.clear()
      }
      nextVotes.add(optionKey)
      nextCounts.set(optionKey, (nextCounts.get(optionKey) || 0) + 1)
      setMyVotes(nextVotes); setCounts(nextCounts)
      await supabase.from("chat_poll_votes").insert({
        message_source: messageSource,
        message_id: messageId,
        option_key: optionKey,
        user_id: myId,
      })
    }
    setBusy(false)
  }

  if (!poll || !poll.options || poll.options.length === 0) return null

  const totalVotes = [...counts.values()].reduce((s, n) => s + n, 0)
  const hasVoted = myVotes.size > 0

  return (
    <div className={`w-[260px] p-3 rounded-2xl border ${isMine ? "bg-purple-500/12 border-purple-500/30" : "bg-white/[0.04] border-white/10"}`}>
      {poll.question && (
        <p className="text-cream font-bold text-[13.5px] leading-snug mb-2.5">{poll.question}</p>
      )}
      <div className="flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const votes = counts.get(o.key) || 0
          const pct = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100)
          const isMineOpt = myVotes.has(o.key)
          return (
            <button
              key={o.key}
              onClick={() => vote(o.key)}
              disabled={busy}
              className="relative w-full h-10 rounded-xl border overflow-hidden text-left disabled:opacity-70 active:scale-[0.99] transition"
              style={{
                borderColor: isMineOpt ? "rgba(236,72,153,0.6)" : "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <span
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: hasVoted ? pct + "%" : "0%",
                  background: isMineOpt
                    ? "linear-gradient(90deg, rgba(236,72,153,0.30) 0%, rgba(168,85,247,0.30) 100%)"
                    : "rgba(255,255,255,0.08)",
                }}
              />
              <div className="relative px-3 h-full flex items-center justify-between gap-2">
                <span className="text-cream text-[12.5px] font-semibold truncate flex items-center gap-1.5">
                  {isMineOpt && <Check size={12} strokeWidth={3} className="text-pink-400 shrink-0" />}
                  {o.label}
                </span>
                {hasVoted && <span className="text-muted text-[11.5px] font-bold shrink-0">{pct}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-muted text-[10.5px] mt-2">
        {loading ? "Loading…" : `${totalVotes} ${totalVotes === 1 ? "vote" : "votes"}${poll.multiple_choice ? " · multi" : ""}${hasVoted ? " · tap to change" : ""}`}
      </p>
    </div>
  )
}

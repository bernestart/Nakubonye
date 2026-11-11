import { useEffect, useState } from "react"
import { tap } from "../../lib/haptic"
import { supabase } from "../../lib/supabase"

export default function StoryPollSticker({ poll, storyId, myId }) {
  const [voted, setVoted] = useState(null)
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const targetId = storyId || poll?.story_id || poll?.id || null

  useEffect(() => {
    let cancelled = false
    if (!targetId) { setLoading(false); return }
    ;(async () => {
      try {
        const { data: rows, error } = await supabase
          .from("story_poll_votes")
          .select("user_id, option_index")
          .eq("story_id", targetId)
        if (cancelled) return
        if (error) {
          const staticCounts = {}
          Object.values(poll.votes || {}).forEach((idx) => { staticCounts[idx] = (staticCounts[idx] || 0) + 1 })
          setCounts(staticCounts)
          const myVote = poll.votes?.[myId]
          if (typeof myVote === "number") setVoted(myVote)
          setLoading(false)
          return
        }
        const agg = {}
        let myVote = null
        ;(rows || []).forEach((r) => {
          agg[r.option_index] = (agg[r.option_index] || 0) + 1
          if (r.user_id === myId) myVote = r.option_index
        })
        setCounts(agg)
        setVoted(myVote)
        setLoading(false)
      } catch (e) { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [targetId, myId])

  if (!poll || !poll.options || poll.options.length === 0) return null

  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0)
  const getPercent = (idx) => totalVotes === 0 ? 0 : Math.round(((counts[idx] || 0) / totalVotes) * 100)

  async function vote(idx) {
    if (submitting || !targetId || !myId) return
    tap("light")
    setSubmitting(true)
    const prevVoted = voted
    const prevCounts = { ...counts }
    const nextCounts = { ...counts }
    if (prevVoted !== null && nextCounts[prevVoted]) nextCounts[prevVoted] = Math.max(0, nextCounts[prevVoted] - 1)
    nextCounts[idx] = (nextCounts[idx] || 0) + 1
    setVoted(idx); setCounts(nextCounts)
    const { error } = await supabase.from("story_poll_votes").upsert({ story_id: targetId, user_id: myId, option_index: idx }, { onConflict: "story_id,user_id" })
    setSubmitting(false)
    if (error) { setVoted(prevVoted); setCounts(prevCounts) }
  }

  const showResults = voted !== null

  return (
    <div data-nk-tap-ignore className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-center z-30 px-4 pointer-events-auto">
      <div className="w-full max-w-[300px] bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
        <h3 className="text-white text-center font-bold text-[15px] mb-4 leading-snug">{poll.question}</h3>
        <div className="flex flex-col gap-2">
          {poll.options.map((opt, i) => {
            const isVoted = voted === i
            const pct = getPercent(i)
            return (
              <button key={i} onClick={() => vote(i)} disabled={submitting || loading}
                className="relative w-full h-10 rounded-full overflow-hidden border border-white/10 flex items-center px-4 active:scale-[0.98] transition-transform disabled:opacity-70"
                style={{ background: isVoted ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)" }}>
                {showResults && <div className="absolute left-0 top-0 bottom-0 bg-purple-500/40 transition-all duration-500" style={{ width: `${pct}%` }} />}
                <span className="relative z-10 text-white text-[13px] font-semibold flex-1 text-left">{opt}</span>
                {showResults && <span className="relative z-10 text-white/80 text-[12px] font-bold">{pct}%</span>}
              </button>
            )
          })}
        </div>
        {showResults && totalVotes > 0 && <p className="text-white/50 text-[11px] text-center mt-3">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</p>}
      </div>
    </div>
  )
}

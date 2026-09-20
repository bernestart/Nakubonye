import { useEffect, useState } from "react"
import { X, Eye, Heart, MessageCircle, Bookmark, Clock } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"

export default function ReelInsights({ reel, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: res, error: err } = await supabase.rpc("get_my_reel_insights", { p_reel_id: reel.id })
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      setData(res)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [reel.id])

  const fmtNum = (n) => {
    if (n == null) return "—"
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
    if (n >= 1000) return (n / 1000).toFixed(1) + "K"
    return String(n)
  }
  const fmtTime = (s) => {
    if (!s) return "0s"
    if (s < 60) return Math.round(s) + "s"
    const m = Math.floor(s / 60)
    const rem = Math.round(s % 60)
    return m + "m " + rem + "s"
  }

  const thumbSrc = (() => {
    const list = Array.isArray(reel.clips) && reel.clips.length > 0 ? reel.clips : [{ url: reel.video_url }]
    return list[0].url
  })()

  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-cream font-extrabold text-[17px]">Reel insights</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-3 mb-5">
          <div className="w-14 h-20 rounded-xl overflow-hidden bg-black shrink-0">
            <video src={thumbSrc} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-cream text-[13.5px] font-semibold line-clamp-2">
              {reel.caption || "No caption"}
            </p>
            <p className="text-muted text-[11.5px] mt-1">
              Posted {new Date(reel.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center h-24 text-muted text-[13px]">Loading…</div>
        ) : error ? (
          <p className="text-red-400 text-[13px] text-center py-3">{error}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Stat icon={<Eye size={16} />}  label="Views"    value={fmtNum(data.views)} />
            <Stat icon={<Heart size={16} />} label="Likes"    value={fmtNum(data.likes)} />
            <Stat icon={<MessageCircle size={16} />} label="Comments" value={fmtNum(data.comments)} />
            <Stat icon={<Bookmark size={16} />} label="Saves"    value={fmtNum(data.saves)} />
            <Stat icon={<Clock size={16} />} label="Watch time" value={fmtTime(data.watch_total)} full />
            <Stat icon={<Clock size={16} />} label="Avg. watch" value={fmtTime(data.watch_avg)} full />
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, full }) {
  return (
    <div
      className="rounded-2xl bg-white/[0.04] border border-white/8 p-3.5 flex items-center gap-3"
      style={full ? { gridColumn: "1 / -1" } : undefined}
    >
      <span className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center text-purple-300 shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-muted text-[11.5px]">{label}</p>
        <p className="text-cream font-extrabold text-[16px]">{value}</p>
      </div>
    </div>
  )
}

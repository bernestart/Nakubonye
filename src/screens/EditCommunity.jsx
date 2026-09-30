import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

const EMOJI_CHOICES = ["💬", "🔥", "🌍", "🎵", "🎨", "⚽", "📚", "💼", "🍕", "💜", "🌱", "🎮", "🏔", "🌊", "🦋", "✨"]
const COLOR_CHOICES = ["#EC4899", "#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#06B6D4"]

export default function EditCommunity() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("💬")
  const [color, setColor] = useState("#EC4899")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!id || !myId) return
    const { data: c, error: cErr } = await supabase
      .from("communities")
      .select("id, name, description, emoji, cover_color, created_by")
      .eq("id", id)
      .maybeSingle()
    if (cErr || !c) { setError("Community not found"); setLoading(false); return }
    if (c.created_by !== myId) { setError("Only the creator can edit this community"); setLoading(false); return }
    setName(c.name || "")
    setDescription(c.description || "")
    setEmoji(c.emoji || "💬")
    setColor(c.cover_color || "#EC4899")
    setLoading(false)
  }, [id, myId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!name.trim() || !myId) { setError("Name required"); return }
    setBusy(true); setError(""); tap("light")
    const { error: upErr } = await supabase
      .from("communities")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        emoji,
        cover_color: color,
      })
      .eq("id", id)
    setBusy(false)
    if (upErr) { setError(upErr.message); return }
    nav(-1)
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, background: "#0B0B14", display: "flex" }}>
        <div className="flex-1 grid place-items-center">
          <span className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Edit community</span>
        <button
          onClick={save}
          disabled={busy || !name.trim()}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-10">
        {/* Preview */}
        <div className="rounded-3xl p-5 mb-6 text-center"
             style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
          <div className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-3 text-[32px]"
               style={{ background: `${color}33`, border: `1px solid ${color}66` }}>
            {emoji}
          </div>
          <p className="text-cream text-[18px] font-extrabold truncate">{name || "Community name"}</p>
        </div>

        {/* Name */}
        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="Community name"
          className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-5"
        />

        {/* Description */}
        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder="What is this community about?"
          rows={4}
          className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-5"
        />

        {/* Emoji */}
        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Icon
        </label>
        <div className="grid grid-cols-8 gap-2 mb-5">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { tap("light"); setEmoji(e) }}
              className="aspect-square rounded-xl grid place-items-center text-[22px] active:scale-95 transition-transform"
              style={{
                background: emoji === e ? `${color}33` : "rgba(255,255,255,0.04)",
                border: emoji === e ? `1.5px solid ${color}` : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Color */}
        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Color
        </label>
        <div className="grid grid-cols-8 gap-2 mb-5">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { tap("light"); setColor(c) }}
              className="aspect-square rounded-full"
              style={{
                background: c,
                border: color === c ? "3px solid #fff" : "3px solid transparent",
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mt-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

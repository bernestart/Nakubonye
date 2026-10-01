import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

const EMOJI_CHOICES = ["💬", "🔥", "🌍", "🎵", "🎨", "⚽", "📚", "💼", "🍕", "💜", "🌱", "🎮", "🏔", "🌊", "🦋", "✨", "🎬", "🎯", "🏆", "📸"]
const COLOR_CHOICES = ["#EC4899", "#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#06B6D4"]

export default function CreateCommunity() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("💬")
  const [color, setColor] = useState("#EC4899")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function create() {
    if (!name.trim() || !myId) { setError("Name required"); return }
    setBusy(true); setError(""); tap("light")

    try {
      // Generate a slug
      const baseSlug = name.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "community"
      const slug = baseSlug + "-" + Math.random().toString(36).slice(2, 6)

      // 1. Create community
      const { data: comm, error: cErr } = await supabase
        .from("communities")
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          emoji,
          cover_color: color,
          member_count: 1,
          is_active: true,
          created_by: myId,
        })
        .select("id")
        .single()
      if (cErr) throw new Error(cErr.message)

      // 2. Auto-join as first member
      const { error: mErr } = await supabase
        .from("community_memberships")
        .insert({ community_id: comm.id, user_id: myId })
      if (mErr) throw new Error(mErr.message)

      nav("/communities/" + comm.id, { replace: true })
    } catch (e) {
      setError(e.message || "Could not create community")
      setBusy(false)
    }
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
        <span className="text-cream font-bold text-[15px] flex-1">New community</span>
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-10">
        {/* Live preview */}
        <div className="rounded-3xl p-5 mb-6 text-center"
             style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
          <div className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-3 text-[32px]"
               style={{ background: `${color}33`, border: `1px solid ${color}66` }}>
            {emoji}
          </div>
          <p className="text-cream text-[18px] font-extrabold truncate">
            {name || "Community name"}
          </p>
          {description && (
            <p className="text-muted text-[12.5px] mt-1 line-clamp-2">{description}</p>
          )}
        </div>

        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="What's your community called?"
          autoFocus
          className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-5"
        />

        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="What is this community about?"
          rows={3}
          className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-5"
        />

        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Icon
        </label>
        <div className="grid grid-cols-10 gap-1.5 mb-5">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { tap("light"); setEmoji(e) }}
              className="aspect-square rounded-lg grid place-items-center text-[18px] active:scale-95 transition-transform"
              style={{
                background: emoji === e ? `${color}33` : "rgba(255,255,255,0.04)",
                border: emoji === e ? `1.5px solid ${color}` : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {e}
            </button>
          ))}
        </div>

        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Color
        </label>
        <div className="grid grid-cols-8 gap-2 mb-6">
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
          <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

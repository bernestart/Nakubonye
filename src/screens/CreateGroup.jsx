import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Search, X, Camera, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function CreateGroup() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const avatarRef = useRef(null)

  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Search users
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .neq("id", myId)
        .limit(20)
      if (!cancelled) setResults(data || [])
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, myId])

  function toggle(user) {
    if (selected.find((s) => s.id === user.id)) {
      setSelected((arr) => arr.filter((s) => s.id !== user.id))
    } else {
      setSelected((arr) => [...arr, user])
    }
  }

  function pickAvatar(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) return
    setAvatarFile(f)
    setAvatarPreview(URL.createObjectURL(f))
    e.target.value = ""
  }

  async function create() {
    if (!name.trim() || !myId) { setError("Add a name"); return }
    if (selected.length === 0) { setError("Add at least one member"); return }
    setBusy(true); setError(""); tap("light")

    try {
      // 1. Upload avatar (optional)
      let avatarUrl = null
      if (avatarFile) {
        const ext = (avatarFile.name.split(".").pop() || "jpg").toLowerCase()
        const path = `group-avatars/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, avatarFile, { upsert: false, contentType: avatarFile.type })
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
        avatarUrl = pub?.publicUrl || null
      }

      // 2. Create group
      const { data: group, error: gErr } = await supabase
        .from("groups")
        .insert({ name: name.trim(), avatar_url: avatarUrl, created_by: myId })
        .select("id")
        .single()
      if (gErr) throw new Error(gErr.message)

      // 3. Add members (me as owner + selected as members)
      const rows = [
        { group_id: group.id, user_id: myId, role: "owner" },
        ...selected.map((u) => ({ group_id: group.id, user_id: u.id, role: "member" })),
      ]
      const { error: mErr } = await supabase.from("group_members").insert(rows)
      if (mErr) throw new Error(mErr.message)

      nav(`/groups/${group.id}`, { replace: true })
    } catch (e) {
      setError(e.message || "Could not create group")
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
        <span className="text-cream font-bold text-[15px] flex-1">New group</span>
        <button
          onClick={create}
          disabled={busy || !name.trim() || selected.length === 0}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => avatarRef.current?.click()} className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-500/40 grid place-items-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={22} className="text-purple-300" />
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-purple-600 border-2 border-[#0B0B14] grid place-items-center">
              <Camera size={11} color="#fff" />
            </span>
          </button>
          <input ref={avatarRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Group name"
            autoFocus
            className="flex-1 h-12 rounded-2xl bg-elevated border border-white/10 px-4 text-cream text-[15px] font-semibold placeholder:text-subtle focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((u) => (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)" }}
              >
                <span className="text-purple-200 text-[12.5px] font-semibold">
                  {u.display_name || u.username}
                </span>
                <X size={12} color="#D8B4FE" />
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-11 mb-3">
          <Search size={16} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people to add…"
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none"
          />
        </div>

        {/* Results */}
        <div className="flex flex-col gap-1">
          {query.length >= 2 && results.length === 0 && (
            <p className="text-subtle text-[12.5px] text-center py-3">No results</p>
          )}
          {results.map((u) => {
            const isSel = selected.some((s) => s.id === u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className="flex items-center gap-3 p-3 rounded-xl text-left"
                style={{
                  background: isSel ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: isSel ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="w-10 h-10 rounded-full bg-purple-600 grid place-items-center text-white font-black text-sm shrink-0">
                  {(u.display_name || u.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[13.5px] truncate">
                    {u.display_name || u.username}
                  </p>
                  {u.username && <p className="text-muted text-[11.5px]">@{u.username}</p>}
                </div>
                {isSel && <Check size={16} className="text-purple-400" strokeWidth={3} />}
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mt-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

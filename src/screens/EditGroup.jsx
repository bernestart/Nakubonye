import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Camera } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function EditGroup() {
  const nav = useNavigate()
  const { id: groupId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!groupId || !myId) return
    const { data: g } = await supabase
      .from("groups")
      .select("id, name, avatar_url, created_by")
      .eq("id", groupId)
      .maybeSingle()
    if (!g) { setError("Group not found"); setLoading(false); return }

    // must be admin/owner
    const { data: mem } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", myId)
      .maybeSingle()
    const role = mem?.role
    if (role !== "owner" && role !== "admin") {
      setError("Only admins can edit this group")
      setLoading(false)
      return
    }

    setName(g.name || "")
    setAvatarUrl(g.avatar_url || null)
    setLoading(false)
  }, [groupId, myId])

  useEffect(() => { load() }, [load])

  function pickAvatar(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) return
    setAvatarFile(f)
    setAvatarPreview(URL.createObjectURL(f))
    e.target.value = ""
  }

  async function save() {
    if (!name.trim() || !myId) { setError("Add a name"); return }
    setBusy(true); setError(""); tap("light")
    try {
      let nextUrl = avatarUrl
      if (avatarFile) {
        const ext = (avatarFile.name.split(".").pop() || "jpg").toLowerCase()
        const path = `group-avatars/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, avatarFile, { upsert: false, contentType: avatarFile.type })
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
        nextUrl = pub?.publicUrl || nextUrl
      }

      const { error: upErr } = await supabase
        .from("groups")
        .update({ name: name.trim(), avatar_url: nextUrl, updated_at: new Date().toISOString() })
        .eq("id", groupId)
      if (upErr) throw new Error(upErr.message)

      nav(-1)
    } catch (e) {
      setError(e.message || "Could not save")
      setBusy(false)
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Edit group</span>
        <button onClick={save} disabled={busy || !name.trim()}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>
          {busy ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col items-center mb-8">
          <button onClick={() => fileRef.current?.click()} className="relative">
            <div className="w-24 h-24 rounded-full bg-purple-500/20 border-2 border-purple-500/40 grid place-items-center overflow-hidden">
              {avatarPreview || avatarUrl ? (
                <img src={avatarPreview || avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={28} className="text-purple-300" />
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-purple-600 border-2 border-[#0B0B14] grid place-items-center">
              <Camera size={14} color="#fff" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
          <p className="text-subtle text-[12px] mt-2">Tap to change</p>
        </div>

        <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Group name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="Group name"
          className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[15px] font-semibold placeholder:text-subtle focus:outline-none focus:border-purple-500"
        />

        {error && (
          <div className="mt-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

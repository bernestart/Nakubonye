const fs = require('fs')

// 1. Messages.jsx — add group_messages realtime
{
  const p = 'src/screens/Messages.jsx'
  let s = fs.readFileSync(p, 'utf8')

  const RE_ANCHOR = `      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, schedule)`
  if (!s.includes(RE_ANCHOR)) throw new Error('realtime anchor missing')
  if (!s.includes('group_messages'))
    s = s.replace(RE_ANCHOR, `${RE_ANCHOR}
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, schedule)`)

  fs.writeFileSync(p, s)
  console.log('OK messages realtime')
}

// 2. Create GroupMembers screen
{
  const p = 'src/screens/GroupMembers.jsx'
  const content = `import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Users, Crown, Shield, UserMinus, UserPlus, MoreVertical } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function GroupMembers() {
  const nav = useNavigate()
  const { id: groupId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [myRole, setMyRole] = useState(null)
  const [menuFor, setMenuFor] = useState(null)

  const load = useCallback(async () => {
    if (!groupId || !myId) return
    setLoading(true)
    const { data: g } = await supabase.from("groups").select("id, name, avatar_url").eq("id", groupId).maybeSingle()
    setGroup(g)

    const { data: mem } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true })
    const list = mem || []
    setMembers(list)
    const mine = list.find((m) => m.user_id === myId)
    setMyRole(mine?.role || null)

    const ids = list.map((m) => m.user_id)
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids)
      setProfiles(new Map((profs || []).map((p) => [p.id, p])))
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const pm = new Map()
      ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
      setPhotos(pm)
    }
    setLoading(false)
  }, [groupId, myId])

  useEffect(() => { load() }, [load])

  async function kick(userId) {
    if (!confirm("Remove this member from the group?")) return
    tap("light")
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId)
    setMenuFor(null)
    load()
  }

  async function makeAdmin(userId, currentRole) {
    tap("light")
    const next = currentRole === "admin" ? "member" : "admin"
    await supabase.from("group_members").update({ role: next }).eq("group_id", groupId).eq("user_id", userId)
    setMenuFor(null)
    load()
  }

  const canManage = myRole === "owner" || myRole === "admin"

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
        <span className="text-cream font-bold text-[15px] flex-1 truncate">
          {group?.name || "Members"} · {members.length}
        </span>
        {canManage && (
          <button
            onClick={() => { tap("light"); nav("/groups/" + groupId + "/add") }}
            className="h-9 px-3 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <UserPlus size={15} strokeWidth={3} /> Add
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-10">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 64 }} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-center py-12 text-muted text-[13px]">No members</p>
        ) : (
          members.map((m) => {
            const p = profiles.get(m.user_id)
            const photoPath = photos.get(m.user_id)
            const name = p?.display_name || p?.username || "Someone"
            const isMe = m.user_id === myId
            const roleIcon = m.role === "owner" ? <Crown size={13} className="text-amber-400" /> : m.role === "admin" ? <Shield size={13} className="text-purple-400" /> : null
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.03]">
                <button
                  onClick={() => !isMe && nav("/profile/" + m.user_id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                    {photoPath ? (
                      <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      name[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[14px] truncate flex items-center gap-1.5">
                      {name} {isMe && <span className="text-muted text-[11.5px] font-normal">(you)</span>}
                      {roleIcon}
                    </p>
                    {p?.username && <p className="text-muted text-[11.5px] truncate">@{p.username}</p>}
                  </div>
                </button>
                {canManage && !isMe && m.role !== "owner" && (
                  <button
                    onClick={() => setMenuFor(m)}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted"
                    aria-label="Options"
                  >
                    <MoreVertical size={16} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {menuFor && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setMenuFor(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <p className="text-cream font-bold text-[15px] mb-2 truncate">
              {profiles.get(menuFor.user_id)?.display_name || "Member"}
            </p>
            <button
              onClick={() => makeAdmin(menuFor.user_id, menuFor.role)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Shield size={18} /> <span className="font-semibold text-[14px]">
                {menuFor.role === "admin" ? "Remove as admin" : "Make admin"}
              </span>
            </button>
            <button
              onClick={() => kick(menuFor.user_id)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/30 text-left text-danger"
            >
              <UserMinus size={18} /> <span className="font-semibold text-[14px]">Remove from group</span>
            </button>
            <button onClick={() => setMenuFor(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
`
  fs.writeFileSync(p, content)
  console.log('OK GroupMembers screen')
}

// 3. Create AddGroupMembers screen
{
  const p = 'src/screens/AddGroupMembers.jsx'
  const content = `import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Search, X, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function AddGroupMembers() {
  const nav = useNavigate()
  const { id: groupId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [existingIds, setExistingIds] = useState(new Set())
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from("group_members").select("user_id").eq("group_id", groupId)
      setExistingIds(new Set((data || []).map((m) => m.user_id)))
    })()
  }, [groupId])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .or(\`display_name.ilike.%\${q}%,username.ilike.%\${q}%\`)
        .limit(20)
      if (cancelled) return
      setResults((data || []).filter((u) => !existingIds.has(u.id)))
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, existingIds])

  function toggle(u) {
    if (selected.find((s) => s.id === u.id)) setSelected((a) => a.filter((s) => s.id !== u.id))
    else setSelected((a) => [...a, u])
  }

  async function add() {
    if (selected.length === 0) return
    setBusy(true); setError(""); tap("light")
    const rows = selected.map((u) => ({ group_id: groupId, user_id: u.id, role: "member" }))
    const { error: insErr } = await supabase.from("group_members").insert(rows)
    setBusy(false)
    if (insErr) { setError(insErr.message); return }
    nav(-1)
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
        <span className="text-cream font-bold text-[15px] flex-1">Add members</span>
        <button
          onClick={add}
          disabled={busy || selected.length === 0}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((u) => (
              <button key={u.id} onClick={() => toggle(u)}
                className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)" }}>
                <span className="text-purple-200 text-[12.5px] font-semibold">{u.display_name || u.username}</span>
                <X size={12} color="#D8B4FE" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-11 mb-3">
          <Search size={16} className="text-muted shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people to add…"
            autoFocus
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none" />
        </div>

        {query.length >= 2 && results.length === 0 && (
          <p className="text-subtle text-[12.5px] text-center py-3">No results</p>
        )}

        <div className="flex flex-col gap-1">
          {results.map((u) => {
            const isSel = selected.some((s) => s.id === u.id)
            return (
              <button key={u.id} onClick={() => toggle(u)}
                className="flex items-center gap-3 p-3 rounded-xl text-left"
                style={{
                  background: isSel ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: isSel ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                <div className="w-10 h-10 rounded-full bg-purple-600 grid place-items-center text-white font-black text-sm shrink-0">
                  {(u.display_name || u.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[13.5px] truncate">{u.display_name || u.username}</p>
                  {u.username && <p className="text-muted text-[11.5px]">@{u.username}</p>}
                </div>
                {isSel && <Check size={16} className="text-purple-400" strokeWidth={3} />}
              </button>
            )
          })}
        </div>

        {error && <div className="mt-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">{error}</div>}
      </div>
    </div>
  )
}
`
  fs.writeFileSync(p, content)
  console.log('OK AddGroupMembers screen')
}

// 4. Routes
{
  const p = 'src/App.jsx'
  let s = fs.readFileSync(p, 'utf8')
  const IMP = `import GroupChat from './screens/GroupChat'`
  if (!s.includes(IMP)) throw new Error('GroupChat import missing')
  let add = ''
  if (!s.includes('GroupMembers')) add += "\\nimport GroupMembers from './screens/GroupMembers'"
  if (!s.includes('AddGroupMembers')) add += "\\nimport AddGroupMembers from './screens/AddGroupMembers'"
  if (add) s = s.replace(IMP, IMP + add)

  const ROUTE = `<Route path="/groups/:id" element={<Guard><GroupChat /></Guard>} />`
  if (!s.includes(ROUTE)) throw new Error('group route missing')
  if (!s.includes('path="/groups/:id/members"'))
    s = s.replace(ROUTE, \`\${ROUTE}
        <Route path="/groups/:id/members" element={<Guard><GroupMembers /></Guard>} />
        <Route path="/groups/:id/add" element={<Guard><AddGroupMembers /></Guard>} />\`)

  fs.writeFileSync(p, s)
  console.log('OK routes')
}

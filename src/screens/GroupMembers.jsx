import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Crown, Shield, UserMinus, UserPlus, MoreVertical } from "lucide-react"
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
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids)
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
    if (!confirm("Remove this member?")) return
    tap("light")
    const me = profiles.get(myId)
    const them = profiles.get(userId)
    const myName = me?.display_name || me?.username || "Someone"
    const theirName = them?.display_name || them?.username || "Someone"
    await supabase.from("group_messages").insert({
      group_id: groupId,
      sender_id: myId,
      content: myName + " removed " + theirName,
      is_system: true,
    })
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId)
    setMenuFor(null); load()
  }

  async function makeAdmin(userId, currentRole) {
    tap("light")
    const next = currentRole === "admin" ? "member" : "admin"
    await supabase.from("group_members").update({ role: next }).eq("group_id", groupId).eq("user_id", userId)
    setMenuFor(null); load()
  }

  const canManage = myRole === "owner" || myRole === "admin"

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
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
            {[0,1,2,3].map((i) => <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 64 }} />)}
          </div>
        ) : (
          members.map((m) => {
            const p = profiles.get(m.user_id)
            const photoPath = photos.get(m.user_id)
            const name = p?.display_name || p?.username || "Someone"
            const isMe = m.user_id === myId
            const roleIcon = m.role === "owner" ? <Crown size={13} className="text-amber-400" /> : m.role === "admin" ? <Shield size={13} className="text-purple-400" /> : null
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.03]">
                <button onClick={() => !isMe && nav("/profile/" + m.user_id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                    {photoPath ? <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" /> : name[0].toUpperCase()}
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
                  <button onClick={() => setMenuFor(m)} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Options">
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
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <p className="text-cream font-bold text-[15px] mb-2 truncate">
              {profiles.get(menuFor.user_id)?.display_name || "Member"}
            </p>
            <button onClick={() => makeAdmin(menuFor.user_id, menuFor.role)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream">
              <Shield size={18} /> <span className="font-semibold text-[14px]">{menuFor.role === "admin" ? "Remove as admin" : "Make admin"}</span>
            </button>
            <button onClick={() => kick(menuFor.user_id)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/30 text-left text-danger">
              <UserMinus size={18} /> <span className="font-semibold text-[14px]">Remove from group</span>
            </button>
            <button onClick={() => setMenuFor(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

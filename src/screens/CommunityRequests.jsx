import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

export default function CommunityRequests() {
  const { id } = useParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [busyId, setBusyId] = useState(null)

  async function load() {
    if (!id || !myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("community_join_requests")
      .select("id, user_id, message, created_at")
      .eq("community_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    const ids = [...new Set((rows || []).map((r) => r.user_id))]
    let profMap = new Map(), phMap = new Map()
    if (ids.length > 0) {
      const [profs, phs] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids),
        supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", ids).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
      ])
      ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
      ;(phs.data || []).forEach((x) => { if (!phMap.has(x.user_id)) phMap.set(x.user_id, x.storage_path) })
    }

    setRequests((rows || []).map((r) => ({
      ...r,
      _profile: profMap.get(r.user_id),
      _photo: phMap.get(r.user_id) ? publicPhotoUrl(phMap.get(r.user_id)) : null,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [id, myId])

  async function decide(req, action) {
    if (busyId) return
    setBusyId(req.id); tap("light")
    try {
      if (action === "approve") {
        const { error: insErr } = await supabase.from("community_memberships").insert({
          community_id: Number(id),
          user_id: req.user_id,
          role: "member",
        })
        if (insErr && !insErr.message.includes("duplicate")) throw insErr
      }
      await supabase.from("community_join_requests").update({
        status: action === "approve" ? "approved" : "rejected",
        reviewed_by: myId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", req.id)
      setRequests((cur) => cur.filter((r) => r.id !== req.id))
    } catch (e) {
      console.warn(e)
    }
    setBusyId(null)
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <AppHeader />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <button
            onClick={() => { tap("light"); nav(-1) }}
            className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.06] border border-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-cream" />
          </button>
          <h1 className="text-cream font-extrabold text-[16px]">Join requests</h1>
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-cream font-bold text-[15px] mb-1">No pending requests</p>
            <p className="text-muted text-[13px]">When people ask to join, they'll show up here.</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                    {r._photo ? <img src={r._photo} alt="" className="w-full h-full object-cover" /> : (r._profile?.display_name || "?")[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13.5px] truncate">
                      {r._profile?.display_name || r._profile?.username || "User"}
                    </p>
                    {r._profile?.username && (
                      <p className="text-muted text-[11.5px] truncate">@{r._profile.username}</p>
                    )}
                  </div>
                </div>
                {r.message && (
                  <p className="text-cream/80 text-[12.5px] italic mb-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/6">
                    "{r.message}"
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "approve")}
                    className="flex-1 h-9 rounded-full text-white font-bold text-[12.5px] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                  >
                    <Check size={14} strokeWidth={2.6} /> Approve
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "reject")}
                    className="flex-1 h-9 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <X size={14} strokeWidth={2.6} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

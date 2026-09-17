import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Coins, Zap, MessageCircle, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function GlobalEventPopup() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [queue, setQueue] = useState([])
  const seenRef = useRef(new Set())
  const timerRef = useRef(null)

  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel("global-events-" + myId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "coin_transactions", filter: "user_id=eq." + myId },
        (payload) => {
          const t = payload.new
          if (!t || Number(t.amount) <= 0) return
          if (seenRef.current.has("coin-" + t.id)) return
          seenRef.current.add("coin-" + t.id)
          setQueue((q) => [...q, { id: "coin-" + t.id, kind: "coins", amount: Number(t.amount), description: t.description || "Coins earned" }])
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "super_requests", filter: "recipient_id=eq." + myId },
        async (payload) => {
          const r = payload.new
          if (!r) return
          if (seenRef.current.has("super-" + r.id)) return
          seenRef.current.add("super-" + r.id)
          const { data: prof } = await supabase.from("profiles").select("id, display_name, username").eq("id", r.sender_id).maybeSingle()
          const { data: photo } = await supabase.from("profile_photos").select("storage_path").eq("user_id", r.sender_id).order("is_primary", { ascending: false }).order("display_order", { ascending: true }).limit(1).maybeSingle()
          setQueue((q) => [...q, { id: "super-" + r.id, kind: "super", name: prof?.display_name || prof?.username || "Someone", photo: publicPhotoUrl(photo?.storage_path), route: "/notifications" }])
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: "recipient_id=eq." + myId },
        async (payload) => {
          const c = payload.new
          if (!c || !c.is_direct) return
          if (seenRef.current.has("dm-" + c.id)) return
          seenRef.current.add("dm-" + c.id)
          const { data: prof } = await supabase.from("profiles").select("id, display_name, username").eq("id", c.initiator_id).maybeSingle()
          const { data: photo } = await supabase.from("profile_photos").select("storage_path").eq("user_id", c.initiator_id).order("is_primary", { ascending: false }).order("display_order", { ascending: true }).limit(1).maybeSingle()
          setQueue((q) => [...q, { id: "dm-" + c.id, kind: "dm", name: prof?.display_name || prof?.username || "Someone", photo: publicPhotoUrl(photo?.storage_path), route: "/messages/" + c.initiator_id }])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId])

  const current = queue[0]

  useEffect(() => {
    if (!current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setQueue((q) => q.slice(1)), 6000)
    return () => clearTimeout(timerRef.current)
  }, [current])

  if (!current) return null

  function dismiss() { tap("light"); setQueue((q) => q.slice(1)) }
  function open() {
    tap("light")
    if (current.route) nav(current.route)
    setQueue((q) => q.slice(1))
  }

  const isGold = current.kind === "coins" || current.kind === "super"

  return (
    <div style={{ position: "fixed", top: 12, left: 0, right: 0, zIndex: 60, display: "flex", justifyContent: "center", pointerEvents: "none", padding: "0 12px" }}>
      <button
        onClick={open}
        style={{
          pointerEvents: "auto",
          maxWidth: 420,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: 18,
          border: isGold ? "1px solid rgba(245,158,11,0.55)" : "1px solid rgba(168,85,247,0.55)",
          background: isGold
            ? "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(236,72,153,0.15) 100%)"
            : "linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(236,72,153,0.14) 100%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          color: "#fff",
          textAlign: "left",
          animation: "nk-pop-in 240ms ease-out",
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
          background: isGold ? "linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)" : "linear-gradient(135deg, #A855F7 0%, #EC4899 100%)",
          boxShadow: isGold ? "0 6px 18px rgba(245,158,11,0.5)" : "0 6px 18px rgba(168,85,247,0.5)",
          overflow: "hidden",
        }}>
          {current.kind === "coins" ? <Coins size={22} strokeWidth={2.4} className="text-white" />
            : current.photo ? <img src={current.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : current.kind === "super" ? <Zap size={22} strokeWidth={2.4} className="text-white" />
            : <MessageCircle size={22} strokeWidth={2.4} className="text-white" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: isGold ? "#FDE68A" : "#E9D5FF" }}>
            {current.kind === "coins" && `+${current.amount} coins`}
            {current.kind === "super" && "Super Request"}
            {current.kind === "dm" && "Paid message"}
          </p>
          <p style={{ fontSize: 12.5, margin: "2px 0 0", color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current.kind === "coins" ? current.description
              : current.kind === "super" ? `${current.name} sent you a Super Request`
              : `${current.name} paid to message you`}
          </p>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); dismiss() }}
          style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "#fff", flexShrink: 0, display: "grid", placeItems: "center", cursor: "pointer" }}
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={2.6} />
        </span>
      </button>
      <style>{`@keyframes nk-pop-in { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

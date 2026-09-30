import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { AlertCircle, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function JoinCommunity() {
  const nav = useNavigate()
  const { code } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [community, setCommunity] = useState(null)
  const [state, setState] = useState("loading") // loading | found | joining | joined | error | already | disabled
  const [error, setError] = useState("")

  useEffect(() => {
    if (!code || !myId) return
    ;(async () => {
      setLoading(true)
      const { data: c } = await supabase
        .from("communities")
        .select("id, name, description, emoji, cover_color, invite_enabled")
        .eq("invite_code", code)
        .maybeSingle()

      if (!c) { setState("error"); setError("This invite link is invalid or expired"); setLoading(false); return }
      if (c.invite_enabled === false) { setState("disabled"); setError("This invite link has been turned off"); setLoading(false); return }
      setCommunity(c)

      // Already a member?
      const { data: mem } = await supabase
        .from("community_memberships")
        .select("user_id")
        .eq("community_id", c.id)
        .eq("user_id", myId)
        .maybeSingle()
      if (mem) { setState("already"); setLoading(false); return }

      setState("found")
      setLoading(false)
    })()
  }, [code, myId])

  async function join() {
    if (!community || !myId) return
    setState("joining"); tap("light")

    const { error: insErr } = await supabase
      .from("community_memberships")
      .insert({ community_id: community.id, user_id: myId })

    if (insErr) {
      if (insErr.code === "23505") { setState("already"); return }
      setState("error"); setError(insErr.message); return
    }

    setState("joined")
    setTimeout(() => nav("/communities/" + community.id, { replace: true }), 800)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <div className="flex-1 grid place-items-center px-6 text-center">
        {state === "loading" && (
          <div>
            <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-muted text-[13px]">Loading invite…</p>
          </div>
        )}

        {(state === "error" || state === "disabled") && (
          <div className="max-w-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 grid place-items-center mx-auto mb-4">
              <AlertCircle size={22} className="text-red-300" />
            </div>
            <p className="text-cream font-bold text-[16px] mb-1.5">Can't join</p>
            <p className="text-muted text-[13px] mb-6">{error}</p>
            <button
              onClick={() => nav("/communities", { replace: true })}
              className="h-11 px-5 rounded-full text-white font-bold text-[13.5px]"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              Back to communities
            </button>
          </div>
        )}

        {state === "found" && community && (
          <div className="max-w-[340px]">
            <div className="w-24 h-24 rounded-3xl grid place-items-center mx-auto mb-4 text-[42px]"
                 style={{ background: `${community.cover_color}33`, border: `1px solid ${community.cover_color}66` }}>
              {community.emoji || "💬"}
            </div>
            <p className="text-subtle text-[11.5px] uppercase tracking-wider font-bold mb-1">You're invited to</p>
            <p className="text-cream font-black text-[22px] mb-2">{community.name}</p>
            {community.description && (
              <p className="text-muted text-[13.5px] leading-relaxed mb-6 max-w-[300px]">{community.description}</p>
            )}
            <button
              onClick={join}
              className="w-full h-12 rounded-full text-white font-bold text-[14.5px]"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              Join community
            </button>
          </div>
        )}

        {state === "joining" && (
          <div>
            <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-muted text-[13px]">Joining…</p>
          </div>
        )}

        {state === "joined" && (
          <div>
            <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4"
                 style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))", border: "1.5px solid rgba(236,72,153,0.5)" }}>
              <Check size={30} className="text-purple-300" strokeWidth={3} />
            </div>
            <p className="text-cream font-bold text-[16px]">You joined!</p>
          </div>
        )}

        {state === "already" && community && (
          <div className="max-w-[340px]">
            <div className="w-24 h-24 rounded-3xl grid place-items-center mx-auto mb-4 text-[42px]"
                 style={{ background: `${community.cover_color}33`, border: `1px solid ${community.cover_color}66` }}>
              {community.emoji || "💬"}
            </div>
            <p className="text-cream font-black text-[22px] mb-1">{community.name}</p>
            <p className="text-muted text-[13px] mb-6">You're already a member.</p>
            <button
              onClick={() => nav("/communities/" + community.id, { replace: true })}
              className="w-full h-12 rounded-full text-white font-bold text-[14.5px]"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              Open community
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, X, Layers, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

export default function Circles() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [circles, setCircles] = useState([])
  const [memberCounts, setMemberCounts] = useState(new Map())
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("circles")
      .select("id, name, created_at")
      .eq("owner_id", myId)
      .order("created_at", { ascending: false })
    const list = rows || []
    setCircles(list)

    if (list.length > 0) {
      const { data: members } = await supabase
        .from("circle_members")
        .select("circle_id")
        .in("circle_id", list.map((c) => c.id))
      const cm = new Map()
      ;(members || []).forEach((m) => cm.set(m.circle_id, (cm.get(m.circle_id) || 0) + 1))
      setMemberCounts(cm)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  async function create() {
    const n = newName.trim()
    if (!n || !myId || busy) return
    setBusy(true); tap("light")
    const { data, error } = await supabase
      .from("circles")
      .insert({ owner_id: myId, name: n.slice(0, 40) })
      .select("id, name, created_at")
      .single()
    setBusy(false)
    if (error) { alert(error.message); return }
    setNewName(""); setCreateOpen(false)
    setCircles((cur) => [data, ...cur])
    nav("/circles/" + data.id)
  }

  async function remove(id) {
    if (!confirm("Delete this audience?")) return
    tap("light")
    setCircles((cur) => cur.filter((c) => c.id !== id))
    await supabase.from("circles").delete().eq("id", id).eq("owner_id", myId)
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
          <h1 className="text-cream font-extrabold text-[16px] flex-1">Audiences</h1>
          <button
            onClick={() => { tap("light"); setCreateOpen(true) }}
            className="h-9 px-3 rounded-full text-white font-bold text-[12.5px] inline-flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Plus size={14} /> New
          </button>
        </div>

        <p className="px-4 py-3 text-muted text-[12.5px] leading-relaxed">
          Group people into Circles so you can share with the right crowd every time.
        </p>

        {loading ? (
          <div className="px-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : circles.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[42px] mb-2">🔵</p>
            <p className="text-cream font-bold text-[14.5px] mb-1">No audiences yet</p>
            <p className="text-muted text-[12.5px]">Create your first audience to get started.</p>
          </div>
        ) : (
          <div className="px-4 flex flex-col gap-1.5">
            {circles.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8">
                <button
                  onClick={() => { tap("light"); nav("/circles/" + c.id) }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)" }}>
                    <Layers size={18} className="text-white" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[14px] truncate">{c.name}</p>
                    <p className="text-muted text-[11.5px]">
                      {memberCounts.get(c.id) || 0} {memberCounts.get(c.id) === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-subtle shrink-0" />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="w-8 h-8 rounded-full grid place-items-center text-red-400/70 shrink-0"
                  aria-label="Delete circle"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />
            <h3 className="text-cream font-extrabold text-[16px]">New audience</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 40))}
              placeholder="Circle name (e.g. Work friends, Family)"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") create() }}
              className="h-11 rounded-xl bg-white/[0.05] border border-white/8 px-4 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={create}
              disabled={!newName.trim() || busy}
              className="h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              {busy ? "Creating…" : "Create audience"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

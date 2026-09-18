import { useEffect, useState } from "react"
import { Hammer, RefreshCw } from "lucide-react"
import BrandGlow from "./BrandGlow"
import { supabase } from "../lib/supabase"

export default function MaintenanceScreen({ message }) {
  const [msg, setMsg] = useState(message || "We're making Nakubonye better. Back very soon.")
  const [checking, setChecking] = useState(false)

  async function recheck() {
    setChecking(true)
    await new Promise((r) => setTimeout(r, 600))
    window.location.reload()
  }

  return (
    <div className="mobile-shell flex flex-col relative overflow-hidden isolate">
      <BrandGlow />
      <main className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        <div
          className="w-[88px] h-[88px] rounded-[26px] grid place-items-center mb-8 relative"
          style={{
            background: "linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)",
            boxShadow: "0 16px 48px rgba(168,85,247,0.55), 0 0 60px rgba(236,72,153,0.35)",
          }}
        >
          <Hammer size={40} className="text-white" strokeWidth={2.2} />
        </div>

        <p className="text-purple-300/80 text-[11.5px] font-bold tracking-[0.32em] mb-3">
          WE'RE BUILDING
        </p>

        <h1 className="text-white text-[34px] leading-[1.05] font-black tracking-tight mb-4">
          Nakubonye
        </h1>

        <p className="text-purple-100/75 text-[15.5px] leading-[1.55] max-w-[320px] mb-8">
          {msg}
        </p>

        <div className="flex items-center gap-2 text-purple-200/60 text-[13px] mb-10">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span>Updates in progress</span>
        </div>

        <button
          onClick={recheck}
          disabled={checking}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white/[0.06] border border-white/12 text-white/85 font-semibold text-[14px] disabled:opacity-50"
        >
          <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
          {checking ? "Checking…" : "Check again"}
        </button>
      </main>

      <footer className="px-7 pb-8 pt-2 text-center">
        <p className="text-white/40 text-[11px] leading-relaxed">
          Thanks for your patience. We'll be back shortly.
        </p>
      </footer>
    </div>
  )
}

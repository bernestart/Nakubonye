import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { tap } from "../lib/haptic"
import BrandGlow from "./BrandGlow"

export default function SettingsScreen({ title, subtitle, rows = [] }) {
  const nav = useNavigate()
  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <header className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-extrabold text-[16px]">{title}</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        {subtitle && (
          <p className="text-muted text-[12.5px] px-4 py-3 leading-relaxed">{subtitle}</p>
        )}
        <div className="flex flex-col">
          {rows.map((r, i) => (
            <button
              key={i}
              onClick={() => { tap("light"); r.to && nav(r.to) }}
              disabled={r.disabled || r.soon}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03] disabled:opacity-40"
            >
              <span className="shrink-0 text-cream">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-cream text-[15px] font-medium">{r.label}</p>
                {r.sub && <p className="text-muted text-[12px] mt-0.5 truncate">{r.sub}</p>}
              </div>
              {r.value && <span className="text-muted text-[13px] shrink-0 max-w-[120px] truncate">{r.value}</span>}
              {r.soon && <span className="text-subtle text-[11px] shrink-0">Soon</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

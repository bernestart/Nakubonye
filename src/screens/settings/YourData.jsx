import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Download, Target, MapPin, Link2, PauseCircle, Trash2 } from "lucide-react"
import { tap } from "../../lib/haptic"
import { useAuth } from "../../lib/auth"
import { useSettings } from "../../lib/settings.jsx"
import BrandGlow from "../../components/BrandGlow"
import { buildUserExport, downloadJson } from "../../lib/dataExport"

export default function YourData() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const { settings, update, loading } = useSettings()
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState("")

  async function exportData() {
    if (exporting || !myId) return
    setExporting(true); setExportMsg(""); tap("light")
    try {
      const data = await buildUserExport(myId)
      downloadJson(data, "nakubonye-export-" + new Date().toISOString().slice(0,10) + ".json")
      setExportMsg("Export downloaded")
    } catch (e) {
      setExportMsg("Export failed: " + (e.message || String(e)))
    }
    setExporting(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <header className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-extrabold text-[16px]">Your data</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <p className="text-muted text-[12.5px] px-4 py-3 leading-relaxed">
          Export a copy of your data, control personalization, and manage your account.
        </p>

        <div className="flex flex-col">
          <button
            onClick={exportData}
            disabled={exporting}
            className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03] disabled:opacity-50"
          >
            <Download size={18} className="text-cream shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-cream text-[15px] font-medium">
                {exporting ? "Preparing export…" : "Download your data"}
              </p>
              <p className="text-muted text-[12px] mt-0.5">
                Get a JSON copy of your profile, posts, reels, stories, settings, and activity
              </p>
            </div>
          </button>

          <ToggleCU
            icon={<Target size={18} />}
            label="Personalized ads"
            sub="Use my activity to personalize content"
            value={settings.personalized_ads !== false}
            onChange={(v) => update({ personalized_ads: v })}
          />

          <ToggleCU
            icon={<MapPin size={18} />}
            label="Location services"
            sub="Allow Nakubonye to use my location"
            value={settings.location_services !== false}
            onChange={(v) => update({ location_services: v })}
          />

          <div className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 opacity-40">
            <Link2 size={18} className="text-cream shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-cream text-[15px] font-medium">Off-platform activity</p>
            </div>
            <span className="text-subtle text-[11px]">Soon</span>
          </div>

          <button
            onClick={() => { tap("light"); nav("/settings/security") }}
            className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
          >
            <PauseCircle size={18} className="text-cream shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-cream text-[15px] font-medium">Deactivate account</p>
              <p className="text-muted text-[12px] mt-0.5">Temporarily hide your profile — reversible</p>
            </div>
          </button>

          <button
            onClick={() => { tap("light"); nav("/settings/security") }}
            className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-danger/20 text-left active:bg-red-500/[0.06]"
          >
            <Trash2 size={18} className="text-red-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-cream text-[15px] font-medium text-red-300">Delete account</p>
              <p className="text-muted text-[12px] mt-0.5">Permanently remove everything — cannot be undone</p>
            </div>
          </button>
        </div>

        {exportMsg && (
          <p className="text-emerald-300 text-[12.5px] text-center px-4 py-4">{exportMsg}</p>
        )}
      </div>
    </div>
  )
}

function ToggleCU({ icon, label, sub, value, onChange }) {
  return (
    <button
      onClick={() => { tap("light"); onChange(!value) }}
      className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
    >
      <span className="shrink-0 text-cream">{icon}</span>
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-cream text-[15px] font-medium">{label}</p>
        {sub && <p className="text-muted text-[12px] mt-0.5 truncate">{sub}</p>}
      </div>
      <span
        className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
        style={{ background: value ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.12)" }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: value ? "calc(100% - 22px)" : 2 }} />
      </span>
    </button>
  )
}

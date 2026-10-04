import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Trash2, Wifi, WifiOff, Play } from "lucide-react"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"
import { listCached, clearCache, getCacheStats, cleanupOldReels } from "../lib/reelCache"

function fmtBytes(n) {
  if (!n || n < 1024) return (n || 0) + " B"
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB"
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB"
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB"
}

export default function OfflineReels() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ count: 0, totalBytes: 0 })
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  async function load() {
    setLoading(true)
    const rows = await listCached()
    const urls = rows.map((r) => ({
      reelId: r.reelId,
      video_url: r.video_url,
      thumbnail_url: r.thumbnail_url,
      caption: r.caption,
      size_bytes: r.size_bytes || 0,
      cached_at: r.cached_at,
      blobUrl: r.blob ? URL.createObjectURL(r.blob) : null,
    }))
    setItems(urls)
    const s = await getCacheStats()
    setStats(s)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  // Clean blob URLs on unmount
  useEffect(() => {
    return () => { items.forEach((i) => { if (i.blobUrl) URL.revokeObjectURL(i.blobUrl) }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleClear() {
    if (!confirm("Clear all cached reels?")) return
    tap("light")
    await clearCache(myId)
    load()
  }

  async function handleCleanup() {
    tap("light")
    const n = await cleanupOldReels(7, myId)
    alert(`Removed ${n} old reel${n === 1 ? "" : "s"}`)
    load()
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
          <h1 className="text-cream font-extrabold text-[16px] flex-1">Offline reels</h1>
          <span
            className="h-7 px-2.5 rounded-full text-[11px] font-black tracking-wide flex items-center gap-1.5"
            style={{
              background: isOnline ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
              border: isOnline ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(239,68,68,0.4)",
              color: isOnline ? "#6EE7B7" : "#FCA5A5",
            }}
          >
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>

        <div className="px-4 py-3">
          <p className="text-muted text-[12.5px] leading-relaxed mb-3">
            Reels you watch are cached automatically so you can keep scrolling without data — even when the network drops.
          </p>

          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3.5 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted text-[12px]">Cached reels</span>
              <span className="text-cream font-bold text-[14px]">{stats.count} / 10</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted text-[12px]">Storage used</span>
              <span className="text-cream font-bold text-[14px]">{fmtBytes(stats.totalBytes)}</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                style={{ width: Math.min(100, (stats.totalBytes / (100 * 1024 * 1024)) * 100) + "%" }}
              />
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleCleanup}
              className="flex-1 h-10 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px]"
            >
              Clean up old
            </button>
            <button
              onClick={handleClear}
              className="flex-1 h-10 rounded-full bg-red-500/12 border border-red-500/30 text-red-300 font-bold text-[12.5px] inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} /> Clear all
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-4 grid grid-cols-3 gap-1">
            {[0,1,2,3,4,5].map((i) => <div key={i} className="aspect-[9/16] rounded-lg bg-white/[0.03] shimmer" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[42px] mb-2">📴</p>
            <p className="text-cream font-bold text-[14.5px] mb-1">Nothing cached yet</p>
            <p className="text-muted text-[12.5px]">Start watching reels — they'll cache automatically.</p>
          </div>
        ) : (
          <div className="px-1 grid grid-cols-3 gap-1">
            {items.map((it) => (
              <button
                key={it.reelId}
                onClick={() => { tap("light"); nav("/reels") }}
                className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black"
              >
                {it.blobUrl ? (
                  <video src={it.blobUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                ) : it.thumbnail_url ? (
                  <img src={it.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : null}
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold flex items-center gap-1">
                  <Play size={8} fill="white" /> {fmtBytes(it.size_bytes)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

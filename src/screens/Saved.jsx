import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"
import ReelViewer from "../components/ReelViewer"

const TABS = [
  { id: "posts",    label: "Posts" },
  { id: "reels",    label: "Reels" },
  { id: "listings", label: "Listings" },
]

export default function Saved() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [tab, setTab] = useState("posts")
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [reels, setReels] = useState([])
  const [listings, setListings] = useState([])
  const [playingReel, setPlayingReel] = useState(null)

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [postSaves, reelSaves, listingSaves] = await Promise.all([
        supabase.from("post_saves").select("post_id, post_type, created_at").eq("user_id", myId).order("created_at", { ascending: false }).limit(100),
        supabase.from("reel_saves").select("reel_id, created_at").eq("user_id", myId).order("created_at", { ascending: false }).limit(100),
        supabase.from("listing_saves").select("listing_id, created_at").eq("user_id", myId).order("created_at", { ascending: false }).limit(100),
      ])

      // Posts — split by type, fetch respective rows
      const personalIds = (postSaves.data || []).filter((r) => r.post_type === "personal").map((r) => r.post_id)
      const communityIds = (postSaves.data || []).filter((r) => r.post_type === "community").map((r) => r.post_id)
      let postRows = []
      if (personalIds.length > 0) {
        const { data } = await supabase.from("user_posts")
          .select("id, user_id, content, image_path, created_at")
          .in("id", personalIds)
        postRows.push(...(data || []).map((r) => ({ ...r, _source: "personal", author_id: r.user_id })))
      }
      if (communityIds.length > 0) {
        const { data } = await supabase.from("community_posts")
          .select("id, author_id, content, image_path, created_at")
          .in("id", communityIds)
        postRows.push(...(data || []).map((r) => ({ ...r, _source: "community" })))
      }

      // Reels
      const reelIds = (reelSaves.data || []).map((r) => r.reel_id)
      let reelRows = []
      if (reelIds.length > 0) {
        const { data } = await supabase.from("reels")
          .select("id, user_id, video_url, thumbnail_url, caption, created_at, allow_comments, clips, trim_start, trim_end, mirrored, filter_id, text_overlays, sticker_overlays, view_count, location")
          .in("id", reelIds).eq("is_active", true)
        reelRows = data || []
      }

      // Listings
      const listingIds = (listingSaves.data || []).map((r) => r.listing_id)
      let listingRows = []
      if (listingIds.length > 0) {
        const { data } = await supabase.from("listings")
          .select("id, title, price, currency, image_paths, location, status, created_at")
          .in("id", listingIds)
        listingRows = data || []
      }

      // Fetch author names/photos for posts
      const authorIds = [...new Set(postRows.map((p) => p.author_id).filter(Boolean))]
      let profMap = new Map(), photoMap = new Map()
      if (authorIds.length > 0) {
        const [profs, ph] = await Promise.all([
          supabase.from("profiles").select("id, display_name, username").in("id", authorIds),
          supabase.from("profile_photos")
            .select("user_id, storage_path, is_primary, display_order")
            .in("user_id", authorIds)
            .order("is_primary", { ascending: false })
            .order("display_order", { ascending: true }),
        ])
        ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
        ;(ph.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
      }

      if (cancelled) return
      setPosts(postRows.map((p) => ({
        ...p,
        _prof: profMap.get(p.author_id),
        _photo: photoMap.get(p.author_id) ? publicPhotoUrl(photoMap.get(p.author_id)) : null,
      })))
      setReels(reelRows)
      setListings(listingRows)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [myId])

  const list = tab === "posts" ? posts : tab === "reels" ? reels : listings

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
          <h1 className="text-cream font-extrabold text-[16px]">Saved</h1>
        </div>

        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { tap("light"); setTab(t.id) }}
              className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-bold transition-colors"
              style={{
                background: tab === t.id ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.05)",
                border: tab === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: tab === t.id ? "#fff" : "#aaa",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-cream font-bold text-[15px] mb-1">Nothing saved yet</p>
            <p className="text-muted text-[13px]">Tap the … menu on any {tab.slice(0, -1)} to save it here.</p>
          </div>
        ) : tab === "posts" ? (
          <div className="px-3 flex flex-col gap-2">
            {posts.map((p) => (
              <button
                key={p._source + "-" + p.id}
                onClick={() => { tap("light"); nav("/post/" + p._source + "/" + p.id) }}
                className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden text-left active:opacity-90"
              >
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black text-[12px]">
                    {p._photo ? (
                      <img src={p._photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (p._prof?.display_name || p._prof?.username || "?")[0].toUpperCase()
                    )}
                  </span>
                  <p className="text-cream text-[13px] font-bold truncate">
                    {p._prof?.display_name || p._prof?.username || "User"}
                  </p>
                </div>
                {p.image_path && (
                  <img
                    src={supabase.storage.from("community-media").getPublicUrl(p.image_path).data?.publicUrl}
                    alt=""
                    className="w-full max-h-[240px] object-cover"
                  />
                )}
                {p.content && (
                  <p className="px-3 py-2 text-cream text-[13px] leading-snug line-clamp-2">{p.content}</p>
                )}
              </button>
            ))}
          </div>
        ) : tab === "reels" ? (
          <div className="grid grid-cols-3 gap-1 px-1">
            {reels.map((r) => (
              <button
                key={r.id}
                onClick={() => { tap("light"); setPlayingReel(r) }}
                className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black"
              >
                {r.thumbnail_url ? (
                  <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={r.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                )}
                <span className="absolute bottom-1 left-1 text-white text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">▶</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 grid grid-cols-2 gap-2">
            {listings.map((l) => {
              const img = l.image_paths?.[0]
                ? supabase.storage.from("listing-media").getPublicUrl(l.image_paths[0]).data?.publicUrl
                : null
              return (
                <button
                  key={l.id}
                  onClick={() => { tap("light"); nav("/marketplace/" + l.id) }}
                  className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden text-left active:opacity-90"
                >
                  <div className="aspect-square bg-black">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="p-2.5">
                    <p className="text-cream font-bold text-[13px] truncate">{l.title}</p>
                    <p className="text-cream font-black text-[13px]">
                      {l.price ? `${l.price.toLocaleString()} ${l.currency || "BIF"}` : "Free"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {playingReel && (
        <ReelViewer
          reel={playingReel}
          currentUserId={myId}
          onClose={() => setPlayingReel(null)}
        />
      )}
    </div>
  )
}

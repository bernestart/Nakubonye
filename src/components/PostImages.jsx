import { useState } from "react"
import { supabase } from "../lib/supabase"
import ImageLightbox from "./chat/ImageLightbox"
import { tap } from "../lib/haptic"

/**
 * Renders 1-10 images in Facebook-style grid:
 * 1 → full width
 * 2 → side-by-side 50/50
 * 3 → large-left + two-stacked-right
 * 4 → 2x2 grid
 * 5+ → 2x2 grid with +N overlay on last tile
 */
export default function PostImages({ paths = [], bucket = "community-media", onDoubleTap }) {
  const [lightbox, setLightbox] = useState(null)
  const [lastTapRef, setLastTap] = useState({ id: null, time: 0 })

  if (!paths || paths.length === 0) return null

  const urls = paths.map((p) =>
    supabase.storage.from(bucket).getPublicUrl(p).data?.publicUrl
  ).filter(Boolean)

  if (urls.length === 0) return null

  function handleTap(idx, e) {
    const now = Date.now()
    const last = lastTapRef
    const isDouble = last.id === "idx" + idx && (now - last.time) < 300
    if (isDouble && onDoubleTap) {
      setLastTap({ id: null, time: 0 })
      onDoubleTap()
      return
    }
    setLastTap({ id: "idx" + idx, time: now })
    setLightbox(idx)
  }

  // 1 image — full width
  if (urls.length === 1) {
    return (
      <>
        <img
          src={urls[0]}
          alt=""
          onClick={(e) => handleTap(0, e)}
          className="w-full object-cover cursor-pointer"
          style={{ maxHeight: "72vh", display: "block" }}
          loading="lazy"
        />
        {lightbox !== null && (
          <ImageLightbox url={urls[lightbox]} onClose={() => setLightbox(null)} />
        )}
      </>
    )
  }

  // 2 images — 50/50
  if (urls.length === 2) {
    return (
      <>
        <div className="grid grid-cols-2 gap-[2px]">
          {urls.map((u, i) => (
            <button
              key={i}
              onClick={(e) => handleTap(i, e)}
              className="aspect-square overflow-hidden bg-black/40 active:opacity-90"
            >
              <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
        {lightbox !== null && (
          <ImageLightbox url={urls[lightbox]} onClose={() => setLightbox(null)} />
        )}
      </>
    )
  }

  // 3 images — big-left + two-stacked-right
  if (urls.length === 3) {
    return (
      <>
        <div className="grid grid-cols-3 gap-[2px]" style={{ aspectRatio: "1 / 1" }}>
          <button
            onClick={(e) => handleTap(0, e)}
            className="col-span-2 row-span-2 overflow-hidden bg-black/40 active:opacity-90"
          >
            <img src={urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
          </button>
          <button
            onClick={(e) => handleTap(1, e)}
            className="col-span-1 row-span-1 overflow-hidden bg-black/40 active:opacity-90"
          >
            <img src={urls[1]} alt="" className="w-full h-full object-cover" loading="lazy" />
          </button>
          <button
            onClick={(e) => handleTap(2, e)}
            className="col-span-1 row-span-1 overflow-hidden bg-black/40 active:opacity-90"
          >
            <img src={urls[2]} alt="" className="w-full h-full object-cover" loading="lazy" />
          </button>
        </div>
        {lightbox !== null && (
          <ImageLightbox url={urls[lightbox]} onClose={() => setLightbox(null)} />
        )}
      </>
    )
  }

  // 4+ images — 2x2 grid, +N overlay on last
  const extra = urls.length - 4
  const shown = urls.slice(0, 4)
  return (
    <>
      <div className="grid grid-cols-2 gap-[2px]">
        {shown.map((u, i) => {
          const isLast = i === 3 && extra > 0
          return (
            <button
              key={i}
              onClick={(e) => handleTap(i, e)}
              className="aspect-square overflow-hidden bg-black/40 relative active:opacity-90"
            >
              <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
              {isLast && (
                <span
                  className="absolute inset-0 grid place-items-center bg-black/55 text-white text-[28px] font-black"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}
                >
                  +{extra}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {lightbox !== null && (
        <ImageLightbox url={urls[lightbox]} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}

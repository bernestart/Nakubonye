import { useEffect, useRef, useState } from "react"
import { X, ImagePlus, RefreshCw, Send, Pencil } from "lucide-react"
import { supabase } from "../lib/supabase"
import { deleteDraftsByKind } from "../lib/drafts"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import StoryEditor from "./StoryEditor"
import { createPortal } from "react-dom"

const TEXT_BGS = [
  ["#EC4899", "#A855F7"],
  ["#3B82F6", "#06B6D4"],
  ["#F59E0B", "#EC4899"],
  ["#10B981", "#3B82F6"],
  ["#8B5CF6", "#EC4899"],
  ["#EF4444", "#F59E0B"],
  ["#1E1B4B", "#4C1D95"],
  ["#0F172A", "#334155"],
]

async function notifyMentions(caption, storyId, authorId) {
  if (!caption || !storyId || !authorId) return
  // Extract @username tokens
  const matches = [...caption.matchAll(/@([a-z0-9_]{3,20})/gi)].map((m) => m[1].toLowerCase())
  const unique = [...new Set(matches)]
  if (unique.length === 0) return
  try {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username")
      .in("username", unique)
    if (!profs || profs.length === 0) return
    const rows = profs
      .filter((p) => p.id !== authorId)
      .map((p) => ({
        user_id: p.id,
        actor_id: authorId,
        type: "mention",
        ref_id: String(storyId),
        ref_type: "story",
        body: "mentioned you in a story",
      }))
    if (rows.length > 0) {
      await supabase.from("notifications").insert(rows)
    }
  } catch (e) { console.warn("mention notify failed", e) }
}

export default function StoryComposer({ onClose, onDone, onOptimistic, onResolve, onFail, onRetryStart }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [editedBlob, setEditedBlob] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [caption, setCaption] = useState("")
  const [mode, setMode] = useState("media")
  const [textContent, setTextContent] = useState("")
  const [textBg, setTextBg] = useState(0)
  const [audienceMode, setAudienceMode] = useState("everyone")
  const storyDraftTimerRef = useRef(null)
  useEffect(() => {
    if (!myId) return
    if (mode === "media" && !preview && !caption.trim()) return
    if (storyDraftTimerRef.current) clearTimeout(storyDraftTimerRef.current)
    storyDraftTimerRef.current = setTimeout(async () => {
      try {
        const payload = mode === "text"
          ? { mode: "text", text_content: textContent, text_bg: textBg }
          : { mode: "media", caption }
        const { data: existing } = await supabase
          .from("drafts").select("id")
          .eq("user_id", myId).eq("kind", "story")
          .maybeSingle()
        const row = {
          user_id: myId,
          kind: "story",
          payload,
          preview_url: preview || null,
          updated_at: new Date().toISOString(),
        }
        if (existing?.id) await supabase.from("drafts").update(row).eq("id", existing.id)
        else await supabase.from("drafts").insert(row)
      } catch (e) { console.warn("story autosave failed", e) }
    }, 1200)
    return () => { if (storyDraftTimerRef.current) clearTimeout(storyDraftTimerRef.current) }
  }, [myId, caption, textContent, textBg, mode, preview])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      setError("Only images and videos allowed")
      return
    }
    if (f.size > 25 * 1024 * 1024) { setError("Max 25 MB"); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setEditedBlob(null)
    setError("")
    if (f.type.startsWith("image/")) setEditorOpen(true)
  }

  async function runPublish(tempId, useFile, ext, contentType, mediaType, captionSnapshot, audienceSnapshot) {
    try {
      const path = "stories/" + myId + "/" + crypto.randomUUID() + "." + ext
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, useFile, { upsert: false, contentType })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
      const { data: inserted, error: insErr } = await supabase.from("stories").insert({
        user_id: myId,
        media_url: pub?.publicUrl,
        media_type: mediaType,
        caption: captionSnapshot || null,
        audience: audienceSnapshot || 'everyone',
      }).select("id").single()
      if (insErr) throw new Error(insErr.message)
      onResolve?.(tempId)
      if (inserted?.id && captionSnapshot) {
        notifyMentions(captionSnapshot, inserted.id, myId)
      }
    } catch (e) {
      onFail?.(tempId, e.message || String(e))
    }
  }

  async function submitTextStory() {
    const body = textContent.trim()
    if (!body || !myId || busy) return
    setBusy(true); setError("")
    try {
      // Render to 1080x1920 canvas
      const canvas = document.createElement("canvas")
      canvas.width = 1080
      canvas.height = 1920
      const ctx = canvas.getContext("2d")
      const [c1, c2] = TEXT_BGS[textBg] || TEXT_BGS[0]
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920)
      grad.addColorStop(0, c1)
      grad.addColorStop(1, c2)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1080, 1920)

      // Text — centered, wrapped
      const maxWidth = 900
      const fontSize = 88
      ctx.font = "900 " + fontSize + "px -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.shadowColor = "rgba(0,0,0,0.35)"
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 6

      const words = body.split(/\s+/)
      const lines = []
      let current = ""
      for (const w of words) {
        const test = current ? current + " " + w : w
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current)
          current = w
        } else {
          current = test
        }
      }
      if (current) lines.push(current)

      const lineHeight = fontSize * 1.22
      const totalH = lines.length * lineHeight
      const startY = 960 - totalH / 2 + lineHeight / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 540, startY + i * lineHeight)
      })

      const blob = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92))
      if (!blob) throw new Error("Canvas export failed")

      const tempId = "pending-story-" + crypto.randomUUID()
      const snapshot = body
      onOptimistic?.(tempId, URL.createObjectURL(blob), snapshot, audienceMode)
      setBusy(false)
      onClose?.()
      runPublish(tempId, blob, "jpg", "image/jpeg", "image", snapshot, audienceMode)
    } catch (e) {
      setBusy(false)
      setError(e.message || String(e))
    }
  }

  function publishNow(blob, ext, contentType, mediaType, captionSnapshot, audienceSnapshot) {
    if (!myId || !blob) return
    const tempId = "pending-story-" + crypto.randomUUID()
    const previewUrl = URL.createObjectURL(blob)
    const retry = () => {
      onRetryStart?.(tempId)
      runPublish(tempId, blob, ext, contentType, mediaType, captionSnapshot, audienceSnapshot)
    }
    onOptimistic?.({
      _tempId: tempId,
      user_id: myId,
      display_name: "You",
      media_url: previewUrl,
      media_type: mediaType,
      caption: captionSnapshot || null,
      _status: "uploading",
      _retry: retry,
      created_at: new Date().toISOString(),
    })
    onClose?.()
    runPublish(tempId, blob, ext, contentType, mediaType, captionSnapshot, audienceSnapshot)
  }

  async function submit() {
    if (!file || !myId) return
    setBusy(true); setError("")
    const useFile = editedBlob || file
    const ext = editedBlob ? "jpg" : (file.name.split(".").pop()?.toLowerCase() || "jpg")
    const contentType = editedBlob ? "image/jpeg" : file.type
    const mediaType = !editedBlob && file.type.startsWith("video/") ? "video" : "image"
    const tempId = "pending-story-" + crypto.randomUUID()
    const captionSnapshot = caption.trim()
    const audienceSnapshot = audienceMode
    const retry = () => {
      onRetryStart?.(tempId)
      runPublish(tempId, useFile, ext, contentType, mediaType, captionSnapshot, audienceSnapshot)
    }
    onOptimistic?.({
      _tempId: tempId,
      user_id: myId,
      display_name: "You",
      media_url: preview,
      media_type: mediaType,
      caption: captionSnapshot || null,
      _status: "uploading",
      _retry: retry,
      created_at: new Date().toISOString(),
    })
    onClose?.()
    await runPublish(tempId, useFile, ext, contentType, mediaType, captionSnapshot, audienceSnapshot)
  }

  useEffect(() => {
    const el = fileRef.current
    if (!el) return
    const onCancel = () => onClose?.()
    el.addEventListener("cancel", onCancel)
    const t = setTimeout(() => el.click(), 60)
    return () => {
      clearTimeout(t)
      el.removeEventListener("cancel", onCancel)
    }
  }, [])

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  if (mode === "text") {
    const [c1, c2] = TEXT_BGS[textBg] || TEXT_BGS[0]
    return createPortal(
      <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
        <div className="flex items-center justify-between p-4 shrink-0" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
          <button
            onClick={() => { setMode("media"); setTextContent("") }}
            className="h-10 px-4 rounded-full bg-black/25 text-white font-bold text-[13px]"
          >← Media</button>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full grid place-items-center bg-black/25 text-white"
            aria-label="Close"
          ><X size={20} /></button>
        </div>

        <div className="flex-1 grid place-items-center px-6 overflow-hidden">
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value.slice(0, 200))}
            placeholder="Type something…"
            autoFocus
            className="w-full max-w-[420px] bg-transparent text-white text-center font-black text-[28px] leading-tight placeholder:text-white/50 focus:outline-none resize-none"
            style={{ minHeight: 200 }}
          />
        </div>

        <div className="px-4 flex gap-2 overflow-x-auto mb-3" style={{ scrollbarWidth: "none" }}>
          {TEXT_BGS.map((pair, i) => (
            <button
              key={i}
              onClick={() => setTextBg(i)}
              className="shrink-0 w-11 h-11 rounded-full border-2 transition-transform active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`,
                borderColor: textBg === i ? "#fff" : "transparent",
                boxShadow: textBg === i ? "0 0 0 2px rgba(0,0,0,0.3)" : "none",
              }}
              aria-label={"Background " + (i + 1)}
            />
          ))}
        </div>

        {error && <p className="text-red-200 text-[12.5px] text-center px-4 pb-2">{error}</p>}

        <div className="p-4 pt-0 shrink-0" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={submitTextStory}
            disabled={busy || !textContent.trim()}
            className="w-full h-12 rounded-full bg-white text-black font-black text-[15px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Send size={16} /> {busy ? "Posting…" : "Share to story"}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  if (editorOpen && preview && file?.type.startsWith("image/")) {
    return (
      <StoryEditor
        src={preview}
        onCancel={() => { setEditorOpen(false); setPreview(""); setFile(null); setEditedBlob(null) }}
        onSave={(blob, meta) => {
          publishNow(blob, "jpg", "image/jpeg", "image", meta?.caption || "", meta?.audience || "everyone")
        }}
      />
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black">
      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pick} />

      {!preview && null}

      {preview && (
        <div className="absolute inset-0 flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-3 left-3 w-10 h-10 rounded-full grid place-items-center bg-black/50 text-white z-20"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <div className="flex-1 grid place-items-center bg-black overflow-hidden">
            {file?.type.startsWith("video/") ? (
              <video src={preview} controls className="max-w-full max-h-full object-contain" />
            ) : (
              <img src={preview} alt="" className="max-w-full max-h-full object-contain" />
            )}
          </div>

          <div className="p-3 flex flex-col gap-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} /> Change
              </button>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { tap("light"); setAudienceMode("everyone") }}
                className="flex-1 h-9 rounded-full text-[12.5px] font-bold"
                style={{
                  background: audienceMode === "everyone" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                  border: audienceMode === "everyone" ? "1px solid rgba(255,255,255,0.30)" : "1px solid rgba(255,255,255,0.08)",
                  color: audienceMode === "everyone" ? "#fff" : "#aaa",
                }}
              >
                🌍 Everyone
              </button>
              <button
                onClick={() => { tap("light"); setAudienceMode("inner_circle") }}
                className="flex-1 h-9 rounded-full text-[12.5px] font-bold"
                style={{
                  background: audienceMode === "inner_circle" ? "linear-gradient(135deg, rgba(16,185,129,0.30) 0%, rgba(5,150,105,0.30) 100%)" : "rgba(255,255,255,0.05)",
                  border: audienceMode === "inner_circle" ? "1px solid rgba(16,185,129,0.55)" : "1px solid rgba(255,255,255,0.08)",
                  color: audienceMode === "inner_circle" ? "#6EE7B7" : "#aaa",
                }}
              >
                💫 Inner Circle
              </button>
              <button
                onClick={() => { tap("light"); setAudienceMode("matches") }}
                className="flex-1 h-9 rounded-full text-[12.5px] font-bold"
                style={{
                  background: audienceMode === "matches" ? "linear-gradient(135deg, rgba(236,72,153,0.30) 0%, rgba(168,85,247,0.30) 100%)" : "rgba(255,255,255,0.05)",
                  border: audienceMode === "matches" ? "1px solid rgba(236,72,153,0.55)" : "1px solid rgba(255,255,255,0.08)",
                  color: audienceMode === "matches" ? "#F9A8D4" : "#aaa",
                }}
              >
                💜 Matches
              </button>
            </div>
              <button
                onClick={() => { setMode("text"); setPreview(""); setFile(null); setEditedBlob(null) }}
                className="flex-1 h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2"
              >
                <Pencil size={15} /> Text
              </button>
              {file?.type.startsWith("image/") && (
                <button
                  onClick={() => { setEditorOpen(true); setPreview(preview) }}
                  className="flex-1 h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2"
                >
                  <Pencil size={15} /> Edit drawing
                </button>
              )}
            </div>

            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption…"
              className="h-12 rounded-full bg-white/10 px-5 text-white text-[14.5px] placeholder:text-white/50 focus:outline-none focus:bg-white/15"
            />

            {error && <p className="text-red-400 text-[12.5px] text-center">{error}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="h-12 rounded-full text-white font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Send size={16} /> {busy ? "Posting…" : "Share to story"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

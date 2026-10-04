import { useEffect, useRef, useState } from "react"
import { X, ImagePlus, Send, BarChart2, Trash2, Plus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import { autosaveDraft, deleteDraftsByKind } from "../lib/drafts"

const AUDIENCES = [
  { id: "public",  label: "Everyone",  icon: "🌍", desc: "Anyone on Nakubonye can see this" },
  { id: "matches", label: "Matches",   icon: "💜", desc: "Only people you've matched with" },
  { id: "private", label: "Only me",   icon: "🔒", desc: "Just for you" },
]

const MAX_IMAGES = 10

export default function PostComposer({ onClose, onDone, onOptimistic, onResolve, onFail, onRetryStart }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const handedOffRef = useRef(false)
  const [content, setContent] = useState("")
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [audience, setAudience] = useState("public")
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("compose") // compose | preview
  const [resumeDraftId, setResumeDraftId] = useState(null)
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const draftId = url.searchParams.get("draft")
      if (draftId) setResumeDraftId(draftId)
    } catch {}
  }, [])

  useEffect(() => {
    if (!resumeDraftId) return
    ;(async () => {
      const { data } = await supabase.from("drafts").select("payload").eq("id", resumeDraftId).maybeSingle()
      if (data?.payload) {
        setContent(data.payload.content || "")
        setAudience(data.payload.audience || "public")
      }
    })()
  }, [resumeDraftId])


  const schedulerRef = useRef(null)
  if (!schedulerRef.current) schedulerRef.current = autosaveDraft(myId, "post", { content: "", image_paths: [], audience: "public" }, null)

  useEffect(() => {
    if (!myId) return
    // Save whenever content/audience changes
    const payload = { content: content.trim(), image_paths: [], audience }
    // Draft preview — first local preview
    const preview = imagePreviews[0] || null
    schedulerRef.current = autosaveDraft(myId, "post", payload, preview)
    schedulerRef.current()
  }, [content, audience, imagePreviews.length, myId])

  function pickImages(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = MAX_IMAGES - imageFiles.length
    if (remaining <= 0) { setError(`Max ${MAX_IMAGES} images`); return }

    const accepted = []
    const previews = []
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) { setError("Only images allowed"); continue }
      if (f.size > 20 * 1024 * 1024) { setError("Each image must be under 20 MB"); continue }
      accepted.push(f)
      previews.push(URL.createObjectURL(f))
    }
    if (accepted.length === 0) return
    setImageFiles((cur) => [...cur, ...accepted])
    setImagePreviews((cur) => [...cur, ...previews])
    setError("")
    e.target.value = ""
  }

  function addPollOption() {
    if (pollOptions.length >= 4) return
    setPollOptions((cur) => [...cur, ""])
  }
  function setPollOption(idx, val) {
    setPollOptions((cur) => cur.map((o, i) => i === idx ? val.slice(0, 80) : o))
  }
  function removePollOption(idx) {
    if (pollOptions.length <= 2) return
    setPollOptions((cur) => cur.filter((_, i) => i !== idx))
  }

  function removeImage(idx) {
    setImageFiles((cur) => cur.filter((_, i) => i !== idx))
    setImagePreviews((cur) => {
      URL.revokeObjectURL(cur[idx])
      return cur.filter((_, i) => i !== idx)
    })
  }

  function moveImage(idx, dir) {
    const target = idx + dir
    if (target < 0 || target >= imageFiles.length) return
    setImageFiles((cur) => {
      const next = [...cur]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
    setImagePreviews((cur) => {
      const next = [...cur]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function setCover(idx) {
    if (idx === 0) return
    moveImage(idx, -idx) // move to index 0 repeatedly
  }

  async function runPublish(tempId, body, files, previewUrls, audienceSnapshot) {
    try {
      const uploadedPaths = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase()
        const path = `${myId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("community-media")
          .upload(path, f, { upsert: false, contentType: f.type })
        if (upErr) throw new Error(upErr.message)
        uploadedPaths.push(path)
      }
      const { data: insertedRow, error: insErr } = await supabase.from("user_posts").insert({
        user_id: myId,
        content: body || null,
        image_path: uploadedPaths[0] || null,
        image_paths: uploadedPaths,
        audience: audienceSnapshot,
      }).select("id").single()
      if (insErr) throw new Error(insErr.message)

      // Poll — insert after post
      const q = pollQuestion.trim()
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean)
      if (q && opts.length >= 2 && insertedRow?.id) {
        try {
          const { data: pollRow } = await supabase.from("polls").insert({
            post_id: insertedRow?.id,
            post_type: "personal",
            question: q,
            multiple_choice: false,
          }).select("id").single()
          if (pollRow?.id) {
            await supabase.from("poll_options").insert(
              opts.map((label, i) => ({ poll_id: pollRow.id, label, display_order: i }))
            )
          }
        } catch (e) { console.warn("poll insert failed", e) }
      }

      onResolve?.(tempId)
    } catch (e) {
      onFail?.(tempId, e.message || String(e))
    }
  }

  async function submit() {
    const body = content.trim()
    if ((!body && imageFiles.length === 0) || !myId || busy) return
    setBusy(true); setError(""); setProgress(0)

    const tempId = "pending-" + crypto.randomUUID()
    const filesSnapshot = imageFiles.slice()
    const previewsSnapshot = imagePreviews.slice()
    const audienceSnapshot = audience

    handedOffRef.current = true

    const retry = () => {
      onRetryStart?.(tempId)
      runPublish(tempId, body, filesSnapshot, previewsSnapshot, audienceSnapshot)
    }

    onOptimistic?.({
      _tempId: tempId,
      content: body,
      imagePreview: previewsSnapshot[0] || null,
      displayName: "You",
      _status: "uploading",
      _retry: retry,
    })

    onClose?.()
    await runPublish(tempId, body, filesSnapshot, previewsSnapshot, audienceSnapshot)
  }

  useEffect(() => () => {
    if (!handedOffRef.current) imagePreviews.forEach((p) => URL.revokeObjectURL(p))
  }, [])

  const activeAud = AUDIENCES.find((a) => a.id === audience) || AUDIENCES[0]
  const pollReady = pollOpen && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2
  const canPost = (content.trim() || imageFiles.length > 0 || pollReady) && !busy

  if (stage === "preview") {
    return (
      <div className="fixed inset-0 z-[220] bg-[#0B0B14] flex flex-col" style={{ height: "100dvh" }}>
        <header className="flex items-center justify-between px-3 py-3 shrink-0"
                style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <button
            onClick={() => setStage("compose")}
            className="h-10 px-4 rounded-full bg-white/[0.06] text-cream font-semibold text-[13.5px]"
          >
            ← Back
          </button>
          <h2 className="text-cream font-bold text-[16px]">Preview</h2>
          <button
            onClick={submit}
            disabled={busy}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Send size={14} /> {busy ? "Posting…" : "Post"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
            {imagePreviews.length} {imagePreviews.length === 1 ? "image" : "images"}
          </p>

          <div className="flex flex-col gap-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-black border border-white/8">
                <div className="relative">
                  <img src={src} alt="" className="w-full max-h-[50vh] object-contain" />
                  {i === 0 && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                      COVER
                    </span>
                  )}
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white">
                    {i + 1} / {imagePreviews.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 px-2 py-2 border-t border-white/8 bg-white/[0.02]">
                  <button
                    onClick={() => { tap("light"); moveImage(i, -1) }}
                    disabled={i === 0}
                    className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[11.5px] disabled:opacity-30"
                  >
                    ← Move
                  </button>
                  {i !== 0 ? (
                    <button
                      onClick={() => { tap("light"); setCover(i) }}
                      className="h-8 px-3 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold text-[11.5px]"
                    >
                      Set cover
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-purple-300 font-bold">Cover image</span>
                  )}
                  <button
                    onClick={() => { tap("light"); moveImage(i, 1) }}
                    disabled={i === imagePreviews.length - 1}
                    className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[11.5px] disabled:opacity-30"
                  >
                    Move →
                  </button>
                  <button
                    onClick={() => { tap("light"); removeImage(i) }}
                    className="h-8 w-8 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 grid place-items-center"
                    aria-label="Remove"
                  >
                    <X size={14} strokeWidth={2.6} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {busy && progress > 0 && (
            <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-purple-500 transition-all" style={{ width: progress + "%" }} />
            </div>
          )}

          {content.trim() && (
            <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/8">
              <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">Caption</p>
              <p className="text-cream text-[13.5px] whitespace-pre-wrap">{content}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[220] bg-[#0B0B14] flex flex-col" style={{ height: "100dvh" }}>
      <header className="flex items-center justify-between px-3 py-3 shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.06] text-muted"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <h2 className="text-cream font-bold text-[16px]">Create post</h2>
        {stage === "compose" && imageFiles.length > 0 ? (
          <button
            onClick={() => { tap("light"); setStage("preview") }}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px]"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canPost}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Send size={14} /> {busy ? "Posting…" : "Post"}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 1000))}
          placeholder="Share something real…"
          rows={5}
          autoFocus
          className="w-full bg-transparent border-0 text-cream text-[16px] leading-[1.5] placeholder:text-subtle focus:outline-none resize-none mb-3"
        />

        {/* Image grid */}
        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-1 mb-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full grid place-items-center bg-black/70 backdrop-blur-md text-white"
                  aria-label="Remove image"
                >
                  <X size={12} strokeWidth={3} />
                </button>
                {i === 0 && imagePreviews.length > 1 && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9.5px] font-black bg-black/70 text-white">
                    COVER
                  </span>
                )}
              </div>
            ))}
            {imagePreviews.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-white/15 grid place-items-center"
              >
                <ImagePlus size={22} className="text-purple-400" />
              </button>
            )}
          </div>
        )}

        {imagePreviews.length === 0 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 rounded-2xl border-2 border-dashed border-white/15 grid place-items-center mb-3"
          >
            <div className="text-center">
              <ImagePlus size={24} className="text-purple-400 mx-auto mb-1.5" />
              <p className="text-cream text-[13.5px] font-semibold">Add photos</p>
              <p className="text-subtle text-[11.5px]">Up to {MAX_IMAGES} · optional</p>
            </div>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickImages} />

        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {busy && progress > 0 && (
          <div className="mb-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: progress + "%" }} />
          </div>
        )}


        {/* Poll editor */}

        <div className="mb-3">

          {!pollOpen ? (

            <button

              onClick={() => { tap("light"); setPollOpen(true) }}

              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left active:opacity-80"

            >

              <span className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center">

                <BarChart2 size={18} className="text-purple-300" />

              </span>

              <div className="flex-1 min-w-0">

                <p className="text-cream font-bold text-[13.5px]">Add a poll</p>

                <p className="text-muted text-[12px]">Ask a question with up to 4 options</p>

              </div>

            </button>

          ) : (

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-purple-500/25">

              <div className="flex items-center justify-between mb-2">

                <span className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">Poll</span>

                <button onClick={() => { setPollOpen(false); setPollQuestion(""); setPollOptions(["", ""]) }} className="text-muted text-[11.5px] font-semibold" aria-label="Remove poll">

                  <Trash2 size={14} />

                </button>

              </div>

              <input

                value={pollQuestion}

                onChange={(e) => setPollQuestion(e.target.value.slice(0, 120))}

                placeholder="Ask a question…"

                className="w-full h-11 rounded-xl bg-white/[0.05] border border-white/8 px-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-2"

              />

              <div className="flex flex-col gap-1.5">

                {pollOptions.map((opt, i) => (

                  <div key={i} className="flex items-center gap-2">

                    <input

                      value={opt}

                      onChange={(e) => setPollOption(i, e.target.value)}

                      placeholder={"Option " + (i + 1)}

                      className="flex-1 h-10 rounded-xl bg-white/[0.05] border border-white/8 px-3 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500"

                    />

                    {pollOptions.length > 2 && (

                      <button onClick={() => removePollOption(i)} className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.05] border border-white/10 text-red-300" aria-label="Remove option">

                        <X size={14} />

                      </button>

                    )}

                  </div>

                ))}

              </div>

              {pollOptions.length < 4 && (

                <button

                  onClick={addPollOption}

                  className="mt-2 h-9 px-3 rounded-full bg-white/[0.05] border border-white/10 text-cream text-[12.5px] font-bold inline-flex items-center gap-1.5"

                >

                  <Plus size={13} /> Add option

                </button>

              )}

            </div>

          )}

        </div>



        {/* Audience pill */}
        <button
          onClick={() => setAudienceSheetOpen(true)}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
        >
          <span className="text-2xl">{activeAud.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-cream font-bold text-[13.5px]">{activeAud.label}</p>
            <p className="text-muted text-[12px] truncate">{activeAud.desc}</p>
          </div>
        </button>
      </div>

      {audienceSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setAudienceSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <h3 className="text-cream font-extrabold text-[16px] mb-2">Who can see this?</h3>
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                onClick={() => { tap("light"); setAudience(a.id); setAudienceSheetOpen(false) }}
                className="flex items-center gap-3 p-4 rounded-2xl text-left"
                style={{
                  background: audience === a.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: audience === a.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[14px]">{a.label}</p>
                  <p className="text-muted text-[12px]">{a.desc}</p>
                </div>
                {audience === a.id && <span className="text-purple-400 text-[16px]">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

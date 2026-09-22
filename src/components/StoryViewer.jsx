import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { X, Send } from "lucide-react"
import { publicPhotoUrl } from "../lib/photo"

export default function StoryViewer({ groups, startIndex, onClose, onViewed }) {
  const [groupIdx, setGroupIdx] = useState(startIndex || 0)
  const [storyIdx, setStoryIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [reply, setReply] = useState("")

  function submitReply() {
    const text = reply.trim()
    if (!text || !group?.user_id) return
    nav("/messages/" + group.user_id, { state: { prefill: text } })
  }

  const group = groups[groupIdx]
  const story = group?.stories?.[storyIdx]

  useEffect(() => {
    if (!story) return
    onViewed?.(group.user_id, story.id)
    setProgress(0)
    const DURATION = story.media_type === "video" ? 15000 : 5000
    const start = Date.now()
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / DURATION)
      setProgress(p)
      if (p >= 1) {
        clearInterval(id)
        advance()
      }
    }, 50)
    return () => clearInterval(id)
  }, [groupIdx, storyIdx])

  function advance() {
    const g = groups[groupIdx]
    if (storyIdx < (g?.stories?.length || 0) - 1) {
      setStoryIdx(storyIdx + 1)
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1)
      setStoryIdx(0)
    } else {
      onClose?.()
    }
  }

  function back() {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1)
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1]
      const lastIdx = Math.max(0, (prevGroup?.stories?.length || 1) - 1)
      setGroupIdx(groupIdx - 1)
      setStoryIdx(lastIdx)
    }
  }

  if (!story) return null

  const photo = publicPhotoUrl(group.avatar_path)

  return (
    <div className="fixed inset-0 z-[220] bg-black grid place-items-center">
      <div className="relative w-full max-w-[480px] h-full">
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white transition-[width] duration-50 ease-linear"
                style={{ width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-3 right-3 flex items-center gap-3 z-20">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/15">
            {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : null}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[14px] truncate">{group.display_name}</p>
            <p className="text-white/60 text-[11px]">
              {new Date(story.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center text-white" aria-label="Close">
            <X size={22} />
          </button>
        </div>

        {/* Media */}
        <div className="absolute inset-0 grid place-items-center bg-black">
          {story.media_type === "video" ? (
            <video
              src={story.media_url}
              autoPlay
              playsInline
              onEnded={advance}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <img src={story.media_url} alt="" className="max-w-full max-h-full object-contain" />
          )}
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-24 left-4 right-4 z-20">
            <p className="text-white text-[15px] font-medium bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3">
              {story.caption}
            </p>
          </div>
        )}

        {/* Reply bar (only for other people's stories) */}
        {group?.user_id !== myId && (
          <div
            className="absolute bottom-4 left-3 right-3 z-30 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, 200))}
              onKeyDown={(e) => { if (e.key === "Enter") submitReply() }}
              placeholder={"Reply to " + (group?.display_name?.split(" ")[0] || "them") + "…"}
              className="flex-1 h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur-md px-4 text-white text-[14px] placeholder:text-white/60 focus:outline-none focus:bg-white/15"
            />
            {reply.trim() && (
              <button
                onClick={submitReply}
                aria-label="Send reply"
                className="w-11 h-11 rounded-full grid place-items-center shrink-0"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              >
                <Send size={18} strokeWidth={2.6} className="text-white" />
              </button>
            )}
          </div>
        )}

        {/* Tap zones */}
        <button
          onClick={back}
          aria-label="Previous"
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
        />
        <button
          onClick={advance}
          aria-label="Next"
          className="absolute right-0 top-0 bottom-0 w-2/3 z-10"
        />
      </div>
    </div>
  )
}

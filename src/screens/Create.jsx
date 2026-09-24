import { useNavigate } from "react-router-dom"
import { ArrowLeft, PenSquare, Video, Camera } from "lucide-react"
import BrandGlow from "../components/BrandGlow"
import { tap } from "../lib/haptic"
import PostComposer from "../components/PostComposer"
import StoryComposer from "../components/StoryComposer"
import { useState } from "react"

export default function Create() {
  const nav = useNavigate()
  const [postComposerOpen, setPostComposerOpen] = useState(false)
  const [storyComposerOpen, setStoryComposerOpen] = useState(false)

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
      paddingTop: "env(safe-area-inset-top)",
    }}>
      <BrandGlow />
      <header className="shrink-0 h-12 px-3 flex items-center gap-2 border-b border-white/8">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Create</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-1">
          Share something real
        </h1>
        <p className="text-muted text-[13.5px] mb-6">
          What would you like to create?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { tap("light"); setStoryComposerOpen(true) }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left active:scale-[0.99] transition-transform"
          >
            <span
              className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
              style={{ background: "linear-gradient(135deg, #A855F7 0%, #EC4899 100%)" }}
            >
              <Camera size={24} color="#fff" />
            </span>
            <div className="flex-1">
              <p className="text-cream font-bold text-[15.5px]">Create a story</p>
              <p className="text-muted text-[12.5px] mt-0.5">Photo or video · disappears in 24h</p>
            </div>
          </button>

          <button
            onClick={() => { tap("light"); setPostComposerOpen(true) }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left active:scale-[0.99] transition-transform"
          >
            <span
              className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
              style={{ background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)" }}
            >
              <PenSquare size={24} color="#fff" />
            </span>
            <div className="flex-1">
              <p className="text-cream font-bold text-[15.5px]">Write a post</p>
              <p className="text-muted text-[12.5px] mt-0.5">Text + photo to your profile or matches</p>
            </div>
          </button>

          <button
            onClick={() => { tap("light"); nav("/reels") }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left active:scale-[0.99] transition-transform"
          >
            <span
              className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Video size={24} color="#fff" />
            </span>
            <div className="flex-1">
              <p className="text-cream font-bold text-[15.5px]">Create a reel</p>
              <p className="text-muted text-[12.5px] mt-0.5">Record or upload a short video</p>
            </div>
          </button>
        </div>
      </div>

      {storyComposerOpen && (
        <StoryComposer
          onClose={() => setStoryComposerOpen(false)}
          onDone={() => { setStoryComposerOpen(false); nav("/feed") }}
        />
      )}

      {postComposerOpen && (
        <PostComposer
          onClose={() => setPostComposerOpen(false)}
          onDone={() => { setPostComposerOpen(false); nav("/feed") }}
        />
      )}
    </div>
  )
}

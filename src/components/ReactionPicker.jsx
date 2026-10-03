const REACTIONS = [
  { id: "like",   emoji: "👍", label: "Like"  },
  { id: "love",   emoji: "❤️", label: "Love"  },
  { id: "haha",   emoji: "😂", label: "Haha"  },
  { id: "wow",    emoji: "😮", label: "Wow"   },
  { id: "sad",    emoji: "😢", label: "Sad"   },
  { id: "angry",  emoji: "😡", label: "Angry" },
]

export { REACTIONS }

export default function ReactionPicker({ onPick, onClose }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-full bg-[#1A1A22] border border-white/12 shadow-2xl"
         style={{ backdropFilter: "blur(12px)" }}>
      {REACTIONS.map((r) => (
        <button
          key={r.id}
          onClick={() => { onPick(r.emoji); onClose?.() }}
          className="w-10 h-10 rounded-full grid place-items-center text-[22px] transition-transform active:scale-[0.85] hover:scale-[1.15]"
          aria-label={r.label}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  )
}

export default function VanishModeOverlay({ onExit }) {
  return (
    <div className="flex-shrink-0 bg-black px-3 py-2 flex items-center justify-between gap-2 border-b border-white/10">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <p className="text-white/85 text-[12px] font-semibold truncate">
          Vanish mode is on · messages will disappear when you leave
        </p>
      </div>
      <button
        onClick={onExit}
        className="text-white/85 text-[11.5px] font-bold px-2.5 h-7 rounded-full bg-white/10 shrink-0"
      >
        Turn off
      </button>
    </div>
  )
}

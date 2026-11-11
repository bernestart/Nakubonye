export default function Waveform({ data = [], progress = 0, mine = false, height = 28, bars = 32 }) {
  const arr = data.length ? data : Array.from({ length: bars }, () => 0.3 + Math.random() * 0.5)
  return (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {arr.slice(0, bars).map((v, i) => {
        const active = i / bars <= progress
        return (
          <span key={i} className="rounded-full" style={{
            width: 3, height: Math.max(4, v * height),
            background: active ? (mine ? "#fff" : "#C084FC") : (mine ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)"),
          }} />
        )
      })}
    </div>
  )
}

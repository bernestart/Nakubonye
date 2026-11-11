import { useState } from "react"
import { X, Play } from "lucide-react"

export default function ReelSoundPage({ track, onClose }) {
  const [reels, setReels] = useState([])
  if (!track) return null

  return (
    <div className="fixed inset-0 z-[500] bg-[#0B0B14] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h2 className="text-cream font-bold text-[16px]">Audio</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 grid place-items-center text-cream"><X size={16} /></button>
      </div>
      
      <div className="p-6 flex flex-col items-center text-center border-b border-white/10 shrink-0">
        <div className="w-24 h-24 rounded-full bg-cover bg-center border-4 border-white/10 shadow-2xl mb-4" style={{ backgroundImage: `url(${track.cover || track.album_art})` }} />
        <h1 className="text-cream font-black text-[20px]">{track.title}</h1>
        <p className="text-muted text-[14px] mb-4">{track.artist}</p>
        <button className="h-10 px-6 rounded-full bg-purple-600 text-white font-bold text-[14px]">Use audio</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-cream font-bold text-[14px] mb-3">Reels using this audio</h3>
        <div className="grid grid-cols-3 gap-1">
          {reels.map(r => (
            <div key={r.id} className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative">
              {r.thumbnail_url && <img src={r.thumbnail_url} className="w-full h-full object-cover opacity-80" />}
              <Play className="absolute top-2 right-2 text-white" size={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

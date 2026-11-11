export default function StoryMusicPlayer({ track, playing }) {
  if (!track) return null
  return (
    <div className="absolute top-14 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full pr-3 pl-1 py-1 z-20">
      <div className={`w-6 h-6 rounded-full bg-cover bg-center border border-white/20 ${playing ? 'animate-[spin_3s_linear_infinite]' : ''}`} style={{ backgroundImage: `url(${track.album_art || track.cover})` }} />
      <div className="min-w-0 pr-2">
        <p className="text-white text-[11px] font-bold truncate">{track.title}</p>
        <p className="text-white/70 text-[9px] truncate">{track.artist}</p>
      </div>
    </div>
  )
}

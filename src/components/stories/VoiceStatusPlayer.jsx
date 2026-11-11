import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

export default function VoiceStatusPlayer({ url, backgroundColor = "#0B0B14", duration = 30, onProgress, onEnded }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, []);

  const togglePlay = () => {
    if (audioRef.current.paused) {
      audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const p = (audioRef.current.currentTime / audioRef.current.duration);
      setProgress(p);
      if (onProgress) onProgress(p * 100);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    if (onEnded) onEnded();
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6" style={{ backgroundColor }}>
      <div className="flex items-center justify-center gap-1.5 w-full max-w-[280px] h-24 mb-8">
        {Array.from({ length: 30 }).map((_, i) => {
          const isPlayed = (i / 30) <= progress;
          return (
            <div key={i} className="w-1.5 rounded-full transition-all duration-150" style={{ height: `${Math.max(12, Math.sin(i * 0.5) * 40 + 50)}%`, backgroundColor: isPlayed ? "#A855F7" : "rgba(255,255,255,0.3)" }} />
          );
        })}
      </div>
      <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 grid place-items-center transition-transform active:scale-95 shadow-xl">
        {playing ? <Pause size={28} className="text-white" fill="white" /> : <Play size={28} className="text-white ml-1" fill="white" />}
      </button>
      <audio ref={audioRef} src={url} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} className="hidden" />
    </div>
  );
}

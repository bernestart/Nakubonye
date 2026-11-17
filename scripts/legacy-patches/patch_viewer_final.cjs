const fs = require('fs');
const file = 'src/components/StoryViewer.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import VoiceStatusPlayer
content = content.replace(
  'import StoryMusicPlayer from "./stories/StoryMusicPlayer"',
  'import StoryMusicPlayer from "./stories/StoryMusicPlayer"\nimport VoiceStatusPlayer from "./stories/VoiceStatusPlayer"'
);

// 2. Replace the progress timer effect to handle Audio correctly
const timerRegex = /useEffect\(\(\) => \{\n    if \(!story\) return\n    onViewed\?\.\(group\.user_id, story\.id\)\n    setProgress\(0\)\n    accumulatedRef\.current = 0\n    startRef\.current = Date\.now\(\)\n    pausedRef\.current = false\n    setPaused\(false\)\n    setReactionOpen\(false\)\n\n    const DURATION = story\.media_type === "video" \? null : IMAGE_DURATION\n    let rafId\n    if \(DURATION != null\) \{\n      const tick = \(\) => \{\n        if \(!pausedRef\.current\) \{\n          const elapsed = accumulatedRef\.current \+ \(Date\.now\(\) - startRef\.current\)\n          const p = Math\.min\(1, elapsed \/ DURATION\)\n          setProgress\(p\)\n          if \(p >= 1\) \{ advance\(\); return \}\n        \}\n        rafId = requestAnimationFrame\(tick\)\n      \}\n      rafId = requestAnimationFrame\(tick\)\n      return \(\) => cancelAnimationFrame\(rafId\)\n    \}\n    \/\/ Video: progress synced by onTimeUpdate\n    return \(\) => cancelAnimationFrame\(rafId\)\n  \}, \[groupIdx, storyIdx, story\?\.id\]\)/;

const newTimerLogic = `useEffect(() => {
    if (!story) return
    onViewed?.(group.user_id, story.id)
    setProgress(0)
    accumulatedRef.current = 0
    startRef.current = Date.now()
    pausedRef.current = false
    setPaused(false)
    setReactionOpen(false)

    const isAudio = story.media_type === "audio/webm"
    const isVideo = story.media_type === "video"
    const DURATION = (isVideo || isAudio) ? null : IMAGE_DURATION
    
    let rafId
    if (DURATION != null) {
      const tick = () => {
        if (!pausedRef.current) {
          const elapsed = accumulatedRef.current + (Date.now() - startRef.current)
          const p = Math.min(1, elapsed / DURATION)
          setProgress(p)
          if (p >= 1) { advance(); return }
        }
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafId)
    }
    // Video & Audio: progress synced by onTimeUpdate
    return () => cancelAnimationFrame(rafId)
  }, [groupIdx, storyIdx, story?.id])`;

if (timerRegex.test(content)) {
  content = content.replace(timerRegex, newTimerLogic);
} else {
  console.error("❌ Timer regex failed. We will do a manual find-replace.");
  process.exit(1);
}

// 3. Replace the Media render block
const mediaRegex = /<div className="absolute inset-0 grid place-items-center bg-black">\s*\{story\.media_type === "video" \? \([\s\S]*?\) : \([\s\S]*?\<img src=\{story\.media_url\} alt="" className="max-w-full max-h-full object-contain" \/>\s*\)\}\s*<\/div>/;

const newMediaBlock = `<div className="absolute inset-0 grid place-items-center bg-black">
        {story.media_type === "audio/webm" ? (
          <VoiceStatusPlayer 
            url={story.media_url} 
            backgroundColor={story.background_color} 
            duration={story.duration}
            onProgress={(p) => { if (!paused) setProgress(p / 100); }}
            onEnded={advance}
          />
        ) : story.media_type === "video" ? (
          <video
            ref={videoRef}
            src={story.media_url}
            autoPlay
            playsInline
            muted={muted}
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.target
              if (v.duration > 0) setProgress(v.currentTime / v.duration)
            }}
            onEnded={advance}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <img src={story.media_url} alt="" className="max-w-full max-h-full object-contain" />
        )}
      </div>`;

if (mediaRegex.test(content)) {
  content = content.replace(mediaRegex, newMediaBlock);
} else {
  console.error("❌ Media regex failed. We need to adjust the anchor.");
  process.exit(1);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully rebuilt StoryViewer.jsx media and timer logic!');

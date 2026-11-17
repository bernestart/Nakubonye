#!/usr/bin/env node
const fs = require('fs');

const edits = [];
function add(FILE, from, to, label) { edits.push({ FILE, from, to, label }); }

// --- 1. StoryViewer (Render Poll) ---
const SV = 'src/components/StoryViewer.jsx';
add(SV, `import StoryLinkSticker from "./stories/StoryLinkSticker"`, `import StoryLinkSticker from "./stories/StoryLinkSticker"\nimport StoryPollSticker from "./stories/StoryPollSticker"`, 'SV import poll');

// Add poll render between music player and link sticker
add(SV, `      <StoryMusicPlayer track={story.music_track} playing={!paused} />
      <StoryLinkSticker url={story.link_url} onOpen={(url) => { tap("light"); window.open(url, "_blank") }} />`, `      <StoryMusicPlayer track={story.music_track} playing={!paused} />
      <StoryPollSticker poll={story.metadata?.poll} myId={myId} />
      <StoryLinkSticker url={story.link_url} onOpen={(url) => { tap("light"); window.open(url, "_blank") }} />`, 'SV render poll');

// --- 2. Reels.jsx (Duet query + split screen) ---
const RD = 'src/screens/Reels.jsx';

// Fetch the original reel data via nested select
add(RD, `.select("id, user_id, video_url, clips, thumbnail_url, caption, duration_sec, trim_start, trim_end, mirrored, aspect_ratio, text_overlays, sticker_overlays, filter_id, audience, allow_comments, allow_remix, location, cover_frame_time, view_count, remix_of, created_at")`, `.select("id, user_id, video_url, clips, thumbnail_url, caption, duration_sec, trim_start, trim_end, mirrored, aspect_ratio, text_overlays, sticker_overlays, filter_id, audience, allow_comments, allow_remix, location, cover_frame_time, view_count, remix_of, created_at, original_reel:remix_of(id, video_url, thumbnail_url)")`, 'RD query duet');

// Split screen open — wrap video in flex-col container, add original video on top
add(RD, `                <video
                  ref={(el) => (videoRefs.current[idx] = el)}`, `                <div className={reel.original_reel ? "flex flex-col w-full h-full bg-black gap-[1px]" : "w-full h-full"}>
                  {reel.original_reel && (
                    <div className="flex-1 relative overflow-hidden bg-black">
                      <video src={reel.original_reel.video_url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                      <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-white text-[10px] font-bold z-10">Original</div>
                    </div>
                  )}
                  <div className={reel.original_reel ? "flex-1 relative overflow-hidden" : "w-full h-full relative"}>
                <video
                  ref={(el) => (videoRefs.current[idx] = el)}`, 'RD split screen open');

// Split screen close — close the two divs after video ends
add(RD, `                {/* Double-tap heart burst */}`, `                  </div>
                </div>
                {/* Double-tap heart burst */}`, 'RD split screen close');

// ===== PREFLIGHT =====
console.log('--- preflight ---');
let ok = true;
const srcCache = {};
for (const e of edits) {
  if (!srcCache[e.FILE]) srcCache[e.FILE] = fs.readFileSync(e.FILE, 'utf8');
  const c = srcCache[e.FILE].split(e.from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING in ${e.FILE}: ${e.label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x) in ${e.FILE}: ${e.label}`); ok = false; }
  else { console.log(`\u2705 ok: ${e.label}`); }
}
if (!ok) { console.error('\n\u274c Preflight failed. Files untouched.'); process.exit(1); }

console.log('\n--- applying ---');
const applied = new Set();
for (const e of edits) {
  if (!applied.has(e.FILE)) { srcCache[e.FILE] = fs.readFileSync(e.FILE, 'utf8'); applied.add(e.FILE); }
  srcCache[e.FILE] = srcCache[e.FILE].replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
for (const f of applied) fs.writeFileSync(f, srcCache[f]);
console.log(`\n\u2705 Done. ${edits.length} edits applied across ${applied.size} files.`);

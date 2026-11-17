#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/screens/Feed.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// 1 — import pill
add(
`import BrandGlow from "../components/BrandGlow"`,
`import BrandGlow from "../components/BrandGlow"
import NewPostsPill from "../components/NewPostsPill"`,
'import pill'
);

// 2 — state + hidePost helper
add(
`  const [pendingPosts, setPendingPosts] = useState([])`,
`  const [pendingPosts, setPendingPosts] = useState([])
  const [pendingRealtimeCount, setPendingRealtimeCount] = useState(0)
  const [hiddenPostKeys, setHiddenPostKeys] = useState(new Set())
  function hidePost(key) { setHiddenPostKeys((prev) => { const n = new Set(prev); n.add(key); return n }) }`,
'state'
);

// 3 — load silent option
add(
`  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true); setError("")`,
`  const load = useCallback(async (opts = {}) => {
    if (!myId) return
    if (!opts?.silent) setLoading(true)
    setError("")`,
'load silent'
);

// 4 — reset pill count at end of load
add(
`  }, [myId])

  // ---- Infinite scroll: fetch next page ----`,
`    setPendingRealtimeCount(0)
  }, [myId])

  // ---- Infinite scroll: fetch next page ----`,
'reset count'
);

// 5 — realtime: count instead of reload
add(
`    const debounced = () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
      realtimeDebounceRef.current = setTimeout(() => load(), 800)
    }`,
`    const debounced = () => {
      setPendingRealtimeCount((c) => c + 1)
    }`,
'realtime count'
);

// 6 — remove pink personal source strip (FB doesn't show this)
add(
`                {p._source === "personal" && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                    <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px] bg-pink-500/20">
                      {p.audience === "matches" ? "💜" : p.audience === "private" ? "🔒" : "🌍"}
                    </span>
                    <span className="text-pink-300 text-[11.5px] font-bold tracking-wide">
                      {p.author_id === myId
                        ? "Your post · " + (p.audience === "matches" ? "Matches" : p.audience === "private" ? "Only me" : "Everyone")
                        : "Posted to their profile"}
                    </span>
                  </div>
                )}
`,
``,
'remove pink strip'
);

// 7 — header reshape (FB anatomy)
add(
`                {/* Author header */}
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                  <button
                    onClick={() => { tap("light"); nav("/profile/" + p.author_id) }}
                    className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
                  >
                    {photoPath ? (
                      <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">{name[0]}</div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13.5px] truncate">
                      {name} {prof?.is_verified && <VerifiedBadge size={14} className="ml-1" />}
                    </p>
                    <p className="text-subtle text-[11px]">
                      {new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {(p.location_text || p.feeling_text) && (
                        <span className="text-muted text-[11px] ml-1.5">
                          {p.feeling_text && <>· feeling {p.feeling_text}</>}
                          {p.location_text && <> · 📍 {p.location_text}</>}
                        </span>
                      )}
                    </p>
                  </div>
                  {p.author_id !== myId && (
                    <FollowButton userId={p.author_id} size="sm" />
                  )}
                  <button
                    onClick={() => { tap("light"); setActionsFor(p) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Post options"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>`,
`                {/* Author header — FB anatomy */}
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                  <button
                    onClick={() => { tap("light"); nav("/profile/" + p.author_id) }}
                    className="relative w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
                  >
                    {photoPath ? (
                      <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">{name[0]}</div>
                    )}
                    {p.author_id === myId && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0B14]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-cream font-bold text-[13.5px] truncate max-w-[60%]">{name}</span>
                      {prof?.is_verified && <VerifiedBadge size={14} />}
                      {p.author_id !== myId && <FollowButton userId={p.author_id} size="sm" />}
                    </div>
                    <p className="text-subtle text-[11px] flex items-center gap-1 flex-wrap">
                      <span>{new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>·</span>
                      <span>{p.audience === "matches" ? "💜" : p.audience === "private" ? "🔒" : "🌐"}</span>
                      {(p.feeling_text || p.location_text) && (
                        <>
                          <span>·</span>
                          <span className="text-muted text-[11px] truncate">
                            {p.feeling_text && <>feeling {p.feeling_text}</>}
                            {p.feeling_text && p.location_text ? " · " : ""}
                            {p.location_text && <>📍 {p.location_text}</>}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => { tap("light"); setActionsFor(p) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Post options"
                  >
                    <MoreVertical size={18} />
                  </button>
                  <button
                    onClick={() => { tap("light"); hidePost(p._source + ":" + p.id) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Hide post"
                  >
                    <X size={18} />
                  </button>
                </div>`,
'header reshape'
);

// 8 — pill render + hidden filter
add(
`            {posts.map((p, idx) => {
            // REELS render as video cards`,
`            <NewPostsPill
              count={pendingRealtimeCount}
              onTap={() => { setPendingRealtimeCount(0); load({ silent: true }) }}
            />

            {posts.map((p, idx) => {
            if (hiddenPostKeys.has(p._source + ":" + p.id)) return null
            // REELS render as video cards`,
'pill + hidden filter'
);

// ===== PREFLIGHT =====
console.log('--- preflight ---');
let ok = true;
for (const e of edits) {
  const c = src.split(e.from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING: ${e.label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x): ${e.label}`); ok = false; }
  else { console.log(`\u2705 ok: ${e.label}`); }
}
if (!ok) { console.error('\n\u274c Preflight failed. File untouched.'); process.exit(1); }

console.log('\n--- applying ---');
for (const e of edits) {
  src = src.replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
fs.writeFileSync(FILE, src);
console.log(`\n\u2705 Done. ${edits.length} edits applied to ${FILE}`);

#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/screens/Saved.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// S1 — import ProfilePostCard
add(
`import { useAuth } from "../lib/auth"`,
`import { useAuth } from "../lib/auth"
import ProfilePostCard from "../components/ProfilePostCard"`,
'S1 import'
);

// S2 — replace the inline button with ProfilePostCard
add(
`        ) : tab === "posts" ? (
          <div className="px-3 flex flex-col gap-2">
            {posts.map((p) => (
              <button
                key={p._source + "-" + p.id}
                onClick={() => { tap("light"); nav("/post/" + p._source + "/" + p.id) }}
                className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden text-left active:opacity-90"
              >
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black text-[12px]">
                    {p._photo ? (
                      <img src={p._photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (p._prof?.display_name || p._prof?.username || "?")[0].toUpperCase()
                    )}
                  </span>
                  <p className="text-cream text-[13px] font-bold truncate">
                    {p._prof?.display_name || p._prof?.username || "User"}
                  </p>
                </div>
                {p.image_path && (
                  <img
                    src={supabase.storage.from("community-media").getPublicUrl(p.image_path).data?.publicUrl}
                    alt=""
                    className="w-full max-h-[240px] object-cover"
                  />
                )}
                {p.content && (
                  <p className="px-3 py-2 text-cream text-[13px] leading-snug line-clamp-2">{p.content}</p>
                )}
              </button>
            ))}
          </div>
        ) : tab === "reels" ? (`,
`        ) : tab === "posts" ? (
          <div className="px-3 flex flex-col gap-2">
            {posts.map((p) => (
              <ProfilePostCard
                key={p._source + "-" + p.id}
                post={p}
                authorProfile={p._prof}
                authorPhoto={p._photo}
                isMe={false}
                onOpenMenu={() => {}}
                reactionCount={0}
                liked={false}
                reactionEmoji="❤️"
                commentCount={0}
                topReactors={[]}
                shareCount={0}
                onOpenReposts={() => {}}
                onToggleLike={() => {}}
              />
            ))}
          </div>
        ) : tab === "reels" ? (`,
'S2 saved card'
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

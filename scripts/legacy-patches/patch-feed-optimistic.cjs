const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Add pendingPosts state
const stateAnchor = `  const [composerChooserOpen, setComposerChooserOpen] = useState(false)`;
if (!s.includes(stateAnchor)) { console.error("composerChooserOpen missing"); process.exit(1); }
if (!s.includes("pendingPosts")) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [pendingPosts, setPendingPosts] = useState([])`);
}

// 2. Add handlers right before `return (`
const returnAnchor = `  return (\n    <div`;
const idx = s.indexOf(returnAnchor);
if (idx < 0) { console.error("return anchor missing"); process.exit(1); }
if (!s.includes("function addPendingPost")) {
  const handlers = `  function addPendingPost(item) {
    setPendingPosts((cur) => [...cur, item])
  }

  function resolvePendingPost(tempId, realPost) {
    setPendingPosts((cur) => cur.filter((x) => x._tempId !== tempId))
    if (realPost) setPosts((cur) => [realPost, ...cur])
  }

  function failPendingPost(tempId, error) {
    setPendingPosts((cur) =>
      cur.map((x) => x._tempId === tempId ? { ...x, _status: "failed", _error: error } : x)
    )
  }

`;
  s = s.slice(0, idx) + handlers + s.slice(idx);
}

// 3. Render pending posts above the real stream
const oldElse = `        ) : (
          posts.map((p, idx) => {`;

const newElse = `        ) : (
          <>
            {/* Pending (optimistic) posts */}
            {pendingPosts.map((pp) => (
              <article key={pp._tempId} className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden relative">
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                  <span className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                    {pp.myPhoto ? (
                      <img src={pp.myPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">Y</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13.5px] truncate">{pp.displayName || "You"}</p>
                    <p className="text-subtle text-[11px]">
                      {pp._status === "failed" ? "Upload failed" : "Uploading…"}
                    </p>
                  </div>
                  {pp._status === "failed" ? (
                    <span className="px-2 h-7 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-[11px] font-bold grid place-items-center">
                      Failed
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  )}
                </div>

                {pp.content && (
                  <p className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap">{pp.content}</p>
                )}

                {pp.imagePreview && (
                  <img src={pp.imagePreview} alt="" className="w-full max-h-[60vh] object-cover" />
                )}

                {pp._status === "failed" && (
                  <div className="px-3 py-2.5 border-t border-red-500/20 bg-red-500/5">
                    <p className="text-red-300 text-[12px] mb-2 truncate">{pp._error || "Upload failed"}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setPendingPosts((cur) => cur.filter((x) => x._tempId !== pp._tempId)) }}
                        className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/12 text-muted font-bold text-[11.5px]"
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => pp._retry?.()}
                        className="h-8 px-3 rounded-full text-white font-bold text-[11.5px]"
                        style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}

            {posts.map((p, idx) => {`;

if (!s.includes(oldElse)) { console.error("else branch not found"); process.exit(1); }
s = s.replace(oldElse, newElse);

// 4. Close the fragment after the map
const closeAnchor = `        )}
      </div>

      <BottomNav />`;
if (!s.includes(closeAnchor)) { console.error("close anchor missing"); process.exit(1); }
s = s.replace(closeAnchor, `        )}
          </>
        )}
      </div>

      <BottomNav />`);

fs.writeFileSync(p, s);
console.log("pending posts infrastructure added to Feed");

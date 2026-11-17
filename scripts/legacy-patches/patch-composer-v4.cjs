#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/components/PostComposer.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// C1 — state for backgrounds + alts + alt sheet
add(
`  const [tagPickerOpen, setTagPickerOpen] = useState(false)`,
`  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [bgStyle, setBgStyle] = useState(null)
  const [imageAlts, setImageAlts] = useState([])
  const [bgSheetOpen, setBgSheetOpen] = useState(false)
  const [altSheetIdx, setAltSheetIdx] = useState(null)
  const [altDraft, setAltDraft] = useState("")`,
'C1 state'
);

// C2 — sync imageAlts length with imageFiles
add(
`  const activeAud = (() => {`,
`  // Ensure imageAlts matches imageFiles length
  useEffect(() => {
    setImageAlts((prev) => {
      const next = [...prev]
      while (next.length < imageFiles.length) next.push("")
      return next.slice(0, imageFiles.length)
    })
  }, [imageFiles.length])

  const activeAud = (() => {`,
'C2 sync alts'
);

// C3 — insert payload
add(
`        tagged_user_ids: taggedUsers.map((u) => u.id).filter(Boolean),
      }).select("id").single()`,
`        tagged_user_ids: taggedUsers.map((u) => u.id).filter(Boolean),
        background_style: imageFiles.length === 0 ? bgStyle : null,
        image_alts: imageAlts.filter(Boolean),
      }).select("id").single()`,
'C3 payload'
);

// C4 — add Aa button next to Next in compose header
add(
`          <button
            onClick={() => { tap("light"); setStage("settings") }}
            disabled={!canPost}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            Next
          </button>
        )}
      </header>`,
`          <div className="flex items-center gap-1.5">
            {imageFiles.length === 0 && (
              <button
                onClick={() => { tap("light"); setBgSheetOpen(true) }}
                className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.06] text-cream"
                aria-label="Background color"
              >
                <span className="font-black text-[14px]">Aa</span>
              </button>
            )}
            <button
              onClick={() => { tap("light"); setStage("settings") }}
              disabled={!canPost}
              className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              Next
            </button>
          </div>
        )}
      </header>`,
'C4 Aa button'
);

// C5 — apply bgStyle to textarea wrapper (look for the div containing the textarea)
add(
`        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 1000))}
          placeholder="Share something real…"
          rows={5}
          autoFocus
          className="w-full bg-transparent border-0 text-cream text-[16px] leading-[1.5] placeholder:text-subtle focus:outline-none resize-none mb-3"
        />`,
`        <div className="rounded-2xl transition-colors" style={{ background: bgStyle || "transparent", minHeight: bgStyle ? 180 : "auto", display: "flex", alignItems: "center" }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 1000))}
            placeholder="Share something real…"
            rows={5}
            autoFocus
            className="w-full bg-transparent border-0 text-cream text-[16px] leading-[1.5] placeholder:text-subtle focus:outline-none resize-none mb-3 px-2"
            style={{ textAlign: bgStyle ? "center" : "left", fontSize: bgStyle ? 22 : 16, fontWeight: bgStyle ? 700 : 400 }}
          />
        </div>`,
'C5 textarea bg'
);

// C6 — add Alt Text button in preview stage (find the set cover buttons)
add(
`                  {i !== 0 ? (
                    <button
                      onClick={() => { tap("light"); setCover(i) }}
                      className="h-8 px-3 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold text-[11.5px]"
                    >
                      Set cover
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-purple-300 font-bold">Cover image</span>
                  )}`,
`                  {i !== 0 ? (
                    <button
                      onClick={() => { tap("light"); setCover(i) }}
                      className="h-8 px-3 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold text-[11.5px]"
                    >
                      Set cover
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-purple-300 font-bold">Cover image</span>
                  )}
                  <button
                    onClick={() => { tap("light"); setAltSheetIdx(i); setAltDraft(imageAlts[i] || "") }}
                    className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[11.5px]"
                  >
                    Alt
                  </button>`,
'C6 alt button'
);

// C7 — add Background picker & Alt Text sheets before the end of the component
add(
`      {tagPickerOpen && (`,
`      {bgSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setBgSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <h3 className="text-cream font-extrabold text-[16px] mb-3">Background color</h3>
            <div className="flex gap-2">
              {[
                { id: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", label: "Pink" },
                { id: "linear-gradient(135deg, #3B82F6 0%, #2DD4BF 100%)", label: "Blue" },
                { id: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", label: "Sunset" },
                { id: null, label: "None" },
              ].map((b) => (
                <button
                  key={b.label}
                  onClick={() => { tap("light"); setBgStyle(b.id); setBgSheetOpen(false) }}
                  className="flex-1 h-16 rounded-xl border border-white/10 grid place-items-center font-bold text-white text-[13px]"
                  style={{ background: b.id || "rgba(255,255,255,0.05)" }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {altSheetIdx !== null && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setAltSheetIdx(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <h3 className="text-cream font-extrabold text-[16px] mb-3">Alt text</h3>
            <input
              value={altDraft}
              onChange={(e) => setAltDraft(e.target.value.slice(0, 120))}
              placeholder="Describe this image for blind users…"
              autoFocus
              className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setAltSheetIdx(null)} className="flex-1 h-11 rounded-full bg-white/[0.05] border border-white/10 text-muted font-semibold text-[13.5px]">Cancel</button>
              <button onClick={() => { tap("light"); setImageAlts(prev => { const n = [...prev]; n[altSheetIdx] = altDraft; return n }); setAltSheetIdx(null) }} className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px]" style={{ background: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {tagPickerOpen && (`,
'C7 sheets'
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

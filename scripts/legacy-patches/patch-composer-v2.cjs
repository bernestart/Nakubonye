#!/usr/bin/env node
// patch-composer-v2.cjs — Composer v2 (FB-style: vertical tray + settings step)
const fs = require('fs');
const FILE = 'src/components/PostComposer.jsx';
let src = fs.readFileSync(FILE, 'utf8');
const orig = src;

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// R1 — new state (appended after publishAt state line)
add(
`  const [publishAt, setPublishAt] = useState("")  // ISO string or ""`,
`  const [publishAt, setPublishAt] = useState("")  // ISO string or ""
  const [whoCanComment, setWhoCanComment] = useState("public")
  const [aiLabel, setAiLabel] = useState(false)
  const [shareToStory, setShareToStory] = useState(false)
  const [commentSheetOpen, setCommentSheetOpen] = useState(false)`,
'R1 state'
);

// R2 — insert payload: append new fields just before }).select("id").single()
add(
`        location_text: locationText.trim() || null,
        feeling_text: feelingText.trim() || null,
        publish_at: scheduledFor,
      }).select("id").single()`,
`        location_text: locationText.trim() || null,
        feeling_text: feelingText.trim() || null,
        publish_at: scheduledFor,
        who_can_comment: whoCanComment,
        ai_label: aiLabel,
        share_to_story: shareToStory,
      }).select("id").single()`,
'R2 payload'
);

// R3 — compose header swap
add(
`      <header className="flex items-center justify-between px-3 py-3 shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.06] text-muted"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <h2 className="text-cream font-bold text-[16px]">Create post</h2>
        {stage === "compose" && imageFiles.length > 0 ? (
          <button
            onClick={() => { tap("light"); setStage("preview") }}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px]"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canPost}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Send size={14} /> {busy ? "Posting…" : "Post"}
          </button>
        )}
      </header>`,
`      <header className="flex items-center justify-between px-3 py-3 shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        {stage === "settings" ? (
          <button
            onClick={() => { tap("light"); setStage("compose") }}
            className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.06] text-cream"
            aria-label="Back"
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{"\\u2190"}</span>
          </button>
        ) : (
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.06] text-muted"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
        <h2 className="text-cream font-bold text-[16px]">
          {stage === "settings" ? "Post settings" : "Create post"}
        </h2>
        {stage === "settings" ? (
          imageFiles.length > 0 ? (
            <button
              onClick={() => { tap("light"); setStage("preview") }}
              disabled={!canPost}
              className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              Preview
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canPost}
              className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Send size={14} /> {busy ? "Posting…" : "Share"}
            </button>
          )
        ) : (
          <button
            onClick={() => { tap("light"); setStage("settings") }}
            disabled={!canPost}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            Next
          </button>
        )}
      </header>`,
'R3 header'
);

// R4a — insert settings branch at top of scroll body
add(
`      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {reshareRef && (`,
`      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {stage === "settings" ? (
          <div className="flex flex-col gap-2">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/8 mb-1">
              <p className="text-purple-300 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Preview</p>
              <p className="text-cream/85 text-[13.5px] leading-snug whitespace-pre-wrap line-clamp-3 mb-1">
                {content.trim() || <span className="text-muted italic">No text</span>}
              </p>
              {imagePreviews.length > 0 && (
                <p className="text-muted text-[12px]">{imagePreviews.length} {imagePreviews.length === 1 ? "photo" : "photos"}</p>
              )}
              {(locationText || feelingText) && (
                <p className="text-muted text-[12px] mt-1">
                  {feelingText ? ("\\u00b7 feeling " + feelingText) : ""}
                  {locationText ? (" \\u00b7 \\u{1F4CD} " + locationText) : ""}
                </p>
              )}
            </div>

            <button onClick={() => { tap("light"); setAudienceView("main"); setAudienceSheetOpen(true) }} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left">
              <span className="text-xl">{"\\u{1F30D}"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold text-[14px]">Post audience</p>
                <p className="text-muted text-[12px] truncate">{activeAud.label}</p>
              </div>
              <span className="text-muted text-[18px]">{"\\u203A"}</span>
            </button>

            <button onClick={() => { tap("light"); setCommentSheetOpen(true) }} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left">
              <span className="text-xl">{"\\u{1F4AC}"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold text-[14px]">Who can comment</p>
                <p className="text-muted text-[12px] truncate">{whoCanComment === "public" ? "Public" : whoCanComment === "matches" ? "Matches only" : "Only me"}</p>
              </div>
              <span className="text-muted text-[18px]">{"\\u203A"}</span>
            </button>

            <button onClick={() => { tap("light"); setScheduleDraft(publishAt ? publishAt.slice(0, 16) : ""); setScheduleSheetOpen(true) }} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left">
              <span className="text-xl">{"\\u{1F550}"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold text-[14px]">Scheduling options</p>
                <p className="text-muted text-[12px] truncate">{publishAt ? new Date(publishAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Post now"}</p>
              </div>
              <span className="text-muted text-[18px]">{"\\u203A"}</span>
            </button>

            <div className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
              <span className="text-xl">{"\\u{1F4D6}"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold text-[14px]">Share to Story</p>
                <p className="text-muted text-[12px]">{shareToStory ? "On" : "Off"}</p>
              </div>
              <button onClick={() => { tap("light"); setShareToStory(v => !v) }}
                className={"w-11 h-6 rounded-full transition-colors " + (shareToStory ? "bg-purple-500" : "bg-white/20")}
                style={{ position: "relative" }}>
                <span className="rounded-full bg-white" style={{ position: "absolute", top: 2, left: shareToStory ? 22 : 2, width: 20, height: 20, transition: "left 160ms" }} />
              </button>
            </div>

            <div className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
              <span className="text-xl">{"\\u2728"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold text-[14px]">Add AI label</p>
                <p className="text-muted text-[12px]">Label realistic content made with AI</p>
              </div>
              <button onClick={() => { tap("light"); setAiLabel(v => !v) }}
                className={"w-11 h-6 rounded-full transition-colors " + (aiLabel ? "bg-purple-500" : "bg-white/20")}
                style={{ position: "relative" }}>
                <span className="rounded-full bg-white" style={{ position: "absolute", top: 2, left: aiLabel ? 22 : 2, width: 20, height: 20, transition: "left 160ms" }} />
              </button>
            </div>
          </div>
        ) : (
        <>
        {reshareRef && (`,
'R4a body open'
);

// R4b — close the settings branch after audience pill
add(
`          <div className="flex-1 min-w-0">
            <p className="text-cream font-bold text-[13.5px]">{activeAud.label}</p>
            <p className="text-muted text-[12px] truncate">{activeAud.desc}</p>
          </div>
        </button>
      </div>`,
`          <div className="flex-1 min-w-0">
            <p className="text-cream font-bold text-[13.5px]">{activeAud.label}</p>
            <p className="text-muted text-[12px] truncate">{activeAud.desc}</p>
          </div>
        </button>
        </>
        )}
      </div>`,
'R4b body close'
);

// R5 — replace horizontal pill scroller with vertical tray
add(
`        {/* Add to your post — FB-style row */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 mb-3">
          <p className="text-purple-300 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Add to your post</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => { tap("light"); fileRef.current?.click() }}
              className="shrink-0 h-11 px-3.5 rounded-full bg-white/[0.05] border border-white/10 text-cream text-[12.5px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <ImagePlus size={14} className="text-emerald-400" /> Photo
            </button>
            <button
              type="button"
              onClick={() => { tap("light"); setLocationDraft(locationText); setLocationSheetOpen(true) }}
              className={\`shrink-0 h-11 px-3.5 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform \${locationText ? "bg-purple-500/15 border-purple-500/50 text-purple-100" : "bg-white/[0.05] border-white/10 text-cream"}\`}
            >
              <MapPin size={14} className="text-red-400" /> {locationText || "Location"}
            </button>
            <button
              type="button"
              onClick={() => { tap("light"); setFeelingDraft(feelingText); setFeelingSheetOpen(true) }}
              className={\`shrink-0 h-11 px-3.5 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform \${feelingText ? "bg-purple-500/15 border-purple-500/50 text-purple-100" : "bg-white/[0.05] border-white/10 text-cream"}\`}
            >
              <Smile size={14} className="text-yellow-400" /> {feelingText || "Feeling"}
            </button>
            <button
              type="button"
              onClick={() => { tap("light"); setScheduleDraft(publishAt ? publishAt.slice(0, 16) : ""); setScheduleSheetOpen(true) }}
              className={\`shrink-0 h-11 px-3.5 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform \${publishAt ? "bg-purple-500/15 border-purple-500/50 text-purple-100" : "bg-white/[0.05] border-white/10 text-cream"}\`}
            >
              <Clock size={14} className="text-blue-400" /> {publishAt ? new Date(publishAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Schedule"}
            </button>
          </div>
        </div>`,
`        {/* Add to your post — vertical tray (FB-style) */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] mb-3 overflow-hidden">
          <p className="text-purple-300 text-[10.5px] font-black tracking-[0.16em] uppercase px-3.5 pt-3 pb-1">Add to your post</p>
          <button type="button" onClick={() => { tap("light"); fileRef.current?.click() }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04] border-b border-white/[0.06]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-emerald-500/15"><ImagePlus size={16} className="text-emerald-400" /></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Photo/video</span>
            {imageFiles.length > 0 && <span className="text-purple-400 text-[12px] font-bold">{imageFiles.length}</span>}
          </button>
          <button type="button" onClick={() => { tap("light"); try { alert("Tag people coming soon") } catch {} }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04] border-b border-white/[0.06]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-blue-500/15"><span className="text-[15px]">{"\\u{1F464}"}</span></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Tag people</span>
          </button>
          <button type="button" onClick={() => { tap("light"); setFeelingDraft(feelingText); setFeelingSheetOpen(true) }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04] border-b border-white/[0.06]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-yellow-500/15"><Smile size={16} className="text-yellow-400" /></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Feeling/activity</span>
            {feelingText && <span className="text-purple-300 text-[12px] truncate max-w-[120px]">{feelingText}</span>}
          </button>
          <button type="button" onClick={() => { tap("light"); setLocationDraft(locationText); setLocationSheetOpen(true) }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04] border-b border-white/[0.06]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-red-500/15"><MapPin size={16} className="text-red-400" /></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Check in</span>
            {locationText && <span className="text-purple-300 text-[12px] truncate max-w-[120px]">{locationText}</span>}
          </button>
          <button type="button" onClick={() => { tap("light"); setScheduleDraft(publishAt ? publishAt.slice(0, 16) : ""); setScheduleSheetOpen(true) }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-indigo-500/15"><Clock size={16} className="text-indigo-400" /></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Schedule</span>
            {publishAt && <span className="text-purple-300 text-[12px]">{new Date(publishAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
          </button>
        </div>`,
'R5 tray'
);

// R6 — preview Back -> settings
add(
`          <button
            onClick={() => setStage("compose")}
            className="h-10 px-4 rounded-full bg-white/[0.06] text-cream font-semibold text-[13.5px]"
          >
            ← Back
          </button>`,
`          <button
            onClick={() => setStage("settings")}
            className="h-10 px-4 rounded-full bg-white/[0.06] text-cream font-semibold text-[13.5px]"
          >
            ← Back
          </button>`,
'R6 preview back'
);

// R7 — comment sheet inserted before audience sheet
add(
`      {audienceSheetOpen && (`,
`      {commentSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setCommentSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <h3 className="text-cream font-extrabold text-[16px] mb-2">Who can comment?</h3>
            {[
              { id: "public", label: "Public", desc: "Anyone can comment" },
              { id: "matches", label: "Matches only", desc: "Only your matches" },
              { id: "private", label: "Only me", desc: "No one else can comment" },
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => { tap("light"); setWhoCanComment(o.id); setCommentSheetOpen(false) }}
                className="flex items-center gap-3 p-4 rounded-2xl text-left"
                style={{
                  background: whoCanComment === o.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: whoCanComment === o.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[14px]">{o.label}</p>
                  <p className="text-muted text-[12px]">{o.desc}</p>
                </div>
                {whoCanComment === o.id && <span className="text-purple-400 text-[16px]">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {audienceSheetOpen && (`,
'R7 comment sheet'
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

// ===== APPLY =====
console.log('\n--- applying ---');
for (const e of edits) {
  src = src.replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
fs.writeFileSync(FILE, src);
console.log(`\n\u2705 Done. ${edits.length} edits applied to ${FILE}`);

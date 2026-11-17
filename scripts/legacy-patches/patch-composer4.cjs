const fs = require('fs');
const PC = 'src/components/PostComposer.jsx';
let s = fs.readFileSync(PC, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// 1. Add-to-post row — insert before the audience pill comment
apply(
`        {/* Audience pill */}
        <button
          onClick={() => { setAudienceView("main"); setAudienceSheetOpen(true) }}`,
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
        </div>

        {/* Audience pill */}
        <button
          onClick={() => { setAudienceView("main"); setAudienceSheetOpen(true) }}`,
'add-to-post row');

// 2. Insert 3 sheets right before the audience sheet opens
apply(
`      {audienceSheetOpen && (`,
`      {locationSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setLocationSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4" style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.2)" }} />
            <h3 className="text-cream font-extrabold text-[16px] mb-3">Add location</h3>
            <input
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value.slice(0, 80))}
              placeholder="e.g. Bujumbura, Burundi"
              autoFocus
              className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setLocationSheetOpen(false)}
                className="flex-1 h-11 rounded-full bg-white/[0.05] border border-white/10 text-muted font-semibold text-[13.5px]"
              >Cancel</button>
              <button
                onClick={() => { tap("light"); setLocationText(locationDraft.trim()); setLocationSheetOpen(false) }}
                className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px]"
                style={{ background: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)" }}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {feelingSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setFeelingSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4" style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.2)" }} />
            <h3 className="text-cream font-extrabold text-[16px] mb-3">How are you feeling?</h3>
            <input
              value={feelingDraft}
              onChange={(e) => setFeelingDraft(e.target.value.slice(0, 60))}
              placeholder="e.g. grateful, excited…"
              autoFocus
              className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setFeelingSheetOpen(false)}
                className="flex-1 h-11 rounded-full bg-white/[0.05] border border-white/10 text-muted font-semibold text-[13.5px]"
              >Cancel</button>
              <button
                onClick={() => { tap("light"); setFeelingText(feelingDraft.trim()); setFeelingSheetOpen(false) }}
                className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px]"
                style={{ background: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)" }}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {scheduleSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setScheduleSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4" style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.2)" }} />
            <h3 className="text-cream font-extrabold text-[16px] mb-1">Schedule post</h3>
            <p className="text-muted text-[12.5px] mb-4">Choose when this post should go live. It stays hidden until then.</p>
            <input
              type="datetime-local"
              value={scheduleDraft}
              onChange={(e) => setScheduleDraft(e.target.value)}
              min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
              className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10 px-4 text-cream text-[14px] focus:outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { tap("light"); setPublishAt(""); setScheduleSheetOpen(false) }}
                className="flex-1 h-11 rounded-full bg-white/[0.05] border border-white/10 text-muted font-semibold text-[13.5px]"
              >Post now</button>
              <button
                onClick={() => {
                  tap("light")
                  if (scheduleDraft && new Date(scheduleDraft).getTime() > Date.now() + 60_000) {
                    setPublishAt(scheduleDraft)
                  }
                  setScheduleSheetOpen(false)
                }}
                disabled={!scheduleDraft || new Date(scheduleDraft).getTime() <= Date.now() + 60_000}
                className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)" }}
              >Schedule</button>
            </div>
          </div>
        </div>
      )}

      {audienceSheetOpen && (`,
'3 picker sheets');

fs.writeFileSync(PC, s);
console.log(`\n✅ POST COMPOSER — ${n} edits`);

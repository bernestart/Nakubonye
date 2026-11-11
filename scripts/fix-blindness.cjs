const fs = require('fs');
const path = require('path');
const root = process.cwd();

// ==========================================
// FIX 1: PROFILE MENU (Exact string replacement)
// ==========================================
const pmsPath = path.join(root, 'src/components/ProfileMenuSheet.jsx');
let pms = fs.readFileSync(pmsPath, 'utf8');

// Ensure useNavigate exists
if (!pms.includes('useNavigate')) {
  pms = "import { useNavigate } from 'react-router-dom';\n" + pms;
}
if (!pms.includes('const nav = useNavigate()')) {
  pms = pms.replace(
    'export default function ProfileMenuSheet({',
    'export default function ProfileMenuSheet({\n  const nav = useNavigate();'
  );
}

// Exact string from recon line 98
const badOnClick = "onClick={() => { onClose(); onToggleCreatorMode?.(); }}";
const goodOnClick = "onClick={() => { tap('light'); nav('/settings/creator'); onClose(); }}";

if (pms.includes(badOnClick)) {
  pms = pms.replace(badOnClick, goodOnClick);
  console.log('✅ ProfileMenuSheet: Replaced broken toggle with nav route.');
} else {
  console.log('⚠️ ProfileMenuSheet: Exact onClick not found. Checking alternatives...');
  // Fallback if tap('light') is missing
  pms = pms.replace(/onClick=\{\(\) => \{.*onToggleCreatorMode.*\}\}/, goodOnClick);
}

fs.writeFileSync(pmsPath, pms);


// ==========================================
// FIX 2: STORY COMPOSER (Rip out broken grid)
// ==========================================
const scPath = path.join(root, 'src/components/StoryComposer.jsx');
let sc = fs.readFileSync(scPath, 'utf8');

// Find the entire 'hub' UI block and replace it with a clean, non-grid version
const hubStart = sc.indexOf('  if (mode === "hub") {');
const hubEnd = sc.indexOf('  if (mode === "text") {');

if (hubStart !== -1 && hubEnd !== -1) {
  const cleanHubUI = `  if (mode === "hub") {
    return createPortal(
      <div className="fixed inset-0 z-[2000] bg-[#18191A] flex flex-col">
        <div className="flex items-center justify-between p-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
          <button onClick={onClose} className="w-10 h-10 rounded-full grid place-items-center bg-white/10 text-white"><X size={22} /></button>
          <h2 className="text-white font-bold text-[17px]">Create story</h2>
          <button onClick={() => setPrivacyOpen(true)} className="w-10 h-10 rounded-full grid place-items-center text-white"><Settings size={22} /></button>
        </div>

        <div className="flex gap-3 px-4 pb-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => setMode("text")} className="flex flex-col items-center justify-center gap-2 min-w-[100px] h-[100px] rounded-2xl bg-[#242526] border border-white/10 active:bg-white/5">
            <Type size={28} className="text-white" />
            <span className="text-white text-[13px] font-semibold">Text</span>
          </button>
          <button onClick={openCamera} className="flex flex-col items-center justify-center gap-2 min-w-[100px] h-[100px] rounded-2xl bg-[#242526] border border-white/10 active:bg-white/5">
            <CameraIcon size={28} className="text-white" />
            <span className="text-white text-[13px] font-semibold">Camera</span>
          </button>
          <button onClick={() => multiFileRef.current?.click()} className="flex flex-col items-center justify-center gap-2 min-w-[100px] h-[100px] rounded-2xl bg-[#242526] border border-white/10 active:bg-white/5">
            <LayoutGrid size={28} className="text-white" />
            <span className="text-white text-[13px] font-semibold">Collage</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <ImageIcon size={32} className="text-white/40" />
          </div>
          <h3 className="text-white font-bold text-[16px] mb-2">Select from Gallery</h3>
          <p className="text-white/50 text-[13px] text-center mb-6">Choose a photo or video from your device to add to your story.</p>
          <button onClick={selectRecentMedia} disabled={busy} className="w-full max-w-[280px] h-12 rounded-full bg-white text-black font-bold text-[15px] flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {busy ? "Opening..." : "Open Gallery"}
          </button>
        </div>

        <input ref={singleFileRef} type="file" accept="image/*,video/*" hidden onChange={pickSingle} />
        <input ref={multiFileRef} type="file" accept="image/*" multiple hidden onChange={pickCollage} />

        {/* Privacy Settings Modal */}
        {privacyOpen && (
          <div className="fixed inset-0 z-[2100] flex items-end bg-black/60" onClick={() => setPrivacyOpen(false)}>
            <div className="w-full bg-[#0B0B14] rounded-t-3xl border-t border-white/10 p-6" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
              <h3 className="text-cream font-extrabold text-[17px] mb-1">Story Privacy</h3>
              <p className="text-muted text-[12.5px] mb-6">Your story will be visible for 24 hours on Nakubonye.</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setAudience("everyone"); setPrivacyOpen(false); }} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
                  <Globe size={22} className="text-purple-400" />
                  <div className="flex-1 text-left">
                    <p className="text-cream font-bold text-[14px]">Everyone</p>
                    <p className="text-muted text-[12px]">Anyone on Nakubonye</p>
                  </div>
                  {audience === "everyone" && <Check size={20} className="text-purple-400" />}
                </button>
                <button onClick={() => { setAudience("matches"); setPrivacyOpen(false); }} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
                  <Users size={22} className="text-purple-400" />
                  <div className="flex-1 text-left">
                    <p className="text-cream font-bold text-[14px]">Matches</p>
                    <p className="text-muted text-[12px]">Only people you've matched with</p>
                  </div>
                  {audience === "matches" && <Check size={20} className="text-purple-400" />}
                </button>
                <button onClick={() => { setAudience("following"); setPrivacyOpen(false); }} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
                  <Users size={22} className="text-purple-400" />
                  <div className="flex-1 text-left">
                    <p className="text-cream font-bold text-[14px]">Following</p>
                    <p className="text-muted text-[12px]">People you follow</p>
                  </div>
                  {audience === "following" && <Check size={20} className="text-purple-400" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>, document.body
    )
  }

`;
  sc = sc.substring(0, hubStart) + cleanHubUI + sc.substring(hubEnd);
  fs.writeFileSync(scPath, sc);
  console.log('✅ StoryComposer: Completely removed the broken grid UI. Replaced with clean gallery button.');
} else {
  console.log('❌ StoryComposer: Could not find hub block markers.');
}

const fs = require('fs');
const file = 'src/screens/CreatorMode.jsx';
let content = fs.readFileSync(file, 'utf8');

const fixedActiveView = `// ---------- Active view (creator mode is on) ----------
function ActiveView({ onTurnOff, category, onEditCategory, myId }) {
  return (
    <>
      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/finish.jpg"
          alt=""
          className="w-full h-auto block"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }}
        />
      </div>

      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-4 grid place-items-center -mt-16 relative z-10"
          style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)', border: '3px solid #0B0B14' }}
        >
          <Sparkles size={36} className="text-white" strokeWidth={2.2} />
        </div>
        <h2 className="text-cream font-extrabold text-[20px] mb-2">
          Creator mode is on
        </h2>
        <p className="text-muted text-[13.5px] leading-relaxed px-4">
          Your profile is public-facing. Anyone can follow you and discover your posts.
        </p>
      </div>

      {/* LIVE CREATOR DASHBOARD (Monetization + Tasks) */}
      {myId && <CreatorDashboard myId={myId} />}

      {/* Category Button */}
      <button
        onClick={onEditCategory}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/8 mb-3 active:bg-white/[0.05]"
      >
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center text-purple-300">
            <Tag size={16} />
          </span>
          <span className="flex flex-col items-start">
            <span className="text-cream font-semibold text-[13.5px]">Category</span>
            <span className="text-muted text-[11.5px]">{category || 'Choose what best describes you'}</span>
          </span>
        </span>
        <ChevronRight size={16} className="text-muted" />
      </button>

      {/* Turn Off Button */}
      <button
        onClick={onTurnOff}
        className="w-full h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[14px] active:bg-red-500/20 transition-colors mb-6"
      >
        Turn off Creator Mode
      </button>
    </>
  )
}

`;

// Replace from the comment line down to the Categories array
const regex = /\/\/ ---------- Active view[\s\S]*?const CREATOR_CATEGORIES = \[/;

if (regex.test(content)) {
  content = content.replace(regex, fixedActiveView + 'const CREATOR_CATEGORIES = [');
  fs.writeFileSync(file, content);
  console.log('✅ Fixed ActiveView and restored missing buttons!');
} else {
  console.error('❌ Could not find the ActiveView block to replace.');
}

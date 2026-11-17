const fs = require('fs');
const p = 'src/screens/CreatorMode.jsx';
let s = fs.readFileSync(p, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// Patch 1 — Entry card → entry.jpg
apply(
`      <div
        className="relative w-full h-44 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 55%, #A78BFA 100%)' }}
      >
        <div className="absolute w-24 h-24 rounded-full bg-purple-300/25 -top-4 -left-4 blur-2xl" />
        <div className="absolute w-28 h-28 rounded-full bg-white/15 bottom-0 -right-6 blur-2xl" />
        <div className="absolute w-16 h-16 rounded-full bg-purple-400/40 top-6 right-10 blur-xl" />
        <div className="relative w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 grid place-items-center">
          <Sparkles size={40} className="text-white" strokeWidth={1.8} />
        </div>
      </div>`,
`      <div className="relative w-full h-56 rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/entry.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 20%' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(76,29,149,0.10) 0%, rgba(76,29,149,0.60) 100%)' }}
        />
      </div>`,
'entry photo');

// Patch 2 — Active: add finish.jpg + badge overlay
apply(
`      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-4 grid place-items-center"
          style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
        >
          <Sparkles size={36} className="text-white" strokeWidth={2.2} />
        </div>
        <h2 className="text-cream font-extrabold text-[20px] mb-2">
          Creator mode is on
        </h2>`,
`      <div className="relative w-full h-56 rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/finish.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 25%' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(76,29,149,0.10) 0%, rgba(76,29,149,0.60) 100%)' }}
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
        </h2>`,
'active photo + badge');

fs.writeFileSync(p, s);
console.log(`\n✅ CreatorMode.jsx — ${n} edits`);

const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/screens/CreatorMode.jsx');
let src = fs.readFileSync(file, 'utf8');

// Check if ConfirmOff already exists somewhere (just in case I missed it)
if (src.includes('function ConfirmOff')) {
  console.log('⚠️ ConfirmOff already exists. Exiting.');
  process.exit(0);
}

const confirmOffComponent = `
// ---------- Confirm Turn Off ----------
function ConfirmOff({ onCancel, onConfirm, busy }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] bg-[#0B0B14] rounded-3xl border border-white/10 p-6 flex flex-col"
      >
        <h3 className="text-cream font-extrabold text-[20px] mb-2 text-center">Turn off creator mode?</h3>
        <p className="text-muted text-[13.5px] leading-relaxed text-center mb-6">
          If you turn off creator mode, you will lose access to:
        </p>

        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <BarChart3 size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-cream font-bold text-[14px]">Insights & Dashboard</p>
              <p className="text-muted text-[12.5px]">You won't be able to see your reach or audience analytics.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <Banknote size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-cream font-bold text-[14px]">Monetization tools</p>
              <p className="text-muted text-[12.5px]">You'll lose access to any earning and payout features.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <Globe size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-cream font-bold text-[14px]">Public Audience</p>
              <p className="text-muted text-[12.5px]">Your profile will revert to private (matches only).</p>
            </div>
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={busy}
          className="w-full h-12 rounded-full bg-red-500 text-white font-bold text-[14.5px] mb-3 disabled:opacity-50 active:bg-red-600"
        >
          {busy ? 'Turning off…' : 'Turn off creator mode'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full h-12 rounded-full bg-white/[0.06] text-cream font-bold text-[14.5px] disabled:opacity-50 active:bg-white/[0.1]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
`;

// Inject it right before CategorySheet
const anchor = 'function CategorySheet({ current, onSelect, onCancel }) {';
if (!src.includes(anchor)) {
  console.error("❌ Could not find CategorySheet anchor. Aborting.");
  process.exit(1);
}

src = src.replace(anchor, confirmOffComponent + '\n' + anchor);

// Ensure the icons are imported
if (!src.includes('Globe')) {
  src = src.replace("import { ArrowLeft", "import { ArrowLeft, Globe, Banknote");
}

fs.writeFileSync(file, src);
console.log('✅ Created Facebook-standard ConfirmOff warning modal.');

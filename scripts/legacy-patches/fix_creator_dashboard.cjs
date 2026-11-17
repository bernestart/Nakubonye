const fs = require('fs');
const file = 'src/screens/CreatorMode.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the broken dashOpen modal
content = content.replace('{dashOpen && <CreatorDashboard onClose={() => setDashOpen(false)} />}', '');

// 2. Pass myId to ActiveView
content = content.replace('<ActiveView \n', '<ActiveView myId={myId}\n');
content = content.replace('<ActiveView onTurnOff', '<ActiveView myId={myId} onTurnOff');

// 3. Fix the ActiveView signature
content = content.replace(
  'function ActiveView({ onTurnOff, category, onEditCategory }) {',
  'function ActiveView({ onTurnOff, category, onEditCategory, myId }) {'
);

// 4. Replace the "Coming Soon" box with the Live Dashboard
const oldBox = `      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-purple-300" />
          <p className="text-[12px] font-bold text-purple-300 uppercase tracking-wide">
            Coming soon
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <SameRow text="Creator dashboard — reach, growth, audience" muted />
          <SameRow text="Moderation tools — comment filters, keyword blocks" muted />
          <SameRow text="Monetization eligibility" muted />
        </div>
      </div>`;

const newBox = `      {/* LIVE CREATOR DASHBOARD */}
      {myId && <CreatorDashboard myId={myId} />}
      
      {/* Moderation Tools placeholder */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 mb-4">
        <SameRow text="Moderation tools — comment filters, keyword blocks" muted />
      </div>`;

if (content.includes(oldBox)) {
  content = content.replace(oldBox, newBox);
} else {
  // Fallback if whitespace is different
  const fallbackBox = '<SameRow text="Creator dashboard — reach, growth, audience" muted />';
  if (content.includes(fallbackBox)) {
    content = content.replace(fallbackBox, '{myId && <CreatorDashboard myId={myId} />}');
  }
}

fs.writeFileSync(file, content);
console.log('✅ Fixed CreatorMode.jsx (Dashboard is now live)');

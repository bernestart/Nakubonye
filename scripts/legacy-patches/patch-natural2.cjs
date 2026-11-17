const fs = require('fs');
let n = 0;
function apply(s, find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  console.log('✅', label);
  n++;
  return s.replace(find, replace);
}

// ============ A. CreatorOnboarding.jsx ============
{
  const p = 'src/screens/CreatorOnboarding.jsx';
  let s = fs.readFileSync(p, 'utf8');

  // 1. Better framing — anchor tighter to top so full heads show
  s = apply(s,
`      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ objectPosition: 'center 15%' }} />`,
`      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ objectPosition: 'center 30%' }} />`,
  'onboarding: framing shift (center 30%)');

  // 2. Remove purple wash → natural photo + only bottom fade
  s = apply(s,
`      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(76,29,149,0.55) 0%, rgba(124,58,237,0.35) 55%, rgba(167,139,250,0.15) 100%)',
        }}
      />
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 60px rgba(11,11,20,0.55)' }} />`,
`      <div
        className="absolute inset-x-0 bottom-0 h-20"
        style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.55) 100%)' }}
      />`,
  'onboarding: natural photo, dark bottom fade');

  fs.writeFileSync(p, s);
}

// ============ B. CreatorMode.jsx ============
{
  const p = 'src/screens/CreatorMode.jsx';
  let s = fs.readFileSync(p, 'utf8');

  // Entry photo — remove purple wash
  s = apply(s,
`        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(76,29,149,0.10) 0%, rgba(76,29,149,0.60) 100%)' }}
        />
      </div>`,
`        <div
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }}
        />
      </div>`,
  'entry: natural photo');

  // Active photo — remove purple wash
  s = apply(s,
`        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(76,29,149,0.10) 0%, rgba(76,29,149,0.60) 100%)' }}
        />
      </div>`,
`        <div
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }}
        />
      </div>`,
  'active: natural photo');

  fs.writeFileSync(p, s);
}

console.log(`\n✅ ${n} edits applied total`);

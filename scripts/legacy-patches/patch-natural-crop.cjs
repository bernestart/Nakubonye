const fs = require('fs');
let n = 0;
function apply(s, find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  console.log('✅', label);
  n++;
  return s.replace(find, replace);
}

// ============ A. CreatorOnboarding.jsx — PhotoIllustration ============
{
  const p = 'src/screens/CreatorOnboarding.jsx';
  let s = fs.readFileSync(p, 'utf8');

  s = apply(s,
`      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '320px' }}
    >
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ objectPosition: 'top center' }} />`,
`      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)' }}
    >
      <img src={src} alt="" className="w-full h-auto block" />`,
  'onboarding: show full photo, no crop');

  fs.writeFileSync(p, s);
}

// ============ B. CreatorMode.jsx — entry + active photos ============
{
  const p = 'src/screens/CreatorMode.jsx';
  let s = fs.readFileSync(p, 'utf8');

  // Entry photo
  s = apply(s,
`      <div className="relative w-full h-56 rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/entry.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'top center' }}
        />`,
`      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/entry.jpg"
          alt=""
          className="w-full h-auto block"
        />`,
  'mode: entry full photo');

  // Active photo
  s = apply(s,
`      <div className="relative w-full h-56 rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/finish.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'top center' }}
        />`,
`      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/finish.jpg"
          alt=""
          className="w-full h-auto block"
        />`,
  'mode: active full photo');

  fs.writeFileSync(p, s);
}

console.log(`\n✅ ${n} edits applied`);

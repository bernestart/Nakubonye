const fs = require('fs');

// ============ A. CreatorOnboarding.jsx ============
{
  const p = 'src/screens/CreatorOnboarding.jsx';
  let s = fs.readFileSync(p, 'utf8');
  let n = 0;
  function apply(find, replace, label) {
    if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,160))); process.exit(1); }
    s = s.replace(find, replace); console.log('✅', label); n++;
  }

  // 1. Photo: taller, faces anchor
  apply(
`      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '288px' }}
    >
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />`,
`      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '320px' }}
    >
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ objectPosition: 'center 15%' }} />`,
  'photo taller + faces visible');

  // 2. Bottom padding so content isn't cut off
  // Try both possible container shapes
  const c1 = `<div className="flex-1 overflow-y-auto pb-6" style={{ paddingLeft: '20px', paddingRight: '20px', overflowX: 'hidden' }}>`;
  const c2 = `<div className="flex-1 overflow-y-auto" style={{ paddingLeft: '20px', paddingRight: '20px', overflowX: 'hidden' }}>`;
  const c3 = `<div className="flex-1 overflow-y-auto px-5 pb-6">`;
  if (s.includes(c1)) {
    s = s.replace(c1, `<div className="flex-1 overflow-y-auto" style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '160px', overflowX: 'hidden' }}>`);
    console.log('✅ padding fix (c1)'); n++;
  } else if (s.includes(c2)) {
    s = s.replace(c2, `<div className="flex-1 overflow-y-auto" style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '160px', overflowX: 'hidden' }}>`);
    console.log('✅ padding fix (c2)'); n++;
  } else if (s.includes(c3)) {
    s = s.replace(c3, `<div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: '160px' }}>`);
    console.log('✅ padding fix (c3)'); n++;
  } else {
    console.error('❌ no container found');
    console.error('   run: grep -n "overflow-y-auto" src/screens/CreatorOnboarding.jsx');
    process.exit(1);
  }

  fs.writeFileSync(p, s);
  console.log(`\n✅ CreatorOnboarding.jsx — ${n} edits`);
}

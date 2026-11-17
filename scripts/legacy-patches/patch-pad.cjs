const fs = require('fs');
const p = 'src/screens/CreatorOnboarding.jsx';
let s = fs.readFileSync(p, 'utf8');

// Find the scroll container and add bottom padding
const find = `<div className="flex-1 overflow-y-auto pb-6" style={{ paddingLeft: '20px', paddingRight: '20px', overflowX: 'hidden' }}>`;
const replace = `<div className="flex-1 overflow-y-auto" style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '140px', overflowX: 'hidden' }}>`;

if (!s.includes(find)) {
  // try alternative shapes
  const alt = `<div className="flex-1 overflow-y-auto px-5 pb-6">`;
  if (s.includes(alt)) {
    s = s.replace(alt, `<div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: '140px' }}>`);
    console.log('✅ padding fix applied (alt)');
  } else {
    console.error('❌ container not found — paste output of:');
    console.error('   grep -n "overflow-y-auto" src/screens/CreatorOnboarding.jsx');
    process.exit(1);
  }
} else {
  s = s.replace(find, replace);
  console.log('✅ padding fix applied');
}

fs.writeFileSync(p, s);

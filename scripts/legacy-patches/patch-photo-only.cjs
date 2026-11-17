const fs = require('fs');
const p = 'src/screens/CreatorOnboarding.jsx';
let s = fs.readFileSync(p, 'utf8');

const find = `      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '288px' }}
    >
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />`;

const replace = `      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '320px' }}
    >
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ objectPosition: 'center 15%' }} />`;

if (!s.includes(find)) { console.error('❌ anchor not found'); process.exit(1); }
s = s.replace(find, replace);
fs.writeFileSync(p, s);
console.log('✅ photo taller + faces anchored');

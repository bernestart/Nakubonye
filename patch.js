const fs = require('fs');
const p = 'index.html';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('viewport-fit=cover')) {
  c = c.replace('<meta name="viewport"', '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
  fs.writeFileSync(p, c);
  console.log('✅ Added viewport-fit=cover to index.html');
} else {
  console.log('ℹ️ viewport-fit already set.');
}

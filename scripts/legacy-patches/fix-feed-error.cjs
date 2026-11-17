const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

const brokenBlock = `    if (rpcErr) {
      console.error("Ranked feed failed, falling back to chronological:", rpcErr);
    }`;

if (code.includes(brokenBlock)) {
  code = code.replace(brokenBlock, '');
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Removed the ghost rpcErr block!");
} else {
  console.log("❌ ERROR: Could not find the broken block. It might have a slightly different spacing.");
}

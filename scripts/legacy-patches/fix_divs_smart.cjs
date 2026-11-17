const fs = require('fs');
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Find the Share button
const shareStr = "<Share2 size={14} /> {copied ? 'Copied' : 'Share'}";
const shareIdx = content.indexOf(shareStr);

if (shareIdx === -1) {
  console.error("❌ Could not find Share button");
  process.exit(1);
}

// 2. Find the end of the Share button tag
const shareBtnEnd = content.indexOf('</button>', shareIdx) + '</button>'.length;

// 3. Find the Highlights comment
const highlightsStr = '{/* Highlights */}';
const highlightsIdx = content.indexOf(highlightsStr, shareBtnEnd);

if (highlightsIdx === -1) {
  console.error("❌ Could not find Highlights comment");
  process.exit(1);
}

// 4. Replace everything between the Share button and Highlights with exactly 2 closing divs
const newBlock = `
          </div>
        </div>

        `;

content = content.substring(0, shareBtnEnd) + newBlock + content.substring(highlightsIdx);

fs.writeFileSync(file, content);
console.log('✅ Successfully cleaned up the closing tags before Highlights');

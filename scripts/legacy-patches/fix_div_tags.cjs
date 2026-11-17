const fs = require('fs');
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// The current broken state has 3 closing </div> tags before {/* Highlights */}
const brokenBlock = `          </div>
        </div>
          </div>
        </div>

        {/* Highlights */}`;

const fixedBlock = `          </div>
        </div>

        {/* Highlights */}`;

if (content.includes(brokenBlock)) {
  content = content.replace(brokenBlock, fixedBlock);
  fs.writeFileSync(file, content);
  console.log('✅ Fixed: Removed extra </div> tag');
} else {
  // Fallback: match any 3+ consecutive closing divs followed by Highlights
  const regex = /(<\/div>\s*<\/div>)\s*<\/div>\s*<\/div>\s*(\{\/\* Highlights \*\/\})/;
  if (regex.test(content)) {
    content = content.replace(regex, `$1\n\n        $2`);
    fs.writeFileSync(file, content);
    console.log('✅ Fixed with regex fallback');
  } else {
    console.error('❌ Could not find the broken block. Please share the exact lines 345-355.');
  }
}

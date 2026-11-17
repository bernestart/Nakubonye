#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/screens/Search.jsx';
let src = fs.readFileSync(FILE, 'utf8');

// Use a regex to find the empty state block, ignoring whitespace variations
const emptyStateRegex = /(\{\/\* Empty state \(no query yet\) \*\/\}\s*\{!isSearching\s*&&\s*\(\s*<>)/;

if (!emptyStateRegex.test(src)) {
  console.error('❌ Could not find the empty state block with regex.');
  process.exit(1);
}

const trendingBlock = `
          {trendingTags.length > 0 && (
            <div className="mb-5">
              <h3 className="text-cream font-bold text-[15px] mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-400" /> Trending
              </h3>
              <div className="flex flex-wrap gap-2">
                {trendingTags.slice(0, 8).map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => { tap("light"); setQuery(tag); runSearch(tag) }}
                    className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-cream text-[13px] font-semibold active:bg-white/[0.1]"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
`;

// Replace the match, injecting the trending block right after the `<>`
src = src.replace(emptyStateRegex, `$1${trendingBlock}`);

fs.writeFileSync(FILE, src);
console.log('✅ Patched Search.jsx with trending UI (using regex).');

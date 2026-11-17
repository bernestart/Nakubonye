const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

// Find the "Reels rail" block and remove it entirely
const startMarker = `            {/* Reels rail */}`;
const startIdx = s.indexOf(startMarker);
if (startIdx < 0) { console.error("reels rail start not found"); process.exit(1); }

// The block ends with the matching closing brace before the fragment closes: `            )}\n          </>`
// Search for the pattern that ends the rail: a `)}` followed by blank line then `          </>`
const endMarker = `            )}
          </>
        )}`;
const endIdx = s.indexOf(endMarker, startIdx);
if (endIdx < 0) { console.error("reels rail end not found"); process.exit(1); }

// Remove from startMarker through (but not including) `          </>`
s = s.slice(0, startIdx) + `          </>` + s.slice(endIdx + endMarker.length - `          </>`.length);
fs.writeFileSync(p, s);
console.log("reels rail removed");

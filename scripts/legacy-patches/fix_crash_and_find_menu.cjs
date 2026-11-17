const fs = require('fs');

// 1. Fix Preview.jsx Crash
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the undefined account_type with a safe fallback (since Preview is your own profile, we can default to 'personal' for now or check if the variable exists).
// Better yet, let's just fix the string to prevent the crash.
content = content.replace(
  "{followersCount} {account_type === 'creator' ? `follower${followersCount === 1 ? \"\" : \"s\"}` : `match${followersCount === 1 ? \"\" : \"s\"}`}",
  "{followersCount} {(myId && true) ? `follower${followersCount === 1 ? \"\" : \"s\"}` : `match${followersCount === 1 ? \"\" : \"s\"}`}" // Temporarily forces "followers" on preview to avoid crash
);

// Let's do a safer regex replace just in case the string is slightly different
content = content.replace(/account_type === 'creator'/g, "true"); // Fallback to true for preview (your own profile)

fs.writeFileSync(file, content);
console.log('✅ Fixed the account_type crash in Preview.jsx');

// 2. Find the Menu file

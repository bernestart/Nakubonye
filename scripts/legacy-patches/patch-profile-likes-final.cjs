const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// Look for the exact line where the profile counts are saved
const target = `setProfileReactionCounts(counts)`;
const replacement = `
    // FIX: Override empty Supabase counts with Cloudflare Redis counts
    personal.forEach((p) => {
      if (typeof p.likes_count !== 'undefined') {
        counts.set("personal:" + p.id, p.likes_count);
      }
    });

    setProfileReactionCounts(counts)`;

if (code.includes(target)) {
  if (!code.includes("Override empty Supabase counts")) {
    code = code.replace(target, replacement);
    fs.writeFileSync(file, code);
    console.log("✅ SUCCESS: ProfileView likes merged with Cloudflare!");
  } else {
    console.log("ℹ️ Already patched.");
  }
} else {
  console.log("❌ ERROR: Could not find setProfileReactionCounts(counts).");
}

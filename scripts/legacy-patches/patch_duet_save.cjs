const fs = require('fs');
const file = 'src/components/ReelComposer.jsx';
let content = fs.readFileSync(file, 'utf8');

// The anchor from the recon output
const anchor = 'const { error: insErr } = await supabase.from("reels").insert({\n      user_id: myId,';
const replacement = 'const { error: insErr } = await supabase.from("reels").insert({\n      user_id: myId,\n      remix_of: remixOf?.id || null,';

if (content.includes(anchor)) {
  content = content.replace(anchor, replacement);
  fs.writeFileSync(file, content);
  console.log('✅ Successfully saved Remix relationship in ReelComposer.jsx!');
} else {
  // Fallback if whitespace is slightly different
  const altAnchor = 'user_id: myId,';
  if (content.includes(altAnchor) && !content.includes('remix_of: remixOf?.id')) {
    content = content.replace(altAnchor, `user_id: myId,\n      remix_of: remixOf?.id || null,`);
    fs.writeFileSync(file, content);
    console.log('✅ Successfully saved Remix relationship (fallback method)!');
  } else {
    console.error('❌ Could not find the insert payload anchor.');
  }
}

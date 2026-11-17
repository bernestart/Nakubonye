const fs = require('fs');

// ==========================================
// 1. PATCH PROFILEVIEW.JSX
// ==========================================
let pv = fs.readFileSync('src/screens/ProfileView.jsx', 'utf8');

// Replace the hardcoded "follower" with dynamic "Match" vs "Follower"
const oldFollowerText = '{followersCount} follower{followersCount === 1 ? "" : "s"}';
const newFollowerText = '{followersCount} {person.account_type === \'creator\' ? `follower${followersCount === 1 ? "" : "s"}` : `match${followersCount === 1 ? "" : "es"}`}';

if (pv.includes(oldFollowerText)) {
  pv = pv.replace(oldFollowerText, newFollowerText);
  console.log('✅ Patched ProfileView.jsx: follower -> match/follower');
}

// Pass account_type to MutualConnections component
// Find where MutualConnections is rendered and add the prop
const mutualRenderRegex = /<MutualConnections\s+userId=\{userId\}\s+myId=\{myId\}\s*\/>/;
if (pv.match(mutualRenderRegex)) {
  pv = pv.replace(mutualRenderRegex, '<MutualConnections userId={userId} myId={myId} accountType={person.account_type} />');
  console.log('✅ Passed account_type to MutualConnections');
}

fs.writeFileSync('src/screens/ProfileView.jsx', pv);

// ==========================================
// 2. PATCH MATCHES.JSX
// ==========================================
let mj = fs.readFileSync('src/screens/Matches.jsx', 'utf8');

// 1. Ensure we fetch account_type in the profile queries
// (Assuming a generic select for profiles)
mj = mj.replace(/\.select\('id, display_name, username, is_verified'\)/g, ".select('id, display_name, username, is_verified, account_type')");
mj = mj.replace(/\.select\("id, display_name, username, is_verified"\)/g, '.select("id, display_name, username, is_verified, account_type")');

// 2. Replace the "mutual connection" text with dynamic "mutual match" vs "mutual follower"
const mutualText1 = '{u.mutuals > 0 ? `${u.mutuals} mutual connection${u.mutuals === 1 ? \'\' : \'s\'}` : (u.city || \'Suggested for you\')}';
const newMutualText1 = '{u.mutuals > 0 ? `${u.mutuals} mutual ${u.account_type === \'creator\' ? \'follower\' : \'match\'}${u.mutuals === 1 ? \'\' : \'s\'}` : (u.city || \'Suggested for you\')}';

const mutualText2 = '{mc > 0 ? `${mc} mutual connection${mc === 1 ? \'\' : \'s\'}` : (m.city ? `📍 ${m.city}` : \'Matched\')}';
const newMutualText2 = '{mc > 0 ? `${mc} mutual ${m.account_type === \'creator\' ? \'follower\' : \'match\'}${mc === 1 ? \'\' : \'s\'}` : (m.city ? `📍 ${m.city}` : \'Matched\')}';

if (mj.includes(mutualText1)) {
  mj = mj.replace(mutualText1, newMutualText1);
  console.log('✅ Patched Matches.jsx (Suggested): mutual connection -> mutual match/follower');
}
if (mj.includes(mutualText2)) {
  mj = mj.replace(mutualText2, newMutualText2);
  console.log('✅ Patched Matches.jsx (Match list): mutual connection -> mutual match/follower');
}

fs.writeFileSync('src/screens/Matches.jsx', mj);

// ==========================================
// 3. PATCH MUTUALCONNECTIONS.JSX
// ==========================================
let mc = fs.readFileSync('src/components/MutualConnections.jsx', 'utf8');

// Update the component signature to accept accountType
mc = mc.replace(
  'export default function MutualConnections({ userId, myId }) {',
  'export default function MutualConnections({ userId, myId, accountType }) {'
);

// If there is hardcoded text "Mutual Connections" in the UI, swap it dynamically
// Looking at typical UI, it might say "Mutual Connections" or "X mutual connections"
mc = mc.replace(/>Mutual Connections</g, '>{accountType === \'creator\' ? \'Mutual Followers\' : \'Mutual Matches\'}<');
mc = mc.replace(/mutual connection/g, 'mutual ${accountType === \'creator\' ? \'follower\' : \'match\'}');

fs.writeFileSync('src/components/MutualConnections.jsx', mc);
console.log('✅ Patched MutualConnections.jsx with dynamic text');

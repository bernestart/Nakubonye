const fs = require('fs');
const p = 'src/screens/Feed.jsx';

if (!fs.existsSync(p)) {
  console.error('❌ ABORT: Feed.jsx not found.');
  process.exit(1);
}

let s = fs.readFileSync(p, 'utf8');
let changed = false;

// 1. Add API_BASE_URL to the existing import
const apiImport = "import { getRankedFeed, getCommunityPosts, toggleLikeAPI } from '../lib/api';";
const apiImportNew = "import { getRankedFeed, getCommunityPosts, toggleLikeAPI, API_BASE_URL } from '../lib/api';";
if (s.includes(apiImport)) {
  s = s.replace(apiImport, apiImportNew);
  changed = true;
}

// 2. Replace fetchRankingSignals using exact anchors
const startAnchor = 'async function fetchRankingSignals(myId) {';
const endAnchor = 'import BottomNav';

const startIdx = s.indexOf(startAnchor);
const endIdx = s.indexOf(endAnchor);

if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
  const newFunc = `async function fetchRankingSignals(myId) {
  if (!myId) return { interactions: new Map(), reelAffinity: 1 };
  try {
    // BFF PATTERN: Single request for all ranking signals
    const res = await fetch(\`\${API_BASE_URL}/api/feed/bootstrap?userId=\${myId}\`);
    const json = await res.json();
    return { interactions: new Map(), reelAffinity: 1, boot: json.data || {} };
  } catch (err) {
    console.warn("Bootstrap signals offline", err);
    return { interactions: new Map(), reelAffinity: 1, boot: {} };
  }
}

`;
  s = s.substring(0, startIdx) + newFunc + s.substring(endIdx);
  changed = true;
} else {
  console.error('❌ ABORT: Could not find exact fetchRankingSignals anchors. No changes written.');
  process.exit(1);
}

// 3. Safely neutralize the Promise.all Supabase calls (lines 735-737, etc.)
// We replace the exact lines to prevent syntax breaks.
const safePromises = [
  'supabase.from("matches").select("user_one_id, user_two_id").or("user_one_id.eq." + myId + ",user_two_id.eq." + myId),',
  'supabase.from("follows").select("following_id").eq("follower_id", myId),',
  'supabase.from("circle_members").select("circle_id").eq("user_id", myId).limit(100),',
  'supabase.from("blocks").select("blocker_id, blocked_id").or("blocker_id.eq." + myId + ",blocked_id.eq." + myId),'
];
const safeReplacement = 'Promise.resolve({ data: [] }),';

for (const anchor of safePromises) {
  if (s.includes(anchor)) {
    s = s.split(anchor).join(safeReplacement);
    changed = true;
  }
}

// 4. Neutralize mute queries (lines 1164-1165)
const muteAnchors = [
  'supabase.from("muted_words").select("word").eq("user_id", myId),',
  'supabase.from("user_mutes").select("muted_id").eq("muter_id", myId),'
];
for (const anchor of muteAnchors) {
  if (s.includes(anchor)) {
    s = s.split(anchor).join(safeReplacement);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(p, s, 'utf8');
  console.log('✅ Phase 1.6 Feed patch applied successfully.');
} else {
  console.log('⚠️ No changes were needed or anchors were already replaced.');
}

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DASH = '\u2014';
const read  = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);

function mustReplace(src, needle, replacement, label) {
  const count = src.split(needle).length - 1;
  if (count === 0) throw new Error(`[${label}] anchor not found`);
  if (count > 1)   throw new Error(`[${label}] anchor not unique (${count} matches)`);
  return src.replace(needle, replacement);
}
function mustCount(src, needle, expected, label) {
  const c = src.split(needle).length - 1;
  if (c !== expected) throw new Error(`[${label}] expected ${expected}, got ${c}`);
}

// ================= Patch 1: auth.jsx =================
let auth = read('src/lib/auth.jsx');
mustCount(auth, "cover_photo_path')", 3, 'auth-selects-pre');
auth = auth.split("cover_photo_path')").join("cover_photo_path, account_type, category_label')");
mustCount(auth, "account_type, category_label')", 3, 'auth-selects-post');
write('src/lib/auth.jsx', auth);

// ================= Patch 2: Preview.jsx =================
let pv = read('src/screens/Preview.jsx');

// 2a — destructure refreshProfile
pv = mustReplace(pv,
  "const { session, profile: authProfile } = useAuth()",
  "const { session, profile: authProfile, refreshProfile } = useAuth()",
  '2a');

// 2b — delete dead accountType state
pv = mustReplace(pv,
  "  const [accountType, setAccountType] = useState(null)\n",
  "",
  '2b');

// 2c — null-init counters
pv = mustReplace(pv,
  "  const [followersCount, setFollowersCount] = useState(0)\n  const [followingCount, setFollowingCount] = useState(0)\n  const [matchesCount, setMatchesCount] = useState(0)\n",
  "  const [followersCount, setFollowersCount] = useState(null)\n  const [followingCount, setFollowingCount] = useState(null)\n  const [matchesCount, setMatchesCount] = useState(null)\n",
  '2c');

// 2d — handleToggleCreatorMode
pv = mustReplace(pv,
`  async function handleToggleCreatorMode() {
    if (!myId) return;
    const isCurrentlyCreator = accountType === 'creator';
    const newState = !isCurrentlyCreator;
    const { error } = await supabase.rpc('toggle_creator_mode', { p_enable: newState });
    if (error) {
      alert("Failed to toggle Creator Mode: " + error.message);
      return;
    }
    setAccountType(newState ? 'creator' : 'personal');
    // authProfile might need a refresh, but local state handles the UI
  }`,
`  async function handleToggleCreatorMode() {
    if (!myId) return;
    const isCurrentlyCreator = profile?.account_type === 'creator';
    const newState = !isCurrentlyCreator;
    const { error } = await supabase.rpc('toggle_creator_mode', { p_enable: newState });
    if (error) {
      alert("Failed to toggle Creator Mode: " + error.message);
      return;
    }
    await refreshProfile();
  }`,
  '2d');

// 2e — mount-time refresh
pv = mustReplace(pv,
  "  useEffect(() => { load() }, [load])",
`  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!myId) return
    refreshProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])`,
  '2e');

// 2f — Dashboard button condition
pv = mustReplace(pv,
  "{(accountType === 'creator' || profile?.account_type === 'creator') && (",
  "{profile?.account_type === 'creator' && (",
  '2f');

// 2g — ProfileMenuSheet prop
pv = mustReplace(pv,
  "        accountType={accountType}",
  "        accountType={profile?.account_type ?? null}",
  '2g');

// 2h — null-safe stat rendering
pv = mustReplace(pv,
  "{followersCount} {(myId && true)",
  `{followersCount ?? '${DASH}'} {(myId && true)`,
  '2h-followers');
pv = mustReplace(pv,
  "{followingCount} following",
  `{followingCount ?? '${DASH}'} following`,
  '2h-following');

write('src/screens/Preview.jsx', pv);

// ================= Final verify =================
const fa = read('src/lib/auth.jsx');
const fp = read('src/screens/Preview.jsx');

if ((fa.match(/account_type, category_label/g) || []).length !== 3) throw new Error('VERIFY: auth selects');
if (fp.includes("accountType, setAccountType")) throw new Error('VERIFY: accountType state not removed');
if (fp.includes("accountType === 'creator'"))    throw new Error('VERIFY: old condition remains');
if (!fp.includes("profile?.account_type === 'creator'")) throw new Error('VERIFY: new condition missing');
if (!fp.includes("await refreshProfile()"))      throw new Error('VERIFY: refreshProfile call missing');
if (!fp.includes(`followersCount ?? '${DASH}'`)) throw new Error('VERIFY: null-safe followers missing');
if (!fp.includes(`followingCount ?? '${DASH}'`)) throw new Error('VERIFY: null-safe following missing');

console.log('OK — auth.jsx: 3 selects patched');
console.log('OK — Preview.jsx: 8 replacements applied + verified');
console.log('Next: npm run build');

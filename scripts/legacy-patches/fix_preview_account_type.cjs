const fs = require('fs');
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for account_type
const stateAnchor = 'const [profileLocal, setProfile] = useState(null)';
if (!content.includes('const [accountType, setAccountType]')) {
  content = content.replace(
    stateAnchor,
    `${stateAnchor}\n  const [accountType, setAccountType] = useState(null)`
  );
}

// 2. Add the fetch logic inside a useEffect (we'll hook into the existing fetch or create a new one)
// The file already has useEffect for fetching data, so let's add a standalone one for account_type
const fetchAnchor = 'useEffect(() => {\n    if (!myId) return';
const fetchLogic = `useEffect(() => {
    if (!myId) return;
    supabase.from('profiles').select('account_type, category_label').eq('id', myId).single()
      .then(({ data }) => {
        if (data) setAccountType(data.account_type);
      });
  }, [myId]);

  useEffect(() => {
    if (!myId) return`;

if (!content.includes('setAccountType(data.account_type)')) {
  content = content.replace(fetchAnchor, fetchLogic);
}

// 3. Add Sparkles import
if (!content.includes('Sparkles')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react"/, (match, p1) => {
    return `import { ${p1}, Sparkles } from "lucide-react"`;
  });
}

// 4. Inject the Creator Dashboard Button next to "Edit profile"
const editBtnAnchor = '<Edit size={14} /> Edit profile';
// We'll find the container and add the button
const editBtnRegex = /<button[\s\S]*?onClick=\{\(\) => \{ tap\('light'\); nav\('\/settings\/profile'\) \}\}[\s\S]*?<Edit size=\{14\} \/> Edit profile[\s\S]*?<\/button>/;

const newButtons = `{accountType === 'creator' && (
                <button onClick={() => { tap('light'); nav('/creator-dashboard') }} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 active:scale-95 transition-transform">
                  <Sparkles size={14} /> Dashboard
                </button>
              )}
              <button onClick={() => { tap('light'); nav('/settings/profile') }} className="flex-1 h-10 rounded-xl bg-white/[0.06] border border-white/10 text-cream font-bold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Edit size={14} /> Edit profile
              </button>`;

if (content.match(editBtnRegex) && !content.includes('Dashboard</button>')) {
  content = content.replace(editBtnRegex, newButtons);
  console.log('✅ Injected Creator Dashboard button next to Edit Profile');
} else {
  console.log('⚠️ Could not find exact Edit profile button or button already exists.');
}

fs.writeFileSync(file, content);
console.log('✅ Added account_type fetch to Preview.jsx');

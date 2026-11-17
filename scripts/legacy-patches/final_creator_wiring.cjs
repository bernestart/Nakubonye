const fs = require('fs');
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add the toggle function
const stateAnchor = 'const [menuOpen, setMenuOpen] = useState(false)';
const toggleFn = `const [menuOpen, setMenuOpen] = useState(false)

  async function handleToggleCreatorMode() {
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
  }`;

if (!content.includes('handleToggleCreatorMode')) {
  content = content.replace(stateAnchor, toggleFn);
}

// 2. Inject the Dashboard Button above the Edit/Share row
const actionBtnAnchor = `{/* Own action buttons */}
        <div className="flex items-center gap-2 mt-4 px-4">`;

const newActionLayout = `{/* Own action buttons */}
        <div className="flex flex-col gap-2 mt-4 px-4">
          {accountType === 'creator' && (
            <button
              onClick={() => { tap('light'); nav('/creator-dashboard') }}
              className="w-full h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 active:scale-[0.98] transition-transform"
            >
              <Sparkles size={16} /> Creator Dashboard
            </button>
          )}
          <div className="flex items-center gap-2">`;

if (content.includes(actionBtnAnchor)) {
  content = content.replace(actionBtnAnchor, newActionLayout);
  
  // Close the newly opened flex div right before the Highlights comment
  const highlightsAnchor = `        {/* Highlights */}`;
  content = content.replace(highlightsAnchor, `          </div>\n        </div>\n\n${highlightsAnchor}`);
  console.log('✅ Injected Creator Dashboard button into Preview.jsx');
}

// 3. Ensure Sparkles is imported
if (!content.includes('Sparkles')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react"/, (match, p1) => {
    return `import { ${p1}, Sparkles } from "lucide-react"`;
  });
}

// 4. Pass props to ProfileMenuSheet
const menuSheetAnchor = '<ProfileMenuSheet \n        open={menuOpen}';
// We need to find the exact render of ProfileMenuSheet
const menuRegex = /<ProfileMenuSheet[\s\S]*?\/>/;
const currentMenu = content.match(menuRegex)?.[0];

if (currentMenu && !currentMenu.includes('accountType')) {
  const newMenu = currentMenu.replace('<ProfileMenuSheet', '<ProfileMenuSheet \n        accountType={accountType}\n        onToggleCreatorMode={handleToggleCreatorMode}');
  content = content.replace(currentMenu, newMenu);
  console.log('✅ Passed Creator Mode props to ProfileMenuSheet');
}

fs.writeFileSync(file, content);

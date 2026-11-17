const fs = require('fs');

// 1. Recreate the missing CreatorDashboardScreen.jsx
const screenCode = `import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import CreatorDashboard from "../components/CreatorDashboard"

export default function CreatorDashboardScreen() {
  const nav = useNavigate()
  const { session } = useAuth()
  
  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0B14] flex flex-col max-w-[480px] mx-auto">
      <header className="h-14 flex items-center px-4 border-b border-white/8 shrink-0">
        <button onClick={() => { tap("light"); nav(-1) }} className="w-10 h-10 rounded-full grid place-items-center text-muted">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-cream font-bold text-[16px] ml-2">Creator Dashboard</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <CreatorDashboard myId={session?.user?.id} />
      </div>
    </div>
  )
}`;
fs.writeFileSync('src/screens/CreatorDashboardScreen.jsx', screenCode);
console.log('✅ Recreated CreatorDashboardScreen.jsx with correct vocabulary');

// 2. Fix the Settings Menu Toggle
let ps = fs.readFileSync('src/screens/ProfileSettings.jsx', 'utf8');
ps = ps.replace(/label="Professional Mode"/g, 'label="Creator Mode"');
fs.writeFileSync('src/screens/ProfileSettings.jsx', ps);
console.log('✅ Reverted Settings toggle to "Creator Mode"');

// 3. Fix the Profile Button
let pv = fs.readFileSync('src/screens/ProfileView.jsx', 'utf8');
pv = pv.replace(/Professional Dashboard/g, 'Creator Dashboard');
fs.writeFileSync('src/screens/ProfileView.jsx', pv);
console.log('✅ Reverted Profile button to "Creator Dashboard"');

// 4. Verify Routing in App.jsx
let app = fs.readFileSync('src/App.jsx', 'utf8');
if (!app.includes('CreatorDashboardScreen')) {
  app = app.replace(
    "import CreatorMode from './screens/CreatorMode'",
    "import CreatorMode from './screens/CreatorMode'\nimport CreatorDashboardScreen from './screens/CreatorDashboardScreen'"
  );
  app = app.replace(
    '<Route path="/settings/creator"',
    '<Route path="/creator-dashboard" element={<Guard><CreatorDashboardScreen /></Guard>} />\n        <Route path="/settings/creator"'
  );
  fs.writeFileSync('src/App.jsx', app);
  console.log('✅ Fixed App.jsx routing');
} else {
  console.log('✅ App.jsx routing already correct');
}

const fs = require('fs');

// ==========================================
// 1. OVERWRITE CREATOR DASHBOARD (FB Style)
// ==========================================
const dashboardCode = `import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Check, Lock, TrendingUp, Users, Coins, Award, Loader2, Play, Clock } from "lucide-react"
import { tap } from "../lib/haptic"

const GATE_ICONS = {
  followers: Users,
  watch_minutes: Clock,
  qualified_views: Play,
  recent_posts: TrendingUp,
  account_age: Check,
  unique_viewers: Users,
  clean_days: Check
}

export default function CreatorDashboard({ myId }) {
  const [activeTab, setActiveTab] = useState("progress")
  const [loading, setLoading] = useState(true)
  const [progression, setProgression] = useState(null)
  const [monetization, setMonetization] = useState(null)
  
  useEffect(() => {
    async function load() {
      if (!myId) return
      setLoading(true)
      const [progRes, monetRes] = await Promise.all([
        supabase.rpc('get_my_progression_levels'),
        supabase.rpc('get_my_monetization_status')
      ])
      if (!progRes.error) setProgression(progRes.data)
      if (!monetRes.error) setMonetization(monetRes.data)
      setLoading(false)
    }
    load()
  }, [myId])

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-purple-400" /></div>

  const gates = monetization?.eligibility?.gates || []
  const allGatesMet = gates.length > 0 && gates.every(g => g.passed)

  return (
    <div className="flex flex-col gap-4 mt-6">
      {/* TABS */}
      <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/8">
        <button onClick={() => { setActiveTab("progress"); tap("light"); }} className={\`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all \${activeTab === "progress" ? "bg-purple-500/20 text-purple-300" : "text-muted"}\`}>
          Progression
        </button>
        <button onClick={() => { setActiveTab("monetize"); tap("light"); }} className={\`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all \${activeTab === "monetize" ? "bg-purple-500/20 text-purple-300" : "text-muted"}\`}>
          Monetization
        </button>
      </div>

      {/* PROGRESSION TAB */}
      {activeTab === "progress" && progression && (
        <div className="flex flex-col gap-4">
          <div className="bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/30 rounded-3xl p-5 text-center">
            <Award className="text-purple-400 mx-auto mb-2" size={32} />
            <h2 className="text-white font-extrabold text-[20px]">Level {progression.current_level}</h2>
            <p className="text-purple-300 text-[12px] font-semibold mt-1">Creator Progression</p>
          </div>

          {progression.levels.map((lvl) => (
            <div key={lvl.level} className={\`rounded-2xl border p-4 \${lvl.level === progression.current_level ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/8 bg-white/[0.03] opacity-60'}\`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-cream font-bold text-[14px]">Level {lvl.level}: {lvl.name}</h3>
                {lvl.level < progression.current_level && <Check size={18} className="text-green-400" />}
                {lvl.level > progression.current_level && <Lock size={16} className="text-muted" />}
              </div>
              <div className="flex flex-col gap-2">
                {lvl.tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={\`w-4 h-4 rounded-full border grid place-items-center \${task.done ? 'bg-green-500 border-green-500' : 'border-white/20'}\`}>
                      {task.done && <Check size={10} className="text-white" />}
                    </div>
                    <span className={\`text-[13px] \${task.done ? 'text-muted line-through' : 'text-cream'}\`}>{task.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MONETIZATION TAB (FB Style) */}
      {activeTab === "monetize" && monetization && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">Total Earnings</p>
                <p className="text-cream font-extrabold text-[24px] leading-none">{(monetization.unlock_paths?.current?.lifetime_coins || 0).toLocaleString()} <span className="text-muted text-[13px]">coins</span></p>
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 grid place-items-center">
                <Coins size={22} className="text-white" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-4">Eligibility Gates</p>
            <div className="flex flex-col gap-4">
              {gates.map(gate => {
                const Icon = GATE_ICONS[gate.key] || Check
                return (
                  <div key={gate.key}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={gate.passed ? "text-green-400" : "text-muted"} />
                        <span className={\`text-[12.5px] font-semibold \${gate.passed ? "text-green-400" : "text-cream"}\`}>{gate.label}</span>
                      </div>
                      <span className="text-[11.5px] font-bold text-muted">
                        {gate.current.toLocaleString()} / {gate.target_display}
                      </span>
                    </div>
                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div className={\`h-full rounded-full \${gate.passed ? 'bg-green-500' : 'bg-purple-500'}\`} style={{ width: \`\${Math.min(100, gate.pct)}%\` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* FACEBOOK STYLE APPLY BUTTON */}
          <button 
            disabled={!allGatesMet}
            className={\`w-full h-12 rounded-full font-bold text-[14px] flex items-center justify-center gap-2 \${allGatesMet ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/30 active:scale-95" : "bg-white/[0.05] text-muted border border-white/10"}\`}
          >
            {allGatesMet ? "Apply for Monetization" : "Gates Locked"} {!allGatesMet && <Lock size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}
`;
fs.writeFileSync('src/components/CreatorDashboard.jsx', dashboardCode);
console.log('✅ Overwrote CreatorDashboard.jsx (FB Style)');

// ==========================================
// 2. PATCH PROFILE VOCABULARY (Matches vs Followers)
// ==========================================
let pv = fs.readFileSync('src/screens/ProfileView.jsx', 'utf8');
// Replace hardcoded "follower" text with dynamic match/follower logic
pv = pv.replace(
  /{followersCount} follower{followersCount === 1 \? "" : "s"}/g,
  `{followersCount} {person.account_type === 'creator' ? \`follower\${followersCount === 1 ? "" : "s"}\` : \`match\${followersCount === 1 ? "" : "s"}\`}`
);
fs.writeFileSync('src/screens/ProfileView.jsx', pv);
console.log('✅ Patched ProfileView.jsx (Matches vs Followers)');

let prev = fs.readFileSync('src/screens/Preview.jsx', 'utf8');
prev = prev.replace(
  /{followersCount} follower{followersCount === 1 \? "" : "s"}/g,
  `{followersCount} {account_type === 'creator' ? \`follower\${followersCount === 1 ? "" : "s"}\` : \`match\${followersCount === 1 ? "" : "s"}\`}`
);
fs.writeFileSync('src/screens/Preview.jsx', prev);
console.log('✅ Patched Preview.jsx (Matches vs Followers)');


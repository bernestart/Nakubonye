const fs = require('fs');

// ==========================================
// 1. OVERWRITE CREATOR DASHBOARD
// ==========================================
const dashboardCode = `import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Check, Lock, TrendingUp, Users, Coins, Sparkles, Award, Loader2 } from "lucide-react"
import { tap } from "../lib/haptic"

export default function CreatorDashboard({ myId }) {
  const [activeTab, setActiveTab] = useState("progress")
  const [loading, setLoading] = useState(true)
  
  // Progression State
  const [progression, setProgression] = useState(null)
  
  // Monetization State
  const [monetization, setMonetization] = useState(null)
  const [tasks, setTasks] = useState(null)
  
  useEffect(() => {
    async function load() {
      if (!myId) return
      setLoading(true)
      const [progRes, monetRes, taskRes] = await Promise.all([
        supabase.rpc('get_my_progression_levels'),
        supabase.rpc('get_my_monetization_status'),
        supabase.rpc('get_my_tasks')
      ])
      
      if (!progRes.error) setProgression(progRes.data)
      if (!monetRes.error) setMonetization(monetRes.data)
      if (!taskRes.error) setTasks(taskRes.data)
      
      setLoading(false)
    }
    load()
  }, [myId])

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-purple-400" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
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

      {/* MONETIZATION TAB */}
      {activeTab === "monetize" && monetization && (
        <div className="flex flex-col gap-4">
          {/* WALLET */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">Your Wallet</p>
                <p className="text-cream font-extrabold text-[24px] leading-none">{(monetization.unlock_paths?.current?.lifetime_coins || 0).toLocaleString()} <span className="text-muted text-[13px]">coins</span></p>
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 grid place-items-center">
                <Coins size={22} className="text-white" />
              </div>
            </div>
          </div>

          {/* 7 GATES */}
          {monetization.eligibility?.gates && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
              <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">Eligibility Gates</p>
              <div className="flex flex-col gap-3">
                {monetization.eligibility.gates.map(gate => (
                  <div key={gate.key}>
                    <div className="flex justify-between text-[11.5px] font-semibold mb-1">
                      <span className={gate.passed ? "text-green-400" : "text-cream"}>{gate.label}</span>
                      <span className="text-muted">{gate.current.toLocaleString()} / {gate.target_display}</span>
                    </div>
                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div className={\`h-full rounded-full \${gate.passed ? 'bg-green-500' : 'bg-purple-500'}\`} style={{ width: \`\${Math.min(100, gate.pct)}%\` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TASKS */}
          {tasks && tasks.tasks && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
               <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">Earn Coins</p>
               {tasks.tasks.map(t => (
                 <div key={t.key} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                   <span className={\`text-[13px] \${t.done ? 'text-muted line-through' : 'text-cream'}\`}>{t.label}</span>
                   <span className="text-amber-300 text-[12px] font-bold">+{t.reward}</span>
                 </div>
               ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
`;
fs.writeFileSync('src/components/CreatorDashboard.jsx', dashboardCode);
console.log('✅ Created clean CreatorDashboard.jsx with Tabs');

// ==========================================
// 2. FIX CREATOR MODE (Replace ActiveView)
// ==========================================
const file = 'src/screens/CreatorMode.jsx';
let content = fs.readFileSync(file, 'utf8');

const fixedActiveView = `// ---------- Active view (creator mode is on) ----------
function ActiveView({ onTurnOff, category, onEditCategory, myId }) {
  return (
    <>
      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img src="/illustrations/finish.jpg" alt="" className="w-full h-auto block" />
        <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }} />
      </div>

      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-4 grid place-items-center -mt-16 relative z-10" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)', border: '3px solid #0B0B14' }}>
          <Sparkles size={36} className="text-white" strokeWidth={2.2} />
        </div>
        <h2 className="text-cream font-extrabold text-[20px] mb-2">Creator mode is on</h2>
        <p className="text-muted text-[13.5px] leading-relaxed px-4">Your profile is public-facing. Anyone can follow you and discover your posts.</p>
      </div>

      {/* LIVE CREATOR DASHBOARD */}
      {myId && <CreatorDashboard myId={myId} />}

      {/* Category Button */}
      <button onClick={onEditCategory} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/8 mb-3 mt-6 active:bg-white/[0.05]">
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center text-purple-300"><Tag size={16} /></span>
          <span className="flex flex-col items-start">
            <span className="text-cream font-semibold text-[13.5px]">Category</span>
            <span className="text-muted text-[11.5px]">{category || 'Choose what best describes you'}</span>
          </span>
        </span>
        <ChevronRight size={16} className="text-muted" />
      </button>

      {/* Turn Off Button */}
      <button onClick={onTurnOff} className="w-full h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[14px] active:bg-red-500/20 transition-colors mb-6">
        Turn off Creator Mode
      </button>
    </>
  )
}

`;

// Regex to replace from the comment to the CREATOR_CATEGORIES array
const regex = /\/\/ ---------- Active view[\s\S]*?const CREATOR_CATEGORIES = \[/;
if (regex.test(content)) {
  content = content.replace(regex, fixedActiveView + 'const CREATOR_CATEGORIES = [');
  fs.writeFileSync(file, content);
  console.log('✅ Fixed ActiveView and restored missing buttons!');
} else {
  console.error('❌ Could not find the ActiveView block to replace.');
}

const fs = require('fs');
const file = 'src/components/CreatorDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add the Insights button to the Tab bar
const tabAnchor = `<button onClick={() => { setActiveTab("monetize"); tap("light"); }} className={\`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all \${activeTab === "monetize" ? "bg-purple-500/20 text-purple-300" : "text-muted"}\`}>
          Monetization
        </button>`;

const newTabs = `<button onClick={() => { setActiveTab("monetize"); tap("light"); }} className={\`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all \${activeTab === "monetize" ? "bg-purple-500/20 text-purple-300" : "text-muted"}\`}>
          Monetization
        </button>
        <button onClick={() => { setActiveTab("insights"); tap("light"); }} className={\`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all \${activeTab === "insights" ? "bg-purple-500/20 text-purple-300" : "text-muted"}\`}>
          Insights
        </button>`;

if (!content.includes('>Insights</button>')) {
  content = content.replace(tabAnchor, newTabs);
}

// 2. Add the Insights Tab Content
const insightsContent = `
      {/* INSIGHTS TAB */}
      {activeTab === "insights" && monetization && (
        <div className="flex flex-col gap-4">
          <div className="bg-white/[0.03] border border-white/8 rounded-3xl p-5">
            <h3 className="text-cream font-extrabold text-[16px] mb-4">Channel Overview</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <p className="text-purple-400 text-[11px] font-bold uppercase tracking-wider mb-1">Followers</p>
                <p className="text-cream text-[24px] font-black">{(monetization?.unlock_paths?.current?.followers || 0).toLocaleString()}</p>
              </div>
              
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <p className="text-blue-400 text-[11px] font-bold uppercase tracking-wider mb-1">Watch Mins</p>
                <p className="text-cream text-[24px] font-black">{(monetization?.unlock_paths?.current?.watch_minutes || 0).toLocaleString()}</p>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <p className="text-pink-400 text-[11px] font-bold uppercase tracking-wider mb-1">Coins Earned</p>
                <p className="text-cream text-[24px] font-black">{(monetization?.unlock_paths?.current?.lifetime_coins || 0).toLocaleString()}</p>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <p className="text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1">Qualified Views</p>
                <p className="text-cream text-[24px] font-black">{(gates.find(g => g.key === 'qualified_views')?.current || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <p className="text-center text-muted text-[11.5px]">Insights update daily based on your audience activity.</p>
        </div>
      )}
    </div>
  )
}
`;

// Replace the last closing tags of the component
const endAnchor = `      )}
    </div>
  )
}`;
if (!content.includes('Channel Overview')) {
  content = content.replace(endAnchor, insightsContent);
  fs.writeFileSync(file, content);
  console.log('✅ Added Insights Tab to CreatorDashboard');
} else {
  console.log('⚠️ Insights Tab already exists.');
}

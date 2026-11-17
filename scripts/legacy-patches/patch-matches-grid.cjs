const fs = require("fs");
const p = "src/screens/Matches.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Add currentList computation before the render
const computeAnchor = `      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">`;
if (!s.includes(computeAnchor)) { console.error("grid container anchor missing"); process.exit(1); }
if (!s.includes("const currentList")) {
  s = s.replace(computeAnchor, `      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {(() => { return null })()}
        {/* currentList computed inline */}`);
  // Actually let's add it before the outer div
  const actualAnchor = `      {error && (`;
  s = s.replace(actualAnchor, `      {(() => {
        const currentList = activeTab === 'matches' ? matches : activeTab === 'likes' ? likes : sentLikes
        if (false) return null
        return null
      })()}

${actualAnchor}`);
}

// Better approach — just replace the map source and card structure directly
// Remove the hacky IIFE we might have added
s = s.replace(`      {(() => {
        const currentList = activeTab === 'matches' ? matches : activeTab === 'likes' ? likes : sentLikes
        if (false) return null
        return null
      })()}

`, "");

s = s.replace(`      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {(() => { return null })()}
        {/* currentList computed inline */}`, `      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">`);

// 2. Replace the grid map
const oldMap = `        ) : (
          <div className="grid grid-cols-2 gap-3">
            {matches.map((m) => (
              <motion.div                                         key={m.match_id}`;

const newMap = `        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(activeTab === 'matches' ? matches : activeTab === 'likes' ? likes : sentLikes).map((m) => (
              <motion.div                                         key={m.user_id}`;

if (!s.includes(oldMap)) { console.error("grid map anchor missing"); process.exit(1); }
s = s.replace(oldMap, newMap);

// 3. Adapt the card — swap the message button for tab-appropriate action
const oldAction = `                <button                                             onClick={() => { tap('medium'); nav('/messages/' + m.user_id) }}
                  className="absolute bottom-2 right-2 w-9 h-9 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_6px_18px_rgba(124,58,237,0.55)]"
                  aria-label="Message"
                >                                                   <MessageCircle size={15} strokeWidth={2.5} className="text-white" />
                </button>`;

const newAction = `                {activeTab === 'matches' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); tap('medium'); nav('/messages/' + m.user_id) }}
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_6px_18px_rgba(124,58,237,0.55)]"
                    aria-label="Message"
                  >
                    <MessageCircle size={15} strokeWidth={2.5} className="text-white" />
                  </button>
                )}
                {activeTab === 'likes' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); tap('medium'); nav('/profile/' + m.user_id) }}
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full grid place-items-center"
                    style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)', boxShadow: '0 6px 18px rgba(236,72,153,0.55)' }}
                    aria-label="Like back"
                  >
                    <Heart size={15} strokeWidth={2.5} className="text-white" fill="currentColor" />
                  </button>
                )}
                {activeTab === 'sent' && (
                  <span
                    className="absolute bottom-2 right-2 px-2 h-7 rounded-full grid place-items-center text-white text-[10.5px] font-bold"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    Sent
                  </span>
                )}`;

if (!s.includes(oldAction)) { console.error("action button missing"); process.exit(1); }
s = s.replace(oldAction, newAction);

// 4. Handle age that might be undefined for likes/sent
s = s.replace(`                      {m.display_name || m.username || 'Someone'}
                      {m.age ? \`, \${m.age}\` : ''}`, `                      {m.display_name || m.username || 'Someone'}
                      {m.age ? \`, \${m.age}\` : ''}`);

fs.writeFileSync(p, s);
console.log("matches grid wired per tab");

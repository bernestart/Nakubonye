const fs = require("fs");
const p = "src/screens/Matches.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Add state
const stateAnchor = `  const [matches, setMatches] = useState([])`;
if (!s.includes(stateAnchor)) { console.error("matches state missing"); process.exit(1); }
if (!s.includes("activeTab")) {
  s = s.replace(stateAnchor, `  const [activeTab, setActiveTab] = useState('matches')
  const [likes, setLikes] = useState([])
  const [sentLikes, setSentLikes] = useState([])
${stateAnchor}`);
}

// 2. Add RPC import check for get_likes_received usage
// We'll load likes + sent in the same load() function after setMatches

const setMatchesAnchor = `    }).filter(Boolean))
    setLoading(false)
  }, [session?.user?.id])`;
if (!s.includes(setMatchesAnchor)) { console.error("setMatches anchor missing"); process.exit(1); }

if (!s.includes("setLikes(")) {
  s = s.replace(setMatchesAnchor, `    }).filter(Boolean))

    // === Load "who liked me" (received likes) ===
    const { data: likesData } = await supabase.rpc('get_likes_received', { p_limit: 60 })
    const receivedList = (likesData || []).map((r) => ({
      user_id: r.id,
      display_name: r.display_name,
      username: r.username,
      is_verified: r.is_verified,
      photo_url: publicPhotoUrl(r.primary_photo),
      liked_at: r.liked_at,
    }))
    setLikes(receivedList)

    // === Load "who I liked" (sent likes) ===
    const { data: sentRows } = await supabase
      .from('likes')
      .select('liked_user_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60)

    let sentList = []
    if (sentRows && sentRows.length > 0) {
      const sentIds = sentRows.map((r) => r.liked_user_id)
      const { data: sentProfs } = await supabase
        .from('profiles')
        .select('id, display_name, username, is_verified')
        .in('id', sentIds)

      const { data: sentPhotos } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', sentIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })

      const spMap = new Map()
      ;(sentPhotos || []).forEach((ph) => { if (!spMap.has(ph.user_id)) spMap.set(ph.user_id, ph.storage_path) })
      const sprofMap = new Map((sentProfs || []).map((p) => [p.id, p]))

      sentList = sentRows.map((r) => {
        const p2 = sprofMap.get(r.liked_user_id)
        if (!p2) return null
        return {
          user_id: p2.id,
          display_name: p2.display_name,
          username: p2.username,
          is_verified: p2.is_verified,
          photo_url: publicPhotoUrl(spMap.get(p2.id)),
          sent_at: r.created_at,
        }
      }).filter(Boolean)
    }
    setSentLikes(sentList)

    setLoading(false)
  }, [session?.user?.id])`);
}

// 3. Replace header block — add tabs under the title
const oldHeader = `      <div className="px-4 pb-3 shrink-0">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">
          Your connections
        </p>
        <h1 className="text-cream text-[22px] font-extrabold tracking-tight">
          It's a match <Heart size={18} fill="currentColor" className="inline text-pink-500" />
        </h1>
        <p className="text-muted text-[13px] mt-0.5">
          People who liked you back.
        </p>
      </div>`;

const newHeader = `      <div className="px-4 pb-3 shrink-0">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">
          Your connections
        </p>
        <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-3">
          It's a match <Heart size={18} fill="currentColor" className="inline text-pink-500" />
        </h1>

        {/* Tab switcher */}
        <div className="flex bg-white/[0.04] rounded-2xl p-1 gap-1">
          {[
            { id: 'matches', label: 'Matches', count: matches.length },
            { id: 'likes',   label: 'Likes',   count: likes.length },
            { id: 'sent',    label: 'Sent',    count: sentLikes.length },
          ].map((t) => {
            const on = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { tap('light'); setActiveTab(t.id) }}
                className="flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-[12.5px] font-bold transition-all"
                style={{
                  background: on
                    ? 'linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(168,85,247,0.22) 100%)'
                    : 'transparent',
                  color: on ? '#fff' : '#888',
                  boxShadow: on ? '0 2px 8px rgba(168,85,247,0.3), inset 0 0 0 1px rgba(196,181,253,0.35)' : 'none',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className="px-1.5 rounded-full text-[10.5px] font-black"
                    style={{
                      background: on ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                      color: on ? '#fff' : '#999',
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>`;

if (!s.includes(oldHeader)) { console.error("header block missing"); process.exit(1); }
s = s.replace(oldHeader, newHeader);

// 4. Replace the grid render block — swap between tabs
const oldGrid = `        ) : matches.length === 0 ? (
          <Empty onGo={() => nav('/discover')} />
        ) : (
          <div className="grid grid-cols-2 gap-3">`;

if (!s.includes(oldGrid)) { console.error("grid start missing"); process.exit(1); }
// We'll keep the grid structure but change what populates it later — first mark the change point
s = s.replace(oldGrid, `        ) : (activeTab === 'matches' ? matches : activeTab === 'likes' ? likes : sentLikes).length === 0 ? (
          <Empty onGo={() => nav('/discover')} tab={activeTab} />
        ) : (
          <div className="grid grid-cols-2 gap-3">`);

fs.writeFileSync(p, s);
console.log("matches tabs wired");

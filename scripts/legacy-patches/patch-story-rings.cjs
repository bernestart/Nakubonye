const fs = require('fs')
const p = 'src/screens/Messages.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. State
const ST = `  const [onlineUsers, setOnlineUsers] = useState([])`
if (!s.includes(ST)) throw new Error('onlineUsers state anchor missing')
if (!s.includes('storyOwners'))
  s = s.replace(ST, ST + `
  const [storyOwners, setStoryOwners] = useState(new Set())
  const [viewedStoryOwners, setViewedStoryOwners] = useState(new Set())`)

// 2. Fetch stories alongside other data — insert after setOnlineUsers
const ONLINE_END = `    setOnlineUsers(visibleOnline)`
if (!s.includes(ONLINE_END)) throw new Error('onlineUsers set anchor missing')
if (!s.includes('story_views'))
  s = s.replace(ONLINE_END, `${ONLINE_END}

    // Active stories from people in my inbox (DMs + groups not included)
    const dmUserIds = [...new Set(items.map((x) => x.userId).filter(Boolean))]
    let owners = new Set()
    let viewedOwners = new Set()
    if (dmUserIds.length > 0) {
      const { data: storyRows } = await supabase
        .from("stories")
        .select("id, user_id")
        .in("user_id", dmUserIds)
        .gt("expires_at", new Date().toISOString())
      const storyIds = (storyRows || []).map((r) => r.id)
      ;(storyRows || []).forEach((r) => owners.add(r.user_id))

      if (storyIds.length > 0) {
        const { data: viewRows } = await supabase
          .from("story_views")
          .select("story_id")
          .eq("user_id", userId)
          .in("story_id", storyIds)
        const viewedIds = new Set((viewRows || []).map((v) => v.story_id))
        // Group story ids by owner
        const byOwner = new Map()
        ;(storyRows || []).forEach((r) => {
          if (!byOwner.has(r.user_id)) byOwner.set(r.user_id, [])
          byOwner.get(r.user_id).push(r.id)
        })
        byOwner.forEach((ids, owner) => {
          if (ids.every((id) => viewedIds.has(id))) viewedOwners.add(owner)
        })
      }
    }
    setStoryOwners(owners)
    setViewedStoryOwners(viewedOwners)`)

// 3. Wrap the avatar in a story ring
const AVATAR_OLD = `                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/8">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : item.isGroup ? (
                      <div className="w-full h-full grid place-items-center text-purple-400">
                        <Users size={22} />
                      </div>
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xl font-black text-purple-400">
                        {(item.display_name || '?')[0]}
                      </div>
                    )}
                  </div>
                  {!item.isGroup && item.last_seen_at && isOnline(item.last_seen_at, 3) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0B14]" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.9)" }} />
                  )}
                </div>`

if (!s.includes(AVATAR_OLD)) throw new Error('avatar anchor missing')

const AVATAR_NEW = `                <div className="relative shrink-0">
                  {(() => {
                    const hasStory = !item.isGroup && storyOwners.has(item.userId)
                    const storyViewed = hasStory && viewedStoryOwners.has(item.userId)
                    const ringStyle = hasStory
                      ? storyViewed
                        ? "2px solid rgba(255,255,255,0.15)"
                        : "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box"
                      : "1px solid rgba(255,255,255,0.08)"
                    return (
                      <div className="w-14 h-14 rounded-full p-[2px]"
                           style={hasStory ? { background: ringStyle, border: "2px solid transparent" } : {}}>
                        <div className="w-full h-full rounded-full overflow-hidden bg-elevated"
                             style={!hasStory ? { border: ringStyle } : {}}>
                          {item.photo_url ? (
                            <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : item.isGroup ? (
                            <div className="w-full h-full grid place-items-center text-purple-400">
                              <Users size={22} />
                            </div>
                          ) : (
                            <div className="w-full h-full grid place-items-center text-xl font-black text-purple-400">
                              {(item.display_name || '?')[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  {!item.isGroup && item.last_seen_at && isOnline(item.last_seen_at, 3) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0B14]" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.9)" }} />
                  )}
                </div>`

s = s.replace(AVATAR_OLD, AVATAR_NEW)

fs.writeFileSync(p, s)
console.log('OK story rings added')

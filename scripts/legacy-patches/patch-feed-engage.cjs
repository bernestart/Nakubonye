const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Import PostCommentsSheet + Bookmark icon
const importAnchor = `import StoriesRow from "../components/StoriesRow"`;
if (!s.includes(importAnchor)) { console.error("StoriesRow import missing"); process.exit(1); }
if (!s.includes("PostCommentsSheet")) {
  s = s.replace(importAnchor, importAnchor + `\nimport PostCommentsSheet from "../components/PostCommentsSheet"`);
}
const oldLucide = `import { ImagePlus, Heart, Send, X, Users, Play, Camera, PenSquare, Video, Image as ImageIcon } from "lucide-react"`;
if (!s.includes(oldLucide)) { console.error("lucide import missing"); process.exit(1); }
s = s.replace(oldLucide, `import { ImagePlus, Heart, Send, X, Users, Play, Camera, PenSquare, Video, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react"`);

// 2. Add state
const stateAnchor = `  const [reelsRail, setReelsRail] = useState([])`;
if (!s.includes(stateAnchor)) { console.error("reelsRail state missing"); process.exit(1); }
if (!s.includes("myReactions")) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [myReactions, setMyReactions] = useState(new Set())\n  const [reactionCounts, setReactionCounts] = useState(new Map())\n  const [commentCounts, setCommentCounts] = useState(new Map())\n  const [commentsFor, setCommentsFor] = useState(null)`);
}

// 3. Load reactions + comment counts in load()
const loadEndAnchor = `    setReelsRail(reelRows || [])`;
if (!s.includes(loadEndAnchor)) { console.error("reelsRail load missing"); process.exit(1); }
if (!s.includes("community_post_reactions")) {
  s = s.replace(loadEndAnchor, loadEndAnchor + `

    // Load reactions for these posts
    const postIds = list.map((r) => r.id)
    if (postIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("community_post_reactions")
        .select("post_id, user_id")
        .in("post_id", postIds)

      const mine = new Set()
      const counts = new Map()
      ;(reactRows || []).forEach((r) => {
        counts.set(r.post_id, (counts.get(r.post_id) || 0) + 1)
        if (r.user_id === myId) mine.add(r.post_id)
      })
      setMyReactions(mine)
      setReactionCounts(counts)

      // Comment counts
      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", postIds)
      const cc = new Map()
      ;(commentRows || []).forEach((c) => cc.set(c.post_id, (cc.get(c.post_id) || 0) + 1))
      setCommentCounts(cc)
    }`);
}

// 4. Add toggleLike function — before the return
const toggleAnchor = `  return (`;
if (!s.includes(toggleAnchor)) { console.error("return anchor missing"); process.exit(1); }
if (!s.includes("async function toggleLike")) {
  s = s.replace(toggleAnchor, `  async function toggleLike(postId) {
    if (!myId) return
    tap("light")
    const isLiked = myReactions.has(postId)
    const nextMine = new Set(myReactions)
    const nextCounts = new Map(reactionCounts)
    if (isLiked) {
      nextMine.delete(postId)
      nextCounts.set(postId, Math.max(0, (nextCounts.get(postId) || 1) - 1))
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      await supabase.from("community_post_reactions").delete().eq("post_id", postId).eq("user_id", myId)
    } else {
      nextMine.add(postId)
      nextCounts.set(postId, (nextCounts.get(postId) || 0) + 1)
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      await supabase.from("community_post_reactions").insert({ post_id: postId, user_id: myId, reaction: "❤️" })
    }
  }

  async function sharePost(p) {
    tap("light")
    const url = window.location.origin + "/communities/" + p.community_id
    if (navigator.share) {
      try { await navigator.share({ title: "Nakubonye", url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); alert("Link copied!") } catch {}
    }
  }

${toggleAnchor}`);
}

// 5. Replace the footer actions with the full engagement bar
const oldFooter = `                {/* Footer actions */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-t border-white/5">
                  <button
                    onClick={() => { tap("light"); nav("/communities/" + p.community_id) }}
                    className="flex items-center gap-1.5 text-muted text-[12px] font-semibold"
                  >
                    <Heart size={14} /> View in community
                  </button>
                </div>`;

const newFooter = `                {/* Engagement bar */}
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/5">
                  <button
                    onClick={() => toggleLike(p.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <Heart
                      size={18}
                      strokeWidth={2.2}
                      color={myReactions.has(p.id) ? "#EC4899" : "#888"}
                      fill={myReactions.has(p.id) ? "#EC4899" : "none"}
                    />
                    <span
                      className="text-[12.5px] font-bold"
                      style={{ color: myReactions.has(p.id) ? "#EC4899" : "#888" }}
                    >
                      {reactionCounts.get(p.id) || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { tap("light"); setCommentsFor(p.id) }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <MessageCircle size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">
                      {commentCounts.get(p.id) || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => sharePost(p)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <Share2 size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">Share</span>
                  </button>
                </div>`;

if (!s.includes(oldFooter)) { console.error("footer block missing"); process.exit(1); }
s = s.replace(oldFooter, newFooter);

// 6. Render comments sheet
const bottomNavAnchor = `      <BottomNav />`;
if (!s.includes(bottomNavAnchor)) { console.error("BottomNav anchor missing"); process.exit(1); }
if (!s.includes("<PostCommentsSheet")) {
  s = s.replace(bottomNavAnchor, `      {commentsFor && (
        <PostCommentsSheet
          postId={commentsFor}
          onClose={() => setCommentsFor(null)}
          onCountChange={(n) => {
            setCommentCounts((prev) => {
              const next = new Map(prev)
              next.set(commentsFor, n)
              return next
            })
          }}
        />
      )}

${bottomNavAnchor}`);
}

fs.writeFileSync(p, s);
console.log("engagement bar wired");

const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

// ---- 1. Add state: cursor, hasMore, loadingMore, sentinelRef ----
const stateAnchor = `  const [suggested, setSuggested] = useState([])`;
if (!s.includes(stateAnchor)) { console.error("suggested state missing"); process.exit(1); }
if (!s.includes("const [hasMore")) {
  s = s.replace(stateAnchor, stateAnchor + `
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef(null)`);
}

// ---- 2. Reduce initial page size from 60 to 12 ----
const oldLimit = `      .order("created_at", { ascending: false })
      .limit(60)`;
if (!s.includes(oldLimit)) { console.error("limit(60) block missing"); process.exit(1); }
s = s.replace(oldLimit, `      .order("created_at", { ascending: false })
      .limit(12)`);

// ---- 3. After setPosts(list), set cursor + hasMore ----
const oldSetPosts = `    const list = rows || []
    setPosts(list)`;
if (!s.includes(oldSetPosts)) { console.error("setPosts anchor missing"); process.exit(1); }
if (!s.includes("setCursor(")) {
  s = s.replace(oldSetPosts, `    const list = rows || []
    setPosts(list)
    setHasMore(list.length === 12)
    setCursor(list.length > 0 ? list[list.length - 1].created_at : null)`);
}

// ---- 4. Insert loadMore() and IntersectionObserver AFTER the load() function closes ----
const loadClose = `    setLoading(false)
  }, [myId])`;
if (!s.includes(loadClose)) { console.error("load close anchor missing"); process.exit(1); }
if (!s.includes("async function loadMore")) {
  s = s.replace(loadClose, loadClose + `

  // ---- Infinite scroll: fetch next page ----
  const loadMore = useCallback(async () => {
    if (!myId || loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)
    const myCommIds = [...communities.keys()]
    if (myCommIds.length === 0) { setLoadingMore(false); return }

    const { data: rows } = await supabase
      .from("community_posts")
      .select("id, community_id, author_id, content, image_path, created_at, pinned_until")
      .in("community_id", myCommIds)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(12)

    const newPosts = rows || []
    if (newPosts.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    // Load profiles + photos for new post authors
    const ids = [...new Set(newPosts.map((r) => r.author_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", ids)
      setProfiles((prev) => {
        const next = new Map(prev)
        ;(profs || []).forEach((p) => next.set(p.id, p))
        return next
      })

      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      setPhotos((prev) => {
        const next = new Map(prev)
        ;(ph || []).forEach((p) => { if (!next.has(p.user_id)) next.set(p.user_id, p.storage_path) })
        return next
      })
    }

    // Reactions + comment counts for the new posts
    const postIds = newPosts.map((r) => r.id)
    if (postIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("community_post_reactions")
        .select("post_id, user_id")
        .in("post_id", postIds)
      setMyReactions((prev) => {
        const next = new Set(prev)
        ;(reactRows || []).forEach((r) => { if (r.user_id === myId) next.add(r.post_id) })
        return next
      })
      setReactionCounts((prev) => {
        const next = new Map(prev)
        ;(reactRows || []).forEach((r) => next.set(r.post_id, (next.get(r.post_id) || 0) + 1))
        return next
      })

      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", postIds)
      setCommentCounts((prev) => {
        const next = new Map(prev)
        ;(commentRows || []).forEach((c) => next.set(c.post_id, (next.get(c.post_id) || 0) + 1))
        return next
      })
    }

    setPosts((prev) => [...prev, ...newPosts])
    setCursor(newPosts[newPosts.length - 1].created_at)
    setHasMore(newPosts.length === 12)
    setLoadingMore(false)
  }, [myId, loadingMore, hasMore, cursor, communities])

  // ---- Sentinel observer: trigger loadMore when bottom approaches ----
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore()
    }, { rootMargin: "300px" })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])`);
}

// ---- 5. Add sentinel + loading indicator at the bottom of the posts stream ----
const bottomNavAnchor = `      <BottomNav />`;
if (!s.includes(bottomNavAnchor)) { console.error("BottomNav anchor missing"); process.exit(1); }
if (!s.includes("sentinelRef")) {
  console.error("sentinel ref never inserted - abort");
  process.exit(1);
}
// Insert the sentinel INSIDE the scroll area — right before closing </div> of the posts stream
// Find the closing pattern: `          })\n        )}\n      </div>\n\n      <BottomNav />`
const postsClose = `          })
        )}
      </div>

      <BottomNav />`;
if (!s.includes(postsClose)) { console.error("posts close anchor missing"); process.exit(1); }
if (!s.includes('data-sentinel')) {
  s = s.replace(postsClose, `          })
        )}

        {/* Infinite scroll sentinel */}
        {loadingMore && (
          <div className="grid place-items-center py-6">
            <div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-subtle text-[12px] py-6">
            You're all caught up ✨
          </p>
        )}
        <div ref={sentinelRef} data-sentinel style={{ height: 1 }} />
      </div>

      <BottomNav />`);
}

fs.writeFileSync(p, s);
console.log("infinite scroll wired");

import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, Search as SearchIcon, X, Users, FileText, Play, Store,
  Briefcase, MessageCircle, TrendingUp, MapPin, Heart, Clock,
} from "lucide-react"
import VerifiedBadge from "../components/VerifiedBadge"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

const RECENT_KEY = "search_recent_v1"

const TABS = [
  { id: "top",         label: "Top" },
  { id: "people",      label: "People" },
  { id: "posts",       label: "Posts" },
  { id: "reels",       label: "Reels" },
  { id: "communities", label: "Communities" },
  { id: "marketplace", label: "Marketplace" },
  { id: "services",    label: "Services" },
]

export default function Search() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [query, setQuery] = useState("")
  const [tab, setTab] = useState("top")
  const [loading, setLoading] = useState(false)

  const [people, setPeople] = useState([])
  const [posts, setPosts] = useState([])
  const [reels, setReels] = useState([])
  const [communities, setCommunities] = useState([])
  const [listings, setListings] = useState([])
  const [services, setServices] = useState([])

  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") } catch { return [] }
  })
  const [suggestedPeople, setSuggestedPeople] = useState([])
  const [suggestedCommunities, setSuggestedCommunities] = useState([])
  const [trendingTags, setTrendingTags] = useState([])
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false)

  const runSearch = useCallback(async (q) => {
    const term = q.trim()
    if (term.length < 2) {
      setPeople([]); setPosts([]); setReels([])
      setCommunities([]); setListings([]); setServices([])
      setLoading(false)
      return
    }
    setLoading(true)
    const like = `%${term}%`

    const [
      pRes, upRes, cpRes, rRes, cRes, lRes, sRes,
    ] = await Promise.all([
      // People — by name or username
      supabase
        .from("profiles")
        .select("id, display_name, username, is_verified, city")
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .eq("is_active", true)
        .limit(20),

      // Personal posts — text match
      supabase
        .from("user_posts")
        .select("id, user_id, content, image_path, created_at")
        .ilike("content", like)
        .eq("is_active", true)
        .eq("audience", "public")
        .order("created_at", { ascending: false })
        .limit(15),

      // Community posts
      supabase
        .from("community_posts")
        .select("id, author_id, community_id, content, image_path, created_at")
        .ilike("content", like)
        .order("created_at", { ascending: false })
        .limit(15),

      // Reels — by caption
      supabase
        .from("reels")
        .select("id, user_id, caption, thumbnail_url, video_url, created_at")
        .ilike("caption", like)
        .eq("is_active", true)
        .eq("audience", "public")
        .order("created_at", { ascending: false })
        .limit(15),

      // Communities — by name
      supabase
        .from("communities")
        .select("id, name, emoji, cover_color, member_count")
        .ilike("name", like)
        .eq("is_active", true)
        .limit(15),

      // Listings — by title
      supabase
        .from("listings")
        .select("id, title, price, currency, image_paths, location, created_at")
        .ilike("title", like)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(15),

      // Services — by title
      supabase
        .from("services")
        .select("id, title, price, currency, duration_minutes, image_paths, created_at")
        .ilike("title", like)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(15),
    ])

    // Load photos for people
    const userList = pRes.data || []
    if (userList.length > 0) {
      const { data: photos } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", userList.map((u) => u.id))
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const map = new Map()
      ;(photos || []).forEach((p) => { if (!map.has(p.user_id)) map.set(p.user_id, p.storage_path) })
      userList.forEach((u) => { u.photo_url = publicPhotoUrl(map.get(u.id)) })
    }

    // Merge posts (personal + community)
    const mergedPosts = [
      ...(upRes.data || []).map((p) => ({ ...p, _source: "personal", author_id: p.user_id })),
      ...(cpRes.data || []).map((p) => ({ ...p, _source: "community" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20)

    setPeople(userList)
    setPosts(mergedPosts)
    setReels(rRes.data || [])
    setCommunities(cRes.data || [])
    setListings(lRes.data || [])
    setServices(sRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function commitRecent(label) {
    if (!label) return
    const next = [label, ...recent.filter((x) => x !== label)].slice(0, 8)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
  }
  function clearRecent() {
    setRecent([])
    try { localStorage.removeItem(RECENT_KEY) } catch {}
  }

  function openUser(u) { tap("light"); commitRecent(u.display_name || u.username); nav("/profile/" + u.id) }
  function openCommunity(c) { tap("light"); commitRecent(c.name); nav("/communities/" + c.id) }
  function openListing(l) { tap("light"); commitRecent(l.title); nav("/marketplace/" + l.id) }
  function openService(s) { tap("light"); commitRecent(s.title); nav("/services/" + s.id) }
  function openReel(r) { tap("light"); nav("/reels") }
  function openPost(p) {
    tap("light")
    if (p._source === "community") nav("/communities/" + p.community_id)
    else nav("/profile/" + p.author_id)
  }

  const hasAny = people.length + posts.length + reels.length + communities.length + listings.length + services.length > 0
  const loadSuggestions = useCallback(async () => {
    if (!myId || suggestionsLoaded) return
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [rp, rcp] = await Promise.all([
        supabase.from('user_posts').select('content').gt('created_at', since).limit(200),
        supabase.from('community_posts').select('content').gt('created_at', since).limit(200),
      ])
      const stop = new Set(['the','a','an','and','or','to','of','in','is','it','this','that','for','on','with','i','you','my','me','we','be','are','was','has','have','do','does','so','at','as','but','not','from','by','can','no','yes','all','if','just','like','get','got','out','up','about','what','when','how'])
      const counts = new Map()
      const all = [...(rp.data||[]), ...(rcp.data||[])]
      all.forEach((row) => {
        const text = (row.content || '').toLowerCase()
        const hashtags = text.match(/#([a-z0-9_]{2,20})/g) || []
        hashtags.forEach((h) => { const key = h.slice(1); counts.set(key, (counts.get(key) || 0) + 2) })
        text.split(/[^a-z0-9_]+/).forEach((w) => {
          if (w.length < 3 || stop.has(w)) return
          counts.set(w, (counts.get(w) || 0) + 1)
        })
      })
      const top = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10).map(([t]) => t)

      const { data: followsRows } = await supabase.from('follows').select('following_id').eq('follower_id', myId)
      const followingSet = new Set((followsRows || []).map((f) => f.following_id))
      followingSet.add(myId)
      const excludeIds = [...followingSet].filter(Boolean)
      let peopleQuery = supabase.from('profiles')
        .select('id, display_name, username, is_verified, city')
        .eq('is_active', true)
        .limit(30)
      if (excludeIds.length > 0) peopleQuery = peopleQuery.not('id', 'in', '(' + excludeIds.map((x) => '"' + x + '"').join(',') + ')')
      const { data: peopleRows } = await peopleQuery
      const peopleIds = (peopleRows || []).map((p) => p.id)
      let photoMap = new Map()
      if (peopleIds.length > 0) {
        const { data: ph } = await supabase.from('profile_photos')
          .select('user_id, storage_path, is_primary, display_order')
          .in('user_id', peopleIds)
          .order('is_primary', { ascending: false })
          .order('display_order', { ascending: true })
        ;(ph || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
      }

      const { data: commRows } = await supabase.from('communities')
        .select('id, slug, name, emoji, cover_color, member_count')
        .eq('is_active', true)
        .order('member_count', { ascending: false })
        .limit(20)

      setTrendingTags(top)
      setSuggestedPeople((peopleRows || []).slice(0, 12).map((p) => ({
        ...p,
        _photo: photoMap.get(p.id) ? publicPhotoUrl(photoMap.get(p.id)) : null,
      })))
      setSuggestedCommunities(commRows || [])
      setSuggestionsLoaded(true)
    } catch (e) { console.warn('suggestions failed', e) }
  }, [myId, suggestionsLoaded])

  useEffect(() => {
    if (!isSearching) loadSuggestions()
  }, [isSearching, loadSuggestions])
  const isSearching = query.trim().length >= 2

  // Results filtered by active tab
  const showPeople      = (tab === "top" || tab === "people") && people.length > 0
  const showPosts       = (tab === "top" || tab === "posts") && posts.length > 0
  const showReels       = (tab === "top" || tab === "reels") && reels.length > 0
  const showCommunities = (tab === "top" || tab === "communities") && communities.length > 0
  const showListings    = (tab === "top" || tab === "marketplace") && listings.length > 0
  const showServices    = (tab === "top" || tab === "services") && services.length > 0

  return (
    <div
      className="mobile-shell flex flex-col relative"
      style={{
        position: "fixed", inset: 0,
        margin: "0 auto", maxWidth: 480,
        background: "#0B0B14",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 h-12 border-b border-white/8">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <div className="flex-1 relative">
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 60))}
            placeholder="Search people, posts, reels, services…"
            autoFocus
            className="w-full h-10 rounded-full bg-white/[0.06] border border-white/10 pl-10 pr-9 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center bg-white/10 text-muted"
              aria-label="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </header>

      {/* Filter tabs — only when searching */}
      {isSearching && (
        <div className="shrink-0 flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-white/8"
             style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { tap("light"); setTab(t.id) }}
              className="shrink-0 h-8 px-3.5 rounded-full text-[12.5px] font-bold transition-colors"
              style={{
                background: tab === t.id
                  ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)"
                  : "rgba(255,255,255,0.05)",
                border: tab === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: tab === t.id ? "#fff" : "#aaa",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-10">

        {/* Empty state (no query yet) */}
        {!isSearching && (
          <>
            {recent.length > 0 ? (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">
                    Recent
                  </p>
                  <button onClick={clearRecent} className="text-muted text-[11.5px] font-semibold">
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setQuery(r)}
                      className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream text-[12.5px] font-medium"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid place-items-center py-16 text-center">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                    <SearchIcon size={22} className="text-purple-300" />
                  </div>
                  <p className="text-cream font-bold text-[15px] mb-1">Search Nakubonye</p>
                  <p className="text-muted text-[13px] max-w-[240px] mx-auto leading-relaxed">
                    Find people, posts, reels, communities, listings, and services.
                  </p>
                </div>
              </div>
            )}

            {trendingTags.length > 0 && (
              <div className="mb-5">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">Trending</p>
                <div className="flex flex-wrap gap-1.5">
                  {trendingTags.map((t) => (
                    <button key={t} onClick={() => setQuery(t)} className="h-8 px-3 rounded-full bg-purple-500/12 border border-purple-500/25 text-purple-200 text-[12.5px] font-bold">#{t}</button>
                  ))}
                </div>
              </div>
            )}

            {suggestedCommunities.length > 0 && (
              <div className="mb-5">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">Communities to explore</p>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {suggestedCommunities.slice(0, 10).map((c) => (
                    <button key={c.id} onClick={() => { tap('light'); nav('/communities/' + (c.slug || c.id)) }} className="shrink-0 w-28 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden text-left">
                      <div className="h-14 grid place-items-center text-[26px]" style={{ background: c.cover_color || 'rgba(168,85,247,0.2)' }}>{c.emoji || '🌐'}</div>
                      <div className="p-2">
                        <p className="text-cream text-[11.5px] font-bold truncate">{c.name}</p>
                        <p className="text-muted text-[10px]">{c.member_count || 0} members</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {suggestedPeople.length > 0 && (
              <div>
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">People you may know</p>
                <div className="flex flex-col gap-1.5">
                  {suggestedPeople.slice(0, 6).map((u) => (
                    <button key={u.id} onClick={() => { tap('light'); nav('/profile/' + u.id) }} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left">
                      <span className="w-10 h-10 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black text-[14px] shrink-0">
                        {u._photo ? <img src={u._photo} alt="" className="w-full h-full object-cover" /> : (u.display_name || u.username || '?')[0].toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-cream text-[13.5px] font-bold truncate">{u.display_name || u.username}</p>
                        {u.username && <p className="text-muted text-[11.5px] truncate">@{u.username}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading */}
        {loading && isSearching && (
          <p className="text-subtle text-[12.5px] text-center py-6">Searching…</p>
        )}

        {/* No results */}
        {!loading && isSearching && !hasAny && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                <Users size={22} className="text-purple-300" />
              </div>
              <p className="text-cream font-bold text-[15px] mb-1">Nothing found</p>
              <p className="text-muted text-[13px]">Try a different search.</p>
            </div>
          </div>
        )}

        {/* PEOPLE */}
        {!loading && showPeople && (
          <Section title="People" count={people.length} showAll={tab === "top" && people.length > 5}>
            <div className="flex flex-col gap-1.5">
              {people.slice(0, tab === "top" ? 5 : people.length).map((u) => (
                <button
                  key={u.id}
                  onClick={() => openUser(u)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                >
                  <span className="w-11 h-11 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">
                        {(u.display_name || "?")[0]}
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">
                      {u.display_name || u.username}
                      {u.is_verified && <VerifiedBadge size={14} className="ml-1" />}
                    </p>
                    {u.username && <p className="text-muted text-[12px] truncate">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* POSTS */}
        {!loading && showPosts && (
          <Section title="Posts" count={posts.length} showAll={tab === "top" && posts.length > 4}>
            <div className="flex flex-col gap-1.5">
              {posts.slice(0, tab === "top" ? 4 : posts.length).map((p) => {
                const img = p.image_path
                  ? supabase.storage.from(p._source === "personal" ? "community-media" : "community-media").getPublicUrl(p.image_path).data?.publicUrl
                  : null
                return (
                  <button
                    key={p._source + "-" + p.id}
                    onClick={() => openPost(p)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                  >
                    <span className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0">
                      {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream text-[13px] leading-snug line-clamp-2">
                        {p.content || "Post"}
                      </p>
                      <p className="text-subtle text-[11px] mt-0.5 flex items-center gap-1">
                        <Clock size={10} /> {new Date(p.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* REELS */}
        {!loading && showReels && (
          <Section title="Reels" count={reels.length} showAll={tab === "top" && reels.length > 4}>
            <div className="grid grid-cols-2 gap-2">
              {reels.slice(0, tab === "top" ? 4 : reels.length).map((r) => (
                <button
                  key={r.id}
                  onClick={() => openReel(r)}
                  className="relative rounded-xl overflow-hidden aspect-[9/16] active:opacity-90"
                >
                  {r.thumbnail_url && <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full grid place-items-center bg-black/60">
                    <Play size={11} fill="#fff" strokeWidth={0} />
                  </span>
                  {r.caption && (
                    <span className="absolute bottom-0 inset-x-0 px-2 pb-2 pt-4 text-white text-[11px] font-semibold line-clamp-2 text-left"
                          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      {r.caption}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* COMMUNITIES */}
        {!loading && showCommunities && (
          <Section title="Communities" count={communities.length} showAll={tab === "top" && communities.length > 3}>
            <div className="flex flex-col gap-1.5">
              {communities.slice(0, tab === "top" ? 3 : communities.length).map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCommunity(c)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                >
                  <span
                    className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 text-lg font-black"
                    style={{ background: c.cover_color || "rgba(168,85,247,0.2)" }}
                  >
                    {c.emoji || (c.name || "?")[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">{c.name}</p>
                    <p className="text-muted text-[12px]">
                      {c.member_count ? c.member_count + " members" : "Community"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* MARKETPLACE */}
        {!loading && showListings && (
          <Section title="Marketplace" count={listings.length} showAll={tab === "top" && listings.length > 4}>
            <div className="grid grid-cols-2 gap-2">
              {listings.slice(0, tab === "top" ? 4 : listings.length).map((l) => {
                const img = l.image_paths?.[0]
                  ? supabase.storage.from("listing-media").getPublicUrl(l.image_paths[0]).data?.publicUrl
                  : null
                return (
                  <button
                    key={l.id}
                    onClick={() => openListing(l)}
                    className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/8 text-left active:opacity-90"
                  >
                    <div className="aspect-square bg-black/40">
                      {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-2">
                      <p className="text-cream text-[12px] font-bold line-clamp-1">{l.title}</p>
                      <p className="text-cream font-black text-[12.5px]">
                        {l.price ? l.price.toLocaleString() + " " + (l.currency || "BIF") : "Free"}
                      </p>
                      {l.location && (
                        <p className="text-subtle text-[10.5px] flex items-center gap-0.5 mt-0.5 truncate">
                          <MapPin size={9} /> {l.location}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* SERVICES */}
        {!loading && showServices && (
          <Section title="Services" count={services.length} showAll={tab === "top" && services.length > 3}>
            <div className="flex flex-col gap-1.5">
              {services.slice(0, tab === "top" ? 3 : services.length).map((s) => {
                const img = s.image_paths?.[0]
                  ? supabase.storage.from("service-media").getPublicUrl(s.image_paths[0]).data?.publicUrl
                  : null
                return (
                  <button
                    key={s.id}
                    onClick={() => openService(s)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                  >
                    <span className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0">
                      {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-bold text-[13px] truncate">{s.title}</p>
                      <p className="text-muted text-[11.5px]">{s.duration_minutes} min</p>
                      <p className="text-cream font-black text-[12.5px]">
                        {s.price ? s.price.toLocaleString() + " " + (s.currency || "BIF") : "Free"}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

      </div>
    </div>
  )
}

function Section({ title, count, showAll, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">
          {title} {count > 0 ? <span className="text-subtle font-bold">· {count}</span> : null}
        </p>
      </div>
      {children}
    </div>
  )
}

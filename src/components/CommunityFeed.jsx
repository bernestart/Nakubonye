import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Trash2, ImagePlus, X, Heart, Smile, Pin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import ResharedPost from './ResharedPost'
import ProfilePostCard from './ProfilePostCard'
import PostComposer from './PostComposer'

export default function CommunityFeed({ communityId, isMember }) {

  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState([])
  const [mutedIds, setMutedIds] = useState(new Set())
  const [text, setText] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [isAnnouncement, setIsAnnouncement] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [myRole, setMyRole] = useState(null)
  const [actionPost, setActionPost] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)
  const [reactions, setReactions] = useState({})
  const [pickerFor, setPickerFor] = useState(null)

  const load = useCallback(async () => {
    // Members-only: don't fetch post data for non-members (UI already hides them)
    if (!isMember) {
      setPosts([])
      setLoading(false)
      return
    }
    if (!session?.user?.id || !communityId) return
    setLoading(true); setError('')

    const [postRes, muteRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('id, author_id, content, image_path, image_paths, created_at, pinned_until, reshared_from_type, reshared_from_id, reshared_from_snapshot, reshared_include_original, is_announcement, announcement_title')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('user_mutes').select('muted_id').eq('muter_id', session.user.id),
    ])

    if (postRes.error) { setError(postRes.error.message); setLoading(false); return }

    const muteSet = new Set((muteRes.data || []).map((m) => m.muted_id))
    setMutedIds(muteSet)

    const rows = (postRes.data || []).filter((r) => !muteSet.has(r.author_id))

    const ids = [...new Set((rows || []).map((r) => r.author_id))]
    let profMap = new Map()
    let photoMap = new Map()

    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username, is_verified')
        .in('id', ids)
      ;(profs || []).forEach((p) => profMap.set(p.id, p))

      const { data: photos } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', ids)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      ;(photos || []).forEach((p) => {
        if (!photoMap.has(p.user_id)) photoMap.set(p.user_id, p.storage_path)
      })
    }
    // Load reactions for these posts
    const postIds = (rows || []).map((r) => r.id)
    if (postIds.length > 0) {
      const { data: reacts } = await supabase
        .from('community_post_reactions')
        .select('post_id, user_id, reaction')
        .in('post_id', postIds)
      const byPost = {}
      ;(reacts || []).forEach((r) => {
        byPost[r.post_id] = byPost[r.post_id] || []
        byPost[r.post_id].push({ user_id: r.user_id, reaction: r.reaction })
      })
      setReactions(byPost)
    } else {
      setReactions({})
    }

    const enriched = (rows || []).map((r) => {
      const pp = profMap.get(r.author_id) || {}
      let imageUrl = ''
      if (r.image_path) {
        const { data } = supabase.storage.from('community-media').getPublicUrl(r.image_path)
        imageUrl = data?.publicUrl || ''
      }
      return {
        id: r.id,
        author_id: r.author_id,
        content: r.content,
        image_url: imageUrl,
        created_at: r.created_at,
        pinned_until: r.pinned_until,
        pinned: !!(r.pinned_until && new Date(r.pinned_until) > new Date()),
        author_name: pp.display_name || pp.username || 'Someone',
        author_photo: publicPhotoUrl(photoMap.get(r.author_id)),
        author_verified: pp.is_verified,
      }
    })

    enriched.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at) - new Date(a.created_at)
    })

    setPosts(enriched)

    setLoading(false)
  }, [session?.user?.id, communityId, isMember])

  useEffect(() => { load() }, [load])

  function pickImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Only images allowed'); return }
    if (f.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB'); return }
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
    setError('')
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function submit() {
    const body = text.trim()
    if (!body && !imageFile) return
    if (submitting) return

    setSubmitting(true); setError(''); tap('light')

    let imagePath = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${communityId}/${session.user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('community-media')
        .upload(path, imageFile, { upsert: false, contentType: imageFile.type })
      if (upErr) { setSubmitting(false); setError(upErr.message); return }
      imagePath = path
    }

    const { error: insErr } = await supabase
      .from('community_posts')
      .insert({
        community_id: communityId,
        author_id: session.user.id,
        content: body || '',
        image_path: imagePath,
        is_announcement: isAnnouncement && (myRole === 'owner' || myRole === 'admin'),
        announcement_title: isAnnouncement && (myRole === 'owner' || myRole === 'admin') ? announcementTitle.trim() || null : null,
      })

    if (insErr) { setSubmitting(false); setError(insErr.message); return }

    setText('')
    clearImage()
    setIsAnnouncement(false)
    setAnnouncementTitle('')
    setSubmitting(false)
    load()
  }

  async function deletePost(postId) {
    if (!confirm('Delete this post?')) return
    tap('light')
    
    // Build query
    let query = supabase.from('community_posts').delete().eq('id', postId)
    
    // If the user is NOT an admin/mod, restrict the delete to their own post
    const isModerator = ['owner', 'admin', 'moderator'].includes(myRole)
    if (!isModerator) {
      query = query.eq('author_id', session.user.id)
    }

    const { error: err } = await query
    if (err) { setError(err.message); return }
    
    // Remove from UI
    setPosts(prev => prev.filter(p => p.id !== postId))
  }
  async function toggleReaction(postId, emoji) {
    if (!session?.user?.id) return
    tap('light')
    const current = (reactions[postId] || []).find((r) => r.user_id === session.user.id)

    if (current?.reaction === emoji) {
      await supabase.from('community_post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', session.user.id)
      setReactions((cur) => {
        const next = { ...cur }
        next[postId] = (next[postId] || []).filter((r) => r.user_id !== session.user.id)
        if (!next[postId].length) delete next[postId]
        return next
      })
    } else if (current) {
      await supabase.from('community_post_reactions')
        .update({ reaction: emoji })
        .eq('post_id', postId)
        .eq('user_id', session.user.id)
      setReactions((cur) => ({
        ...cur,
        [postId]: (cur[postId] || []).map((r) =>
          r.user_id === session.user.id ? { ...r, reaction: emoji } : r
        ),
      }))
    } else {
      await supabase.from('community_post_reactions')
        .insert({ post_id: postId, user_id: session.user.id, reaction: emoji })
      setReactions((cur) => ({
        ...cur,
        [postId]: [...(cur[postId] || []), { user_id: session.user.id, reaction: emoji }],
      }))
    }
    setPickerFor(null)
  }

  async function pinCommunityPost(postId) {
    if (!confirm('Pin this post to the top for 7 days?')) return
    tap('medium')
    setError('')
    const { data, error: err } = await supabase.rpc('pin_community_post', { p_post_id: postId })
    if (err) {
      if (/already_pinned/i.test(err.message)) setError('This post is already pinned.')
      else if (/not_authorized/i.test(err.message)) setError('Only community owners and admins can pin.')
      else setError(err.message)
      return
    }
    load()
  }


  useEffect(() => {
    if (!session?.user?.id || !communityId) return
    ;(async () => {
      const { data } = await supabase.from('community_memberships')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', session.user.id)
        .maybeSingle()
      setMyRole(data?.role || null)
    })()
  }, [communityId, session?.user?.id])

  if (!isMember) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
          <Heart size={22} strokeWidth={1.8} className="text-muted" />
        </div>
        <p className="text-cream font-semibold text-[14.5px] mb-1">Join to see posts</p>
        <p className="text-muted text-[12.5px]">Only members can see what's shared here.</p>
        {composerOpen && (
        <PostComposer
          communityId={communityId}
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load(); }}
        />
      )}
    </div>
  )
}


  return (
    <div className="flex flex-col gap-4">
      {/* ADMIN MODERATION BOTTOM SHEET */}
      {actionPost && (
        <div className="fixed inset-0 z-[150] flex items-end bg-black/60" onClick={() => setActionPost(null)}>
          <div className="w-full bg-[#0B0B14] rounded-t-3xl border-t border-white/10 p-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            
            {/* Show Delete if Admin OR if it's their own post */}
            {(['owner', 'admin', 'moderator'].includes(myRole) || actionPost.author_id === session.user.id) && (
               <button 
                 onClick={() => { setActionPost(null); deletePost(actionPost.id); }} 
                 className="w-full text-left p-4 rounded-xl text-red-400 font-bold hover:bg-white/5 flex items-center gap-3 active:bg-white/10"
               >
                 <Trash2 size={20} /> Delete Post
               </button>
            )}
            
            <button onClick={() => setActionPost(null)} className="w-full text-center p-4 text-muted font-bold mt-2 active:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      {/* Composer — triggers universal PostComposer */}
      {composerOpen ? (
        <PostComposer
          communityId={communityId}
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load(); }}
        />
      ) : (
        <button
          onClick={() => setComposerOpen(true)}
          className="w-full rounded-2xl bg-white/[0.04] border border-white/8 p-4 text-left text-muted text-[14px] hover:bg-white/[0.06] active:bg-white/[0.08]"
        >
          Share something with the community…
        </button>
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-cream font-semibold text-[14.5px] mb-1">No posts yet</p>
          <p className="text-muted text-[12.5px]">Be the first to share something.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => {
            const mine = post.author_id === session.user.id
            const postReacts = reactions[post.id] || []
            const myReact = postReacts.find(r => r.user_id === session.user.id)?.reaction
            const isAnn = !!post.is_announcement
            
            return (
              <div key={post.id} className={isAnn ? "rounded-2xl border border-pink-500/40 bg-pink-500/10 p-2 mb-2" : "mb-2"}>
                {isAnn && (
                  <div className="px-2 pt-2 flex items-center gap-2">
                    <span className="px-2 h-6 rounded-full bg-pink-500/25 border border-pink-500/50 text-pink-200 text-[10.5px] font-black tracking-wider flex items-center gap-1">📢 ANNOUNCEMENT</span>
                  </div>
                )}
                <ProfilePostCard
                  post={{
                    ...post,
                    _source: "community",
                    author_id: post.author_id,
                    content: post.content,
                    image_paths: post.image_paths || (post.image_path ? [post.image_path] : []),
                    audience: "public"
                  }}
                  authorProfile={{ id: post.author_id, display_name: post.author_name, is_verified: post.author_verified }}
                  authorPhoto={post.author_photo}
                  isMe={mine}
                  onOpenMenu={(p) => { tap("light"); setActionPost(post); }}
                  onHide={(p) => { setMutedIds(prev => new Set(prev).add(p.author_id)) }}
                  reactionCount={postReacts.length}
                  liked={!!myReact}
                  reactionEmoji={myReact || "❤️"}
                  commentCount={post.comment_count || 0}
                  shareCount={0}
                  onToggleLike={() => toggleReaction(post.id, myReact || "❤️")}
                  onOpenReposts={() => {}}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

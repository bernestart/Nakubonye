import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Trash2, ImagePlus, X, Heart, Smile } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'

export default function CommunityFeed({ communityId, isMember }) {
  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState([])
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)
  const [reactions, setReactions] = useState({})
  const [pickerFor, setPickerFor] = useState(null)

  const load = useCallback(async () => {
    if (!session?.user?.id || !communityId) return
    setLoading(true); setError('')

    const { data: rows, error: pErr } = await supabase
      .from('community_posts')
      .select('id, author_id, content, image_path, created_at')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (pErr) { setError(pErr.message); setLoading(false); return }

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
    }$1
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

    setLoading(false)
  }, [session?.user?.id, communityId])

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
      })

    if (insErr) { setSubmitting(false); setError(insErr.message); return }

    setText('')
    clearImage()
    setSubmitting(false)
    load()
  }

  async function deletePost(postId) {
    if (!confirm('Delete this post?')) return
    tap('light')
    const { error: err } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', session.user.id)
    if (err) { setError(err.message); return }$1
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

  if (!isMember) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
          <Heart size={22} strokeWidth={1.8} className="text-muted" />
        </div>
        <p className="text-cream font-semibold text-[14.5px] mb-1">Join to see posts</p>
        <p className="text-muted text-[12.5px]">Only members can see what's shared here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Share something with the community…"
          className="w-full bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none resize-none"
        />

        {imagePreview && (
          <div className="relative w-fit mt-2">
            <img src={imagePreview} alt="" className="rounded-xl max-h-32" />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-obsidian border border-white/20 grid place-items-center"
              aria-label="Remove"
            >
              <X size={13} strokeWidth={2.6} className="text-cream" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={pickImage}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-full grid place-items-center text-muted hover:text-cream"
            aria-label="Add image"
          >
            <ImagePlus size={18} strokeWidth={2.2} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-subtle text-[11px]">{text.length}/500</span>
            <button
              onClick={submit}
              disabled={submitting || (!text.trim() && !imageFile)}
              className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40 flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
              }}
            >
              <Send size={13} strokeWidth={2.5} />
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>

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
            return (
              <div
                key={post.id}
                className="rounded-2xl bg-white/[0.04] border border-white/8 p-3"
              >
                <div className="flex items-start gap-3 mb-2">
                  <button
                    onClick={() => { tap('light'); nav('/profile/' + post.author_id) }}
                    className="shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated border border-white/8">
                      {post.author_photo ? (
                        <img src={post.author_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-base font-black text-purple-400">
                          {post.author_name[0]}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-[13.5px] font-semibold truncate flex items-center gap-1.5">
                      {post.author_name}
                      {post.author_verified && <span className="text-purple-400 text-[11px]">✓</span>}
                    </p>
                    <p className="text-subtle text-[11px]">
                      {new Date(post.created_at).toLocaleString([], {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {mine && (
                    <button
                      onClick={() => deletePost(post.id)}
                      className="w-8 h-8 rounded-full grid place-items-center text-muted hover:text-danger"
                      aria-label="Delete post"
                    >
                      <Trash2 size={15} strokeWidth={2.2} />
                    </button>
                  )}
                </div>

                {post.content && (
                  <p className="text-cream/92 text-[14px] leading-[1.5] break-words whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}

                {post.image_url && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-white/8">
                    <img
                      src={post.image_url}
                      alt=""
                      className="block w-full h-auto max-h-[420px] object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Reactions */}
                <div className="mt-3 pt-2 border-t border-white/6 flex items-center gap-1.5 flex-wrap">
                  {Object.entries(
                    (reactions[post.id] || []).reduce((acc, r) => {
                      acc[r.reaction] = (acc[r.reaction] || 0) + 1
                      return acc
                    }, {})
                  ).map(([emoji, count]) => {
                    const mine = (reactions[post.id] || []).find(
                      (r) => r.user_id === session.user.id
                    )?.reaction === emoji
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        className={`text-[12px] px-2 py-0.5 rounded-full border transition-colors ${
                          mine
                            ? 'bg-purple-500/20 border-purple-400/40'
                            : 'bg-white/[0.04] border-white/10'
                        }`}
                      >
                        {emoji} {count > 1 ? count : ''}
                      </button>
                    )
                  })}

                  <button
                    onClick={() => { tap('light'); setPickerFor(pickerFor === post.id ? null : post.id) }}
                    className="w-7 h-7 rounded-full grid place-items-center bg-white/[0.04] border border-white/10 text-muted hover:text-cream"
                    aria-label="Add reaction"
                  >
                    <Smile size={13} strokeWidth={2.3} />
                  </button>

                  {pickerFor === post.id && (
                    <div className="flex gap-1 p-1 rounded-full bg-elevated border border-white/10 ml-1">
                      {['❤️','😂','😍','👍','🔥','😮','😢','😡'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(post.id, emoji)}
                          className="w-7 h-7 rounded-full grid place-items-center text-base hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
}

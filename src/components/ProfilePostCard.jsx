import { getMediaUrl } from '../lib/api';
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, MessageCircle, Share2, MoreVertical, Globe, Users, Lock, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"
import ResharedPost from "./ResharedPost"
import PostImages from "./PostImages"

export default function ProfilePostCard({ post, authorProfile, authorPhoto, isMe, onOpenMenu, onHide, reactionCount = 0, liked = false, reactionEmoji = "❤️", commentCount = 0, shareCount = 0, onToggleLike, onOpenReposts, topReactors = [] }) {
  const nav = useNavigate()
  const imageUrl = post.image_path
    ? getMediaUrl(post.image_path, "community-media")
    : null
  const isReshare = !!post.reshared_from_type

  const audienceIcon = (() => {
    const a = post.audience || "public"
    if (a === "private") return <Lock size={10} />
    if (a === "matches") return <Users size={10} />
    if (typeof a === "string" && a.startsWith("circle:")) return <Users size={10} />
    return <Globe size={10} />
  })()

  return (
    <article className="bg-transparent border-b border-white/8 pb-3 mb-1">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <button
          onClick={() => { tap("light"); nav("/profile/" + (authorProfile?.id || post.user_id)) }}
          className="w-10 h-10 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
        >
          {authorPhoto ? (
            <img src={authorPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full grid place-items-center text-purple-400 font-black text-[14px]">
              {(authorProfile?.display_name || authorProfile?.username || "?")[0].toUpperCase()}
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-cream font-bold text-[14px] truncate flex items-center gap-1">
            {authorProfile?.display_name || authorProfile?.username || "User"}
            {authorProfile?.is_verified && <VerifiedBadge size={13} />}
          </p>
          <p className="text-subtle text-[11px] flex items-center gap-1">
            {new Date(post.created_at).toLocaleString([], { month: "short", day: "numeric" })}
            <span>·</span>
            {audienceIcon}
          </p>
        </div>
        <button
          onClick={() => { tap("light"); onOpenMenu?.(post) }}
          className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Post options"
        >
          <MoreVertical size={18} />
        </button>
        {onHide && (
          <button
            onClick={() => { tap("light"); onHide(post) }}
            className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
            aria-label="Hide post"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div
          className={"mx-3 mb-3 rounded-xl " + (post.background_style ? "p-4 min-h-[120px] flex items-center justify-center" : "")}
          style={{ background: post.background_style || "transparent" }}
        >
          <p className={"text-cream leading-snug whitespace-pre-wrap w-full text-center " + (post.background_style ? "text-[20px] font-bold" : "text-[14.5px]")}>
            {post.content}
          </p>
        </div>
      )}

      {/* Nested reshare */}
      {isReshare && post.reshared_include_original && post.reshared_from_snapshot && (
        <div className="px-4 pb-3">
          <ResharedPost
            snapshot={{
              ...post.reshared_from_snapshot,
              id: post.reshared_from_id,
              type: post.reshared_from_type,
            }}
          />
        </div>
      )}

      {/* Images */}
      {(() => {
        const paths = Array.isArray(post.image_paths) && post.image_paths.length > 0
          ? post.image_paths
          : (post.image_path ? [post.image_path] : [])
        if (paths.length === 0) return null
        return (
          <PostImages
            paths={paths}
            alts={post.image_alts || []}
            bucket="community-media"
            onPostOpen={() => { tap("light"); nav("/post/" + (post._source || "personal") + "/" + post.id) }}
            onDoubleTap={() => onToggleLike?.()}
          />
        )
      })()}

      {/* Engagement summary */}
      {(reactionCount > 0 || commentCount > 0 || shareCount > 0) && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
          {reactionCount > 0 ? (
            <span className="text-muted text-[12px] flex items-center gap-2">
              <span className="flex -space-x-1.5">
                {[...new Set(topReactors.map((r) => r.emoji))].slice(0, 3).map((em, i) => (
                  <span
                    key={i}
                    className="w-4.5 h-4.5 rounded-full grid place-items-center text-[11px] bg-[#0B0B14] border border-white/10"
                    style={{ width: 18, height: 18 }}
                  >
                    {em}
                  </span>
                ))}
              </span>
              <span className="truncate">
                {liked ? (
                  <>
                    You{topReactors.length > 1 ? `, ${topReactors.filter((r) => r.name).slice(0, 1).map((r) => r.name.split(" ")[0]).join(", ")}` : ""}
                    {reactionCount > 2 ? ` and ${reactionCount - (topReactors.length > 1 ? 2 : 1)} other${reactionCount - (topReactors.length > 1 ? 2 : 1) === 1 ? "" : "s"}` : ""}
                  </>
                ) : (
                  <>
                    {topReactors[0]?.name?.split(" ")[0] || "Someone"}
                    {reactionCount > 1 ? ` and ${reactionCount - 1} other${reactionCount - 1 === 1 ? "" : "s"}` : ""}
                  </>
                )}
              </span>
            </span>
          ) : <span />}
          <div className="flex items-center gap-3">
            {commentCount > 0 && (
              <button
                onClick={() => { tap("light"); nav("/post/" + post._source + "/" + post.id) }}
                className="text-muted text-[12px] active:opacity-70"
              >
                {commentCount} comment{commentCount === 1 ? "" : "s"}
              </button>
            )}
            {shareCount > 0 && (
              <button
                onClick={() => { tap("light"); onOpenReposts?.(post) }}
                className="text-muted text-[12px] active:opacity-70"
              >
                {shareCount} share{shareCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center px-3 py-1 border-t border-white/5">
        <button
          onClick={() => { tap("light"); onToggleLike?.() }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg active:bg-white/[0.04]"
        >
          <Heart size={17} strokeWidth={2.2} color={liked ? "#EC4899" : "#888"} fill={liked ? "#EC4899" : "none"} />
          <span className="text-[12.5px] font-bold" style={{ color: liked ? "#EC4899" : "#888" }}>
            {liked ? "Liked" : "Like"}
          </span>
        </button>
        <button
          onClick={() => { tap("light"); nav("/post/" + post._source + "/" + post.id) }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg active:bg-white/[0.04]"
        >
          <MessageCircle size={17} strokeWidth={2.2} color="#888" />
          <span className="text-muted text-[12.5px] font-bold">Comment</span>
        </button>
        <button
          onClick={() => { tap("light"); nav("/post/" + post._source + "/" + post.id) }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg active:bg-white/[0.04]"
        >
          <Share2 size={17} strokeWidth={2.2} color="#888" />
          <span className="text-muted text-[12.5px] font-bold">Share</span>
        </button>
      </div>
    </article>
  )
}

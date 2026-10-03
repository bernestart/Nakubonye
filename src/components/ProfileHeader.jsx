import { MapPin } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"

export default function ProfileHeader({
  profile,
  photos = [],
  isOwn = false,
  coverPhotoPath = null,
  followersCount = 0,
  followingCount = 0,
  postsCount = 0,
  matchesCount = 0,
  actions,
  onFollowersClick,
  onFollowingClick,
  onSettingsClick,
  onMatchesClick,
  topBarLeft,
  topBarRight,
}) {
  const nav = useNavigate()
  const avatar = photos[0] ? (typeof photos[0] === "string" ? photos[0] : publicPhotoUrl(photos[0]))
    : profile?.photo_url
    ? profile.photo_url
    : null

  const initial = (profile?.display_name || profile?.username || "?")[0].toUpperCase()
  const coverUrl = coverPhotoPath ? publicPhotoUrl(coverPhotoPath) : null

  return (
    <>
      {/* Cover photo — full width, breaks out of parent padding */}
      <div className="relative -mx-4 -mt-3" style={{ height: 150 }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.35) 100%)",
            }}
          />
        )}

        {/* Top bar overlays the cover */}
        {(topBarLeft || topBarRight) && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div>{topBarLeft}</div>
            <div>{topBarRight}</div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        {/* Avatar overlapping cover + name */}
        <div className="flex items-start gap-4 -mt-14 relative">
          <button
            onClick={() => isOwn && nav("/me/preview")}
            className="shrink-0 relative z-10"
            aria-label="View profile photo"
          >
            <span
              className="block rounded-full overflow-hidden bg-elevated border-4"
              style={{
                width: 96,
                height: 96,
                borderColor: "#0B0B14",
              }}
            >
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-purple-400 font-black text-2xl">
                  {initial}
                </span>
              )}
            </span>
          </button>

          <div className="flex-1 min-w-0 pt-16">
            <div className="flex items-center gap-1.5 mb-1">
              <h1 className="text-cream text-[18px] font-extrabold tracking-tight truncate">
                {profile?.display_name || profile?.username || "You"}
                {profile?.date_of_birth ? `, ${profile.age || ""}` : ""}
              </h1>
              {profile?.is_verified && <VerifiedBadge size={14} />}
            </div>

            <p className="text-muted text-[13px] truncate">
              @{profile?.username || "username"}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={() => { tap("light"); nav(isOwn ? "/feed" : `/user/${profile?.id}/posts`) }}
            className="text-left"
          >
            <p className="text-cream text-[15px] font-extrabold leading-none">{postsCount}</p>
            <p className="text-muted text-[11px] mt-0.5">Posts</p>
          </button>

          <button
            onClick={() => { tap("light"); onFollowersClick?.() }}
            className="text-left"
          >
            <p className="text-cream text-[15px] font-extrabold leading-none">{followersCount}</p>
            <p className="text-muted text-[11px] mt-0.5">Followers</p>
          </button>

          <button
            onClick={() => { tap("light"); onFollowingClick?.() }}
            className="text-left"
          >
            <p className="text-cream text-[15px] font-extrabold leading-none">{followingCount}</p>
            <p className="text-muted text-[11px] mt-0.5">Following</p>
          </button>
          {onMatchesClick && (
            <button
              onClick={() => { tap("light"); onMatchesClick() }}
              className="text-left"
            >
              <p className="text-cream text-[15px] font-extrabold leading-none">{matchesCount}</p>
              <p className="text-muted text-[11px] mt-0.5">Matches</p>
            </button>
          )}
        </div>

        {/* Bio + location */}
        {(profile?.bio || profile?.city) && (
          <div className="mt-3">
            {profile.city && (
              <p className="text-muted text-[12.5px] flex items-center gap-1 mb-1">
                <MapPin size={11} />
                {profile.city}{profile.country ? `, ${profile.country}` : ""}
              </p>
            )}
            {profile.bio && (
              <p className="text-cream/90 text-[13.5px] leading-[1.45] whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>
        )}

        {/* Action buttons row */}
        {actions && (
          <div className="mt-3 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </>
  )
}

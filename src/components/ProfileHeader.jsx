import { MapPin, Settings } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"

export default function ProfileHeader({
  profile,
  photos = [],
  isOwn = false,
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

  return (
    <div className="px-4 pt-3 pb-3">
      {/* Optional top bar — back arrow / settings */}
      {(topBarLeft || topBarRight) && (
        <div className="flex items-center justify-between mb-3 -mt-1">
          <div>{topBarLeft}</div>
          <div>{topBarRight}</div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Small circular avatar */}
        <button
          onClick={() => isOwn && nav("/me/preview")}
          className="shrink-0"
          aria-label="View profile photo"
        >
          <span
            className="block rounded-full overflow-hidden bg-elevated border-2"
            style={{
              width: 82,
              height: 82,
              borderColor: "rgba(168,85,247,0.4)",
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

        {/* Right column — name + stats */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-1.5 mb-1">
            <h1 className="text-cream text-[18px] font-extrabold tracking-tight truncate">
              {profile?.display_name || profile?.username || "You"}
              {profile?.date_of_birth ? `, ${profile.age || ""}` : ""}
            </h1>
            {profile?.is_verified && <VerifiedBadge size={14} />}
          </div>

          <p className="text-muted text-[13px] truncate mb-2">
            @{profile?.username || "username"}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => { tap("light"); nav(isOwn ? "/feed" : `/user/${profile.id}/posts`) }}
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
        </div>
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
  )
}

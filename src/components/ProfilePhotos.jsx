import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { photoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

const SYSTEM_ORDER = {
  profile_pictures: 0,
  cover_photos:     1,
  timeline:         2,
  mobile_uploads:   3,
}

function AlbumCard({ album, coverUrl, count, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="shrink-0 w-[110px] rounded-2xl overflow-hidden text-left bg-white/[0.03] border border-white/8 active:opacity-90"
    >
      <div className="aspect-square bg-black">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted text-[22px]">📷</div>
        )}
      </div>
      <div className="p-2">
        <p className="text-cream font-bold text-[12px] truncate">{album.name}</p>
        <p className="text-muted text-[10.5px]">{count} {count === 1 ? "photo" : "photos"}</p>
      </div>
    </button>
  )
}

function Grid({ photos, onPhotoClick, emptyText }) {
  if (!photos || photos.length === 0) {
    return (
      <p className="text-muted text-[12.5px] py-4 px-4">{emptyText}</p>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((p, i) => (
        <button
          key={p.id || i}
          onClick={() => onPhotoClick(p)}
          className="relative aspect-square rounded-md overflow-hidden bg-black"
        >
          <img src={p._url} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )
}

export default function ProfilePhotos({ userId, onPhotoClick, emptySubtitle = "No photos on this profile yet." }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState([])
  const [taggedPhotos, setTaggedPhotos] = useState([])
  const [albums, setAlbums] = useState([])
  const [openAlbumId, setOpenAlbumId] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      const [photosRes, albumsRes, tagsRes] = await Promise.all([
        supabase.from('photos')
          .select('id, user_id, storage_path, bucket, source, album_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('albums')
          .select('id, name, system_key, type, cover_photo_id')
          .eq('user_id', userId),
        supabase.from('photo_tags')
          .select('photo_id, photos(id, user_id, storage_path, bucket, created_at)')
          .eq('tagged_user_id', userId)
          .eq('status', 'approved'),
      ])

      if (cancelled) return

      setPhotos((photosRes.data || []).map((p) => ({
        ...p,
        _url: photoUrl(p.bucket, p.storage_path),
      })))
      setAlbums(albumsRes.data || [])
      setTaggedPhotos(
        (tagsRes.data || [])
          .map((t) => t.photos)
          .filter(Boolean)
          .map((p) => ({ ...p, _url: photoUrl(p.bucket, p.storage_path) }))
      )
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [userId])

  const photosByAlbum = {}
  photos.forEach((p) => {
    if (p.album_id) {
      if (!photosByAlbum[p.album_id]) photosByAlbum[p.album_id] = []
      photosByAlbum[p.album_id].push(p)
    }
  })

  const sortedAlbums = [...albums].sort((a, b) => {
    const ao = a.system_key != null ? (SYSTEM_ORDER[a.system_key] ?? 99) : 100
    const bo = b.system_key != null ? (SYSTEM_ORDER[b.system_key] ?? 99) : 100
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })

  const openAlbum = openAlbumId ? sortedAlbums.find((a) => a.id === openAlbumId) : null
  const openAlbumPhotos = openAlbumId ? (photosByAlbum[openAlbumId] || []) : []

  if (loading) {
    return (
      <div className="px-4 py-3 grid grid-cols-3 gap-1">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className="aspect-square rounded-md bg-white/[0.03] shimmer" />
        ))}
      </div>
    )
  }

  // Album detail view
  if (openAlbum) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => { tap("light"); setOpenAlbumId(null) }}
            className="text-cream text-[13.5px] font-bold"
          >
            ← {openAlbum.name}
          </button>
          <span className="text-muted text-[12px]">
            {openAlbumPhotos.length} {openAlbumPhotos.length === 1 ? "photo" : "photos"}
          </span>
        </div>
        <Grid
          photos={openAlbumPhotos}
          onPhotoClick={(p) => onPhotoClick(p._url)}
          emptyText="No photos in this album yet."
        />
      </div>
    )
  }

  const hasAny = photos.length > 0 || taggedPhotos.length > 0 || sortedAlbums.length > 0
  if (!hasAny) {
    return (
      <div className="py-16 text-center px-6">
        <p className="text-[42px] mb-2">📷</p>
        <p className="text-cream font-bold text-[14.5px] mb-1">No photos yet</p>
        <p className="text-muted text-[12.5px]">{emptySubtitle}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Albums section */}
      {sortedAlbums.length > 0 && (
        <section className="px-4 pt-3 pb-3">
          <h2 className="text-cream font-extrabold text-[17px] mb-3">Albums</h2>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {sortedAlbums.map((a) => {
              const albumPhotos = photosByAlbum[a.id] || []
              const cover = a.cover_photo_id
                ? albumPhotos.find((p) => p.id === a.cover_photo_id)
                : albumPhotos[0]
              return (
                <AlbumCard
                  key={a.id}
                  album={a}
                  coverUrl={cover?._url}
                  count={albumPhotos.length}
                  onOpen={() => { tap("light"); setOpenAlbumId(a.id) }}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Photos of You section */}
      {taggedPhotos.length > 0 && (
        <section className="pt-2 pb-3">
          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-cream font-extrabold text-[17px]">Photos of You</h2>
            <span className="text-muted text-[12.5px]">{taggedPhotos.length}</span>
          </div>
          <Grid
            photos={taggedPhotos}
            onPhotoClick={(p) => onPhotoClick(p._url)}
            emptyText="No tagged photos."
          />
        </section>
      )}

      {/* Your Photos section */}
      {photos.length > 0 && (
        <section className="pt-2 pb-4">
          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-cream font-extrabold text-[17px]">Your Photos</h2>
            <span className="text-muted text-[12.5px]">{photos.length}</span>
          </div>
          <Grid
            photos={photos}
            onPhotoClick={(p) => onPhotoClick(p._url)}
            emptyText="No photos."
          />
        </section>
      )}
    </div>
  )
}

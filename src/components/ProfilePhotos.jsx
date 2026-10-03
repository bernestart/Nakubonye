import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { photoUrl } from "../lib/photo"

const SUB_TABS = [
  { id: 'tagged',  label: 'Photos of You' },
  { id: 'uploads', label: 'Your Photos' },
  { id: 'albums',  label: 'Albums' },
]

const SYSTEM_ORDER = {
  profile_pictures: 0,
  cover_photos:     1,
  timeline:         2,
  mobile_uploads:   3,
}

export default function ProfilePhotos({ userId, onPhotoClick, emptySubtitle = "No photos on this profile yet." }) {
  const [subTab, setSubTab] = useState('uploads')
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
          .select('id, storage_path, bucket, source, album_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('albums')
          .select('id, name, system_key, type, cover_photo_id')
          .eq('user_id', userId),
        supabase.from('photo_tags')
          .select('photo_id, photos(id, user_id, storage_path, bucket, created_at)')
          .eq('tagged_user_id', userId),
      ])

      if (cancelled) return

      setPhotos(photosRes.data || [])
      setAlbums(albumsRes.data || [])
      setTaggedPhotos(
        (tagsRes.data || []).map((t) => t.photos).filter(Boolean)
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
      <div className="grid grid-cols-3 gap-1 px-1">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className="aspect-square rounded-lg bg-white/[0.03] shimmer" />
        ))}
      </div>
    )
  }

  // ── Album detail view ──
  if (openAlbum) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 mb-3">
          <button
            onClick={() => setOpenAlbumId(null)}
            className="text-cream text-[13px] font-bold"
          >
            ← {openAlbum.name}
          </button>
          <span className="text-muted text-[12px]">
            {openAlbumPhotos.length} photo{openAlbumPhotos.length === 1 ? '' : 's'}
          </span>
        </div>
        {openAlbumPhotos.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-cream font-bold text-[15px] mb-1">No photos</p>
            <p className="text-muted text-[13px]">This album is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 px-1">
            {openAlbumPhotos.map((p) => (
              <button
                key={p.id}
                onClick={() => onPhotoClick(photoUrl(p.bucket, p.storage_path))}
                className="relative aspect-square rounded-lg overflow-hidden bg-black"
              >
                <img src={photoUrl(p.bucket, p.storage_path)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Sub-tabs + grid ──
  const listForTab =
    subTab === 'tagged'  ? taggedPhotos :
    subTab === 'uploads' ? photos : []

  return (
    <div>
      <div className="flex gap-1.5 px-4 mb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {SUB_TABS.map((t) => {
          const count =
            t.id === 'tagged'  ? taggedPhotos.length :
            t.id === 'uploads' ? photos.length :
            albums.length
          return (
            <button
              key={t.id}
              onClick={() => { setSubTab(t.id); setOpenAlbumId(null) }}
              className="shrink-0 h-8 px-3 rounded-full text-[12px] font-bold transition-colors"
              style={{
                background: subTab === t.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: subTab === t.id ? '#fff' : '#888',
                border: subTab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {t.label} {count > 0 ? '· ' + count : ''}
            </button>
          )
        })}
      </div>

      {subTab === 'albums' ? (
        albums.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-cream font-bold text-[15px] mb-1">No albums yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 px-2">
            {sortedAlbums.map((a) => {
              const albumPhotos = photosByAlbum[a.id] || []
              const cover = a.cover_photo_id
                ? albumPhotos.find((p) => p.id === a.cover_photo_id)
                : albumPhotos[0]
              return (
                <button
                  key={a.id}
                  onClick={() => setOpenAlbumId(a.id)}
                  className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/8 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="aspect-square bg-black">
                    {cover ? (
                      <img src={photoUrl(cover.bucket, cover.storage_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted text-[28px]">📷</div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-cream font-bold text-[12.5px] truncate">{a.name}</p>
                    <p className="text-muted text-[11px]">
                      {albumPhotos.length} photo{albumPhotos.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )
      ) : listForTab.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-cream font-bold text-[15px] mb-1">No photos</p>
          <p className="text-muted text-[13px]">
            {subTab === 'tagged'
              ? 'Photos you are tagged in will appear here.'
              : emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 px-1">
          {listForTab.map((p) => (
            <button
              key={p.id}
              onClick={() => onPhotoClick(photoUrl(p.bucket, p.storage_path))}
              className="relative aspect-square rounded-lg overflow-hidden bg-black"
            >
              <img src={photoUrl(p.bucket, p.storage_path)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

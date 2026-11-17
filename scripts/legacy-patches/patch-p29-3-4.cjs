const fs = require('fs')
const p = 'src/screens/EditProfile.jsx'
let s = fs.readFileSync(p, 'utf8')

// ── 1. Cover: unique path + register in photos ──
const coverOld = `    if (coverFile) {
      const path = \`covers/\${myId}.jpg\`
      const { error: covErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, coverFile, { upsert: true, contentType: 'image/jpeg' })
      if (covErr) { setSaving(false); setError(covErr.message); return }
      coverPath = path
    }`

const coverNew = `    if (coverFile) {
      const path = \`covers/\${myId}/\${crypto.randomUUID()}.jpg\`
      const { error: covErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, coverFile, { upsert: false, contentType: 'image/jpeg' })
      if (covErr) { setSaving(false); setError(covErr.message); return }
      coverPath = path
      try {
        const { data: coverAlbum } = await supabase.from('albums')
          .select('id').eq('user_id', myId).eq('system_key', 'cover_photos').maybeSingle()
        if (coverAlbum?.id) {
          await supabase.from('photos').upsert({
            user_id: myId,
            album_id: coverAlbum.id,
            storage_path: path,
            bucket: 'profile-photos',
            source: 'cover',
          }, { onConflict: 'bucket,storage_path' })
        }
      } catch (e) { console.warn('photo register (cover) failed', e) }
    }`

if (!s.includes(coverOld)) throw new Error('cover block not found')
s = s.replace(coverOld, coverNew)

// ── 2. Profile pic upload: register in photos ──
const picOld = `      setPhotos((cur) => [...cur, {
        id: inserted.id,
        storage_path: inserted.storage_path,
        is_primary: inserted.is_primary,
        display_order: inserted.display_order,
        url: publicPhotoUrl(inserted.storage_path),
      }])`

const picNew = picOld + `

      try {
        const { data: picAlbum } = await supabase.from('albums')
          .select('id').eq('user_id', myId).eq('system_key', 'profile_pictures').maybeSingle()
        if (picAlbum?.id) {
          await supabase.from('photos').upsert({
            user_id: myId,
            album_id: picAlbum.id,
            storage_path: inserted.storage_path,
            bucket: 'profile-photos',
            source: 'profile',
          }, { onConflict: 'bucket,storage_path' })
        }
      } catch (e) { console.warn('photo register (profile) failed', e) }`

if (!s.includes(picOld)) throw new Error('profile pic insert block not found')
s = s.replace(picOld, picNew)

// ── 3. deletePhoto: mirror delete into photos ──
const delOld = `    await supabase.from('profile_photos').delete().eq('id', photo.id)`
const delNew = delOld + `
    supabase.from('photos').delete()
      .eq('bucket', 'profile-photos')
      .eq('storage_path', photo.storage_path)
      .then(() => {}, (e) => console.warn('photo delete mirror failed', e))`

if (!s.includes(delOld)) throw new Error('deletePhoto block not found')
s = s.replace(delOld, delNew)

fs.writeFileSync(p, s)
console.log('OK EditProfile.jsx wired for photos mirror')

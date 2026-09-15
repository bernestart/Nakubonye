import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Trash2, Star } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import ProfileTabs from '../components/ProfileTabs'
import { PROMPT_LIBRARY } from '../lib/profileLabels'

const MAX_BIO = 300


const MAX_PHOTOS = 6

export default function EditProfile() {
  const nav = useNavigate()
  const { session, setProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Burundi')
  const [preferredGender, setPreferredGender] = useState('')
  const [minAge, setMinAge] = useState(20)
  const [maxAge, setMaxAge] = useState(40)
  const [lookingFor, setLookingFor] = useState('')
  const [profession, setProfession] = useState('')
  const [education, setEducation] = useState('')
  const [religion, setReligion] = useState('')
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [bodyHeightCm, setBodyHeightCm] = useState('')
  const [languages, setLanguages] = useState([])
  const [bodyType, setBodyType] = useState('')
  const [personality, setPersonality] = useState('')
  const [relationshipPreference, setRelationshipPreference] = useState('')
  const [musicGenres, setMusicGenres] = useState([])
  const [smoker, setSmoker] = useState('')
  const [drinking, setDrinking] = useState('')
  const [partying, setPartying] = useState('')
  const [exercise, setExercise] = useState('')
  const [tattoos, setTattoos] = useState('')
  const [diet, setDiet] = useState('')
  const [pets, setPets] = useState('')
  const [children, setChildren] = useState('')
  const [hideOnlineStatus, setHideOnlineStatus] = useState(false)
  const [hideAge, setHideAge] = useState(false)
  const [incognitoMode, setIncognitoMode] = useState(false)
  const [onlyMatchesCanMessage, setOnlyMatchesCanMessage] = useState(false)
  const [prompts, setPrompts] = useState([])
  const [editingPromptSlot, setEditingPromptSlot] = useState(null)

  const [availableInterests, setAvailableInterests] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])

  const [photos, setPhotos] = useState([]) // [{ id, storage_path, url, is_primary, display_order }]
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const myId = session?.user?.id

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true); setError('')

    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, username, bio, city, country, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_online_status, hide_age, incognito_mode, only_matches_can_message')
      .eq('id', myId).single()

    if (prof) {
      setDisplayName(prof.display_name || '')
      setUsername(prof.username || '')
      setBio(prof.bio || '')
      setCity(prof.city || '')
      setCountry(prof.country || 'Burundi')
      setProfession(prof.profession || '')
      setEducation(prof.education || '')
      setReligion(prof.religion || '')
      setRelationshipStatus(prof.relationship_status || '')
      setBodyHeightCm(prof.body_height_cm ? String(prof.body_height_cm) : '')
      setLanguages(Array.isArray(prof.languages) ? prof.languages : [])
      setBodyType(prof.body_type || '')
      setPersonality(prof.personality || '')
      setRelationshipPreference(prof.relationship_preference || '')
      setMusicGenres(Array.isArray(prof.music_genres) ? prof.music_genres : [])
      setSmoker(prof.smoker || '')
      setDrinking(prof.drinking || '')
      setPartying(prof.partying || '')
      setExercise(prof.exercise || '')
      setTattoos(prof.tattoos || '')
      setDiet(prof.diet || '')
      setPets(prof.pets || '')
      setChildren(prof.children || '')
      setHideOnlineStatus(!!prof.hide_online_status)
      setHideAge(!!prof.hide_age)
      setIncognitoMode(!!prof.incognito_mode)
      setOnlyMatchesCanMessage(!!prof.only_matches_can_message)
    }

    const { data: prefRows } = await supabase
      .from('discovery_preferences')
      .select('preferred_gender, min_age, max_age')
      .eq('user_id', myId)
      .maybeSingle()
    if (prefRows) {
      if (prefRows.preferred_gender) setPreferredGender(prefRows.preferred_gender)
      if (prefRows.min_age) setMinAge(prefRows.min_age)
      if (prefRows.max_age) setMaxAge(prefRows.max_age)
    }

    const { data: lfRow } = await supabase
      .from('profiles')
      .select('looking_for')
      .eq('id', myId)
      .single()
    if (lfRow?.looking_for) setLookingFor(lfRow.looking_for)

    const { data: interRows } = await supabase.from('interests').select('id, name').order('id')
    setAvailableInterests(interRows || [])

    const { data: myInterests } = await supabase
      .from('profile_interests').select('interest_id').eq('profile_id', myId)
    setSelectedInterests((myInterests || []).map((r) => r.interest_id))

    const { data: promptRows } = await supabase
      .from('profile_prompts')
      .select('prompt_key, answer, display_order')
      .eq('profile_id', myId)
      .order('display_order', { ascending: true })
    setPrompts(promptRows || [])

    const { data: photoRows } = await supabase
      .from('profile_photos')
      .select('id, storage_path, is_primary, display_order')
      .eq('user_id', myId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    setPhotos((photoRows || []).map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      is_primary: p.is_primary,
      display_order: p.display_order,
      url: publicPhotoUrl(p.storage_path),
    })))

    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  function toggleInterest(id) {
    setSelectedInterests((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    )
  }

  async function uploadPhoto(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`You can have up to ${MAX_PHOTOS} photos.`)
      return
    }
    setUploading(true); setError('')

    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > 8 * 1024 * 1024) { setError('Each photo must be under 8 MB.'); continue }

      const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${myId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, f, { upsert: false, contentType: f.type })
      if (upErr) { setError(upErr.message); continue }

      const isFirst = photos.length === 0
      const { data: inserted, error: insErr } = await supabase
        .from('profile_photos')
        .insert({
          user_id: myId,
          storage_path: path,
          display_order: photos.length,
          is_primary: isFirst,
        })
        .select('id, storage_path, is_primary, display_order')
        .single()
      if (insErr) { setError(insErr.message); continue }

      setPhotos((cur) => [...cur, {
        id: inserted.id,
        storage_path: inserted.storage_path,
        is_primary: inserted.is_primary,
        display_order: inserted.display_order,
        url: publicPhotoUrl(inserted.storage_path),
      }])
    }

    setUploading(false)
  }

  async function deletePhoto(photo) {
    if (!confirm('Remove this photo?')) return
    tap('light')
    await supabase.storage.from('profile-photos').remove([photo.storage_path])
    await supabase.from('profile_photos').delete().eq('id', photo.id)

    const remaining = photos.filter((p) => p.id !== photo.id)
    // If we deleted the primary, promote the first remaining
    if (photo.is_primary && remaining.length > 0) {
      await supabase.from('profile_photos').update({ is_primary: true }).eq('id', remaining[0].id)
      remaining[0].is_primary = true
    }
    setPhotos(remaining)
  }

  async function setPrimaryPhoto(photo) {
    if (photo.is_primary) return
    tap('light')
    await supabase.from('profile_photos').update({ is_primary: false }).eq('user_id', myId)
    await supabase.from('profile_photos').update({ is_primary: true }).eq('id', photo.id)
    setPhotos((cur) => cur.map((p) => ({ ...p, is_primary: p.id === photo.id })))
  }

  async function save() {
    if (!myId) return
    setError(''); setSavedMsg('')

    if (!displayName.trim()) return setError('Display name is required.')
    if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase()))
      return setError('Username: 3–20 letters, numbers, or underscores.')
    if (!bio.trim()) return setError('Please write a short bio.')
    if (bio.length > MAX_BIO) return setError(`Bio must be ${MAX_BIO} characters or less.`)
    if (!city.trim()) return setError('City is required.')
    if (selectedInterests.length < 3) return setError('Choose at least 3 interests.')
    if (photos.length === 0) return setError('Add at least one photo.')

    setSaving(true)

    const { data: updated, error: pErr } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        city: city.trim(),
        country: country.trim() || 'Burundi',
        looking_for: lookingFor || null,
        profession: profession.trim() || null,
        education: education || null,
        religion: religion.trim() || null,
        relationship_status: relationshipStatus || null,
        body_height_cm: bodyHeightCm ? parseInt(bodyHeightCm, 10) : null,
        languages: languages,
        body_type: bodyType || null,
        personality: personality || null,
        relationship_preference: relationshipPreference || null,
        music_genres: musicGenres,
        smoker: smoker || null,
        drinking: drinking || null,
        partying: partying || null,
        exercise: exercise || null,
        tattoos: tattoos || null,
        diet: diet || null,
        pets: pets || null,
        children: children || null,
        hide_online_status: hideOnlineStatus,
        hide_age: hideAge,
        incognito_mode: incognitoMode,
        only_matches_can_message: onlyMatchesCanMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', myId)
      .select('id')

    if (pErr) { setSaving(false); setError(pErr.message); return }
    if (!updated?.length) { setSaving(false); setError('Could not save profile. Try logging out and in again.'); return }

    // Save discovery preferences (upsert)
    const { error: prefErr } = await supabase
      .from('discovery_preferences')
      .upsert(
        {
          user_id: myId,
          preferred_gender: preferredGender || null,
          min_age: minAge,
          max_age: maxAge,
          max_distance_km: 500,
        },
        { onConflict: 'user_id' }
      )
    if (prefErr) { setSaving(false); setError(prefErr.message); return }

    // Save prompts
    await supabase.from('profile_prompts').delete().eq('profile_id', myId)
    const cleanPrompts = prompts.filter((p) => p.prompt_key && p.answer && p.answer.trim().length > 0)
    if (cleanPrompts.length > 0) {
      const { error: promptErr } = await supabase
        .from('profile_prompts')
        .insert(cleanPrompts.map((p, i) => ({
          profile_id: myId,
          prompt_key: p.prompt_key,
          answer: p.answer.trim(),
          display_order: i,
        })))
      if (promptErr) { setSaving(false); setError(promptErr.message); return }
    }

    await supabase.from('profile_interests').delete().eq('profile_id', myId)
    const { error: iErr } = await supabase.from('profile_interests').insert(
      selectedInterests.map((id) => ({ profile_id: myId, interest_id: id }))
    )
    if (iErr) { setSaving(false); setError(iErr.message); return }

    const { data: refreshed } = await supabase
      .from('profiles').select('*').eq('id', myId).single()
    setProfile(refreshed)

    setSaving(false)
    // If the profile is now complete, grant the 100-coin bonus silently.
    try { await supabase.rpc('claim_profile_complete_bonus') } catch {}

    setSavedMsg('Saved.')
    tap('medium')
    setTimeout(() => setSavedMsg(''), 1600)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <ProfileTabs active="edit" />

      {error && (
        <div className="mx-3 mt-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="mx-3 mt-2 text-success text-[12.5px] bg-success/10 border border-success/30 rounded-xl px-3 py-2.5 shrink-0">
          {savedMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-24">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : (
          <>
            {/* Photos */}
            <SectionTitle>Photos</SectionTitle>
            <p className="text-subtle text-[12px] mb-3">
              First photo is your main. Up to {MAX_PHOTOS} photos. Tap the star to change the main one.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {photos.map((p) => (
                <div key={p.id} className="relative rounded-2xl overflow-hidden bg-elevated aspect-[3/4]">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  {p.is_primary && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-bold">
                      MAIN
                    </span>
                  )}
                  <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                    {!p.is_primary && (
                      <button
                        onClick={() => setPrimaryPhoto(p)}
                        className="w-6 h-6 rounded-full grid place-items-center bg-obsidian/80 border border-white/20"
                        aria-label="Set as main"
                      >
                        <Star size={11} strokeWidth={2.6} className="text-gold-400" fill="currentColor" />
                      </button>
                    )}
                    <button
                      onClick={() => deletePhoto(p)}
                      className="w-6 h-6 rounded-full grid place-items-center bg-obsidian/80 border border-white/20"
                      aria-label="Delete photo"
                    >
                      <Trash2 size={11} strokeWidth={2.6} className="text-danger" />
                    </button>
                  </div>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-2xl aspect-[3/4] border-2 border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Camera size={20} strokeWidth={2} className="text-muted" />
                  <span className="text-subtle text-[10.5px] font-medium">
                    {uploading ? 'Uploading…' : 'Add'}
                  </span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={uploadPhoto}
            />

            {/* Basics */}
            <SectionTitle>Basics</SectionTitle>
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Username" hint="Lowercase, 3–20 chars, no spaces.">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Country">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>

            {/* Bio */}
            <SectionTitle>About you</SectionTitle>
            <Field label="Bio" hint={`${bio.length}/${MAX_BIO}`}>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={MAX_BIO}
                rows={4}
                placeholder="Something real about you."
                className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none"
              />
            </Field>

            {/* My details */}
            {/* Prompts */}
            <SectionTitle>Get to know me</SectionTitle>
            <p className="text-subtle text-[12px] mb-3">
              Answer 3 quick questions to show your personality.
            </p>

            {[0, 1, 2].map((slot) => {
              const prompt = prompts[slot] || { prompt_key: '', answer: '' }
              const isEditing = editingPromptSlot === slot
              const definition = PROMPT_LIBRARY.find((p) => p.key === prompt.prompt_key)

              return (
                <div key={slot} className="mb-3">
                  {isEditing ? (
                    <div className="rounded-2xl bg-surface border border-purple-500/30 p-3">
                      <p className="text-cream text-[13px] font-semibold mb-2">
                        Pick a question for slot {slot + 1}
                      </p>
                      <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto mb-3">
                        {PROMPT_LIBRARY.map((lib) => {
                          const alreadyUsed = prompts.some((p, i) => i !== slot && p.prompt_key === lib.key)
                          const selected = prompt.prompt_key === lib.key
                          return (
                            <button
                              key={lib.key}
                              type="button"
                              disabled={alreadyUsed}
                              onClick={() => {
                                const next = [...prompts]
                                next[slot] = { ...next[slot], prompt_key: lib.key, answer: next[slot]?.answer || '' }
                                // remove gaps
                                const compact = next.filter((p) => p.prompt_key)
                                setPrompts(compact)
                                setEditingPromptSlot(null)
                              }}
                              className={`text-left px-3 py-2 rounded-xl text-[12.5px] font-medium transition-colors ${
                                selected
                                  ? 'bg-purple-600 text-white'
                                  : alreadyUsed
                                    ? 'bg-elevated text-subtle opacity-50'
                                    : 'bg-elevated text-muted hover:text-cream'
                              }`}
                            >
                              {lib.label}
                              {alreadyUsed && ' · used'}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPromptSlot(null)}
                        className="w-full h-9 rounded-xl bg-white/[0.05] text-muted text-[12.5px] font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : prompt.prompt_key ? (
                    <div className="rounded-2xl bg-surface border border-white/8 p-3.5">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <p className="text-purple-300 text-[11px] font-bold tracking-wide uppercase truncate">
                          {definition?.label || prompt.prompt_key}
                        </p>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingPromptSlot(slot)}
                            className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/[0.06] text-muted"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = prompts.filter((_, i) => i !== slot)
                              setPrompts(next)
                            }}
                            className="text-[10.5px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={prompt.answer}
                        onChange={(e) => {
                          const next = [...prompts]
                          next[slot] = { ...next[slot], answer: e.target.value.slice(0, 200) }
                          setPrompts(next)
                        }}
                        placeholder="Your answer…"
                        rows={2}
                        maxLength={200}
                        className="w-full bg-elevated border border-white/8 rounded-xl px-3 py-2 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none"
                      />
                      <p className="text-subtle text-[10.5px] mt-1 text-right">
                        {prompt.answer.length}/200
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingPromptSlot(slot)}
                      className="w-full rounded-2xl bg-surface border border-dashed border-white/15 p-3.5 text-left hover:border-purple-500/40 transition-colors"
                    >
                      <p className="text-cream text-[13px] font-semibold mb-0.5">
                        Add prompt {slot + 1}
                      </p>
                      <p className="text-muted text-[11.5px]">
                        Pick a question and answer it.
                      </p>
                    </button>
                  )}
                </div>
              )
            })}

            <SectionTitle>My details</SectionTitle>

            <Field label="Profession">
              <Input
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="e.g. Teacher, Engineer, Student"
              />
            </Field>

            <Field label="Education">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'high_school', label: 'High school' },
                  { v: 'some_college', label: 'Some college' },
                  { v: 'bachelors', label: "Bachelor's" },
                  { v: 'masters', label: "Master's" },
                  { v: 'doctorate', label: 'Doctorate' },
                  { v: 'other', label: 'Other' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setEducation(education === opt.v ? '' : opt.v)}
                    className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
                      education === opt.v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Religion">
              <Input
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                placeholder="e.g. Christian, Muslim"
              />
            </Field>

            <Field label="Relationship status">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'single', label: 'Single' },
                  { v: 'divorced', label: 'Divorced' },
                  { v: 'separated', label: 'Separated' },
                  { v: 'widowed', label: 'Widowed' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRelationshipStatus(relationshipStatus === opt.v ? '' : opt.v)}
                    className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
                      relationshipStatus === opt.v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Relationship preference">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'monogamous', label: 'Monogamous' },
                  { v: 'open', label: 'Open relationship' },
                  { v: 'figuring_out', label: 'Figuring it out' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRelationshipPreference(relationshipPreference === opt.v ? '' : opt.v)}
                    className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
                      relationshipPreference === opt.v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Body type">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'slim', label: 'Slim' },
                  { v: 'average', label: 'Average' },
                  { v: 'athletic', label: 'Athletic' },
                  { v: 'muscular', label: 'Muscular' },
                  { v: 'curvy', label: 'Curvy' },
                  { v: 'other', label: 'Other' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setBodyType(bodyType === opt.v ? '' : opt.v)}
                    className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
                      bodyType === opt.v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Personality">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'introvert', label: 'Introvert' },
                  { v: 'extrovert', label: 'Extrovert' },
                  { v: 'ambivert', label: 'A mix of both' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setPersonality(personality === opt.v ? '' : opt.v)}
                    className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
                      personality === opt.v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Height" hint="In centimeters. Optional.">
              <input
                type="number"
                min={100}
                max={250}
                value={bodyHeightCm}
                onChange={(e) => setBodyHeightCm(e.target.value)}
                placeholder="e.g. 172"
                className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
              />
            </Field>

            <Field label="Languages" hint="Pick the ones you speak.">
              <div className="flex gap-2">
                {[
                  { v: 'french', label: '🇫🇷 Français' },
                  { v: 'english', label: '🇬🇧 English' },
                ].map((opt) => {
                  const on = languages.includes(opt.v)
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() =>
                        setLanguages((cur) =>
                          cur.includes(opt.v) ? cur.filter((x) => x !== opt.v) : [...cur, opt.v]
                        )
                      }
                      className={`px-4 py-2.5 rounded-full text-[13.5px] font-semibold border transition-colors ${
                        on
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'bg-elevated border-line text-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </Field>

<Field label="Music" hint="Pick the genres you love.">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'hip_hop', label: 'Hip-Hop' },
                  { v: 'rnb', label: 'R&B' },
                  { v: 'classical', label: 'Classical' },
                  { v: 'country', label: 'Country' },
                  { v: 'soul', label: 'Soul' },
                  { v: 'afro', label: 'Afro' },
                  { v: 'pop', label: 'Pop' },
                  { v: 'rock', label: 'Rock' },
                  { v: 'jazz', label: 'Jazz' },
                  { v: 'gospel', label: 'Gospel' },
                ].map((opt) => {
                  const on = musicGenres.includes(opt.v)
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() =>
                        setMusicGenres((cur) =>
                          cur.includes(opt.v) ? cur.filter((x) => x !== opt.v) : [...cur, opt.v]
                        )
                      }
                      className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
                        on
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'bg-elevated border-line text-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <SectionTitle>Lifestyle</SectionTitle>

            <Field label="Smoker">
              <ChipSelect
                value={smoker}
                onChange={setSmoker}
                options={[
                  { v: 'never', label: 'Never' },
                  { v: 'sometimes', label: 'Sometimes' },
                  { v: 'regularly', label: 'Regularly' },
                ]}
              />
            </Field>

            <Field label="Drinking">
              <ChipSelect
                value={drinking}
                onChange={setDrinking}
                options={[
                  { v: 'never', label: 'Never' },
                  { v: 'socially', label: 'Socially' },
                  { v: 'regularly', label: 'Regularly' },
                ]}
              />
            </Field>

            <Field label="Partying">
              <ChipSelect
                value={partying}
                onChange={setPartying}
                options={[
                  { v: 'never', label: 'Never' },
                  { v: 'sometimes', label: 'Sometimes' },
                  { v: 'often', label: 'Often' },
                ]}
              />
            </Field>

            <Field label="Exercise">
              <ChipSelect
                value={exercise}
                onChange={setExercise}
                options={[
                  { v: 'never', label: 'Never' },
                  { v: 'sometimes', label: 'Sometimes' },
                  { v: 'regularly', label: 'Regularly' },
                  { v: 'daily', label: 'Daily' },
                ]}
              />
            </Field>

            <Field label="Tattoos">
              <ChipSelect
                value={tattoos}
                onChange={setTattoos}
                options={[
                  { v: 'none', label: 'None' },
                  { v: 'some', label: 'Some' },
                  { v: 'many', label: 'Many' },
                ]}
              />
            </Field>

            <Field label="Diet">
              <ChipSelect
                value={diet}
                onChange={setDiet}
                options={[
                  { v: 'no_preference', label: 'No preference' },
                  { v: 'vegetarian', label: 'Vegetarian' },
                  { v: 'vegan', label: 'Vegan' },
                  { v: 'halal', label: 'Halal' },
                  { v: 'other', label: 'Other' },
                ]}
              />
            </Field>

            <Field label="Pets">
              <ChipSelect
                value={pets}
                onChange={setPets}
                options={[
                  { v: 'none', label: 'None' },
                  { v: 'cat', label: 'Cat' },
                  { v: 'dog', label: 'Dog' },
                  { v: 'both', label: 'Both' },
                  { v: 'other', label: 'Other' },
                ]}
              />
            </Field>

            <Field label="Children">
              <ChipSelect
                value={children}
                onChange={setChildren}
                options={[
                  { v: 'have', label: 'I have children' },
                  { v: 'want_someday', label: 'Want someday' },
                  { v: 'dont_want', label: "Don't want" },
                  { v: 'open', label: 'Open' },
                ]}
              />
            </Field>

            {/* Privacy */}
            <SectionTitle>Privacy</SectionTitle>
            <p className="text-subtle text-[12px] mb-3">
              Control who sees what on your profile.
            </p>

            <PrivacyToggle
              label="Hide online status"
              desc="Others won't see when you were last active."
              on={hideOnlineStatus}
              onToggle={() => setHideOnlineStatus(!hideOnlineStatus)}
            />

            <PrivacyToggle
              label="Hide your age"
              desc="Your age won't appear on your profile or cards."
              on={hideAge}
              onToggle={() => setHideAge(!hideAge)}
            />

            <PrivacyToggle
              label="Incognito mode"
              desc="You disappear from Discover. Only people you already liked can still see you."
              on={incognitoMode}
              onToggle={() => setIncognitoMode(!incognitoMode)}
            />

            <PrivacyToggle
              label="Only matches can message you"
              desc="Nobody you haven't matched with can open a chat."
              on={onlyMatchesCanMessage}
              onToggle={() => setOnlyMatchesCanMessage(!onlyMatchesCanMessage)}
            />

            {/* Preferences */}
            <SectionTitle>Preferences</SectionTitle>
            <Field label="Interested in">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'female', label: 'Women' },
                  { v: 'male', label: 'Men' },
                  { v: 'everyone', label: 'Everyone' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPreferredGender(v)}
                    className={`py-3 rounded-2xl text-[13.5px] font-semibold transition-colors border ${
                      preferredGender === v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Age range" hint="People outside this range won't appear in your Discover.">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-subtle text-[11px] mb-1.5">From</p>
                  <input
                    type="number"
                    min={18}
                    max={100}
                    value={minAge}
                    onChange={(e) => setMinAge(Number(e.target.value) || 18)}
                    className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream text-[15px] focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-subtle text-[11px] mb-1.5">To</p>
                  <input
                    type="number"
                    min={18}
                    max={100}
                    value={maxAge}
                    onChange={(e) => setMaxAge(Number(e.target.value) || 40)}
                    className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream text-[15px] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </Field>

            {/* Looking for */}
            <SectionTitle>Looking for</SectionTitle>
            <div className="flex flex-col gap-2.5 mb-6">
              {[
                { v: 'serious', title: 'A serious relationship', desc: "You're ready to build something real.", emoji: '💜' },
                { v: 'dating',  title: 'Dating',                desc: 'Open to meeting people and seeing what happens.', emoji: '✨' },
                { v: 'friends', title: 'Friendship first',      desc: 'Start as friends, let it grow.', emoji: '🤝' },
                { v: 'unsure',  title: 'Still figuring it out', desc: "You're open to anything.", emoji: '🌱' },
              ].map((opt) => {
                const on = lookingFor === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setLookingFor(opt.v)}
                    className={`text-left p-3.5 rounded-2xl border transition-colors flex items-start gap-3 ${
                      on ? 'bg-purple-600/20 border-purple-500' : 'bg-elevated border-line'
                    }`}
                  >
                    <span className="text-xl shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-bold text-[14px] mb-0.5">{opt.title}</p>
                      <p className="text-muted text-[12px] leading-snug">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Interests */}
            <SectionTitle>Interests</SectionTitle>
            <p className="text-subtle text-[12px] mb-3">
              Choose 3 to 8. {selectedInterests.length} selected.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableInterests.map((it) => {
                const on = selectedInterests.includes(it.id)
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleInterest(it.id)}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-colors ${
                      on
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-white/8 text-muted'
                    }`}
                  >
                    {it.name}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Save bar */}
      <div
        className="shrink-0 px-5 pt-3 border-t border-white/8"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={save}
          disabled={saving || loading}
          className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-[15px] shadow-[0_10px_28px_rgba(124,58,237,0.5)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mt-6 mb-3">
      {children}
    </p>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block mb-4">
      {label && <span className="block text-[13px] font-semibold text-muted mb-2">{label}</span>}
      {children}
      {hint && <span className="block text-[11.5px] text-subtle mt-1.5">{hint}</span>}
    </label>
  )
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
    />
  )
}


function ChipSelect({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = value === opt.v
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(on ? '' : opt.v)}
            className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
              on
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-elevated border-line text-muted'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}


function PrivacyToggle({ label, desc, on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3.5 mb-2 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-cream font-semibold text-[14px] mb-0.5">{label}</p>
        <p className="text-muted text-[12px] leading-snug">{desc}</p>
      </div>
      <span
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-purple-600' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

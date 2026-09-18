import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Users, User, Sparkles, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, Field, Input, Textarea } from '../components/UI'
import BrandGlow from '../components/BrandGlow'

const STEPS = ['Identity', 'About you', 'Preferences', 'Looking for', 'Where & bio', 'Interests', 'Photo']

const LOOKING_FOR_OPTIONS = [
  {
    value: 'serious',
    title: 'A serious relationship',
    desc: "You're ready to build something real.",
    emoji: '💜',
  },
  {
    value: 'dating',
    title: 'Dating',
    desc: 'Open to meeting people and seeing what happens.',
    emoji: '✨',
  },
  {
    value: 'friends',
    title: 'Friendship first',
    desc: 'Start as friends, let it grow.',
    emoji: '🤝',
  },
  {
    value: 'unsure',
    title: 'Still figuring it out',
    desc: "You're open to anything.",
    emoji: '🌱',
  },
]

function calcAge(dob) {
  if (!dob) return null
  const b = new Date(dob)
  const t = new Date()
  let a = t.getFullYear() - b.getFullYear()
  const m = t.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--
  return a
}

export default function Onboarding() {
  const nav = useNavigate()
  const { session, profile, setProfile } = useAuth()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Identity
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')

  // About you
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')

  // Preferences
  const [preferredGender, setPreferredGender] = useState('')
  const [minAge, setMinAge] = useState(20)
  const [maxAge, setMaxAge] = useState(40)

  // Looking for
  const [lookingFor, setLookingFor] = useState('')

  // Where & bio
  const [city, setCity] = useState('Bujumbura')
  const [country, setCountry] = useState('Burundi')
  const [bio, setBio] = useState('')

  // Interests
  const [availableInterests, setAvailableInterests] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])

  // Photo
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  // Load existing profile state
  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('interests')
      .select('id, name')
      .order('id')
      .then(({ data }) => setAvailableInterests(data || []))

    supabase
      .from('profile_interests')
      .select('interest_id')
      .eq('profile_id', session.user.id)
      .then(({ data }) => {
        if (data) setSelectedInterests(data.map((r) => r.interest_id))
      })

    supabase
      .from('discovery_preferences')
      .select('preferred_gender, min_age, max_age')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.preferred_gender) setPreferredGender(data.preferred_gender)
          if (data.min_age) setMinAge(data.min_age)
          if (data.max_age) setMaxAge(data.max_age)
        }
      })
  }, [session?.user?.id])

  useEffect(() => {
    if (profile) {
      setDisplayName((v) => v || profile.display_name || '')
      setUsername((v) => v || profile.username || '')
      setDob((v) => v || profile.date_of_birth || '')
      setGender((v) => v || profile.gender || '')
      setCity((v) => v || profile.city || 'Bujumbura')
      setCountry((v) => v || profile.country || 'Burundi')
      setBio((v) => v || profile.bio || '')
      setLookingFor((v) => v || profile.looking_for || '')
    }
  }, [profile])

  function validate() {
    setError('')
    if (step === 1) {
      if (!displayName.trim()) { setError('Please enter your name.'); return false }
      if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) {
        setError('Username: 3–20 letters, numbers, or underscores.'); return false
      }
    }
    if (step === 2) {
      if (!dob) { setError('Please enter your date of birth.'); return false }
      const age = calcAge(dob)
      if (age === null || age < 18) { setError('You must be 18 or older.'); return false }
      if (age > 100) { setError('Please enter a valid date of birth.'); return false }
      if (!gender) { setError('Please select your gender.'); return false }
    }
    if (step === 3) {
      if (!preferredGender) { setError('Please choose who you want to meet.'); return false }
      if (minAge < 18 || minAge > 100 || maxAge < 18 || maxAge > 100) {
        setError('Age range must be between 18 and 100.'); return false
      }
      if (maxAge < minAge) { setError('Max age must be higher than min age.'); return false }
    }
    if (step === 4) {
      if (!lookingFor) { setError('Please pick what you are looking for.'); return false }
    }
    if (step === 5) {
      if (!city.trim()) { setError('Please enter your city.'); return false }
      if (!bio.trim()) { setError('Please write a short bio.'); return false }
      if (bio.length > 300) { setError('Bio must be 300 characters or less.'); return false }
    }
    if (step === 6) {
      if (selectedInterests.length < 3) { setError('Choose at least 3 interests.'); return false }
    }
    if (step === 7) {
      if (!photoFile && !photoPreview) {
        setError('Please add a profile photo to finish.')
        return false
      }
    }
    return true
  }

  function next() {
    if (!validate()) return
    if (step === STEPS.length) return finish()
    setStep((s) => s + 1)
  }

  function back() {
    setError('')
    if (step === 1) return nav('/')
    setStep((s) => s - 1)
  }

  function toggleInterest(id) {
    setSelectedInterests((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    )
  }

  function onPhotoChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please choose an image.'); return }
    if (f.size > 8 * 1024 * 1024) { setError('Image must be under 8 MB.'); return }
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  async function finish() {
    if (!session?.user?.id) return
    if (!photoFile && !photoPreview) {
      setError('Please add a profile photo to finish.')
      return
    }
    setBusy(true); setError('')
    const userId = session.user.id

    // 1. Profile
    const { error: pErr } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        date_of_birth: dob,
        gender,
        looking_for: lookingFor,
        city: city.trim(),
        country: country.trim() || 'Burundi',
        bio: bio.trim(),
      })
      .eq('id', userId)

    if (pErr) { setBusy(false); setError(pErr.message); return }

    // 2. Discovery preferences (upsert — creates row if missing)
    const { error: prefErr } = await supabase
      .from('discovery_preferences')
      .upsert(
        {
          user_id: userId,
          preferred_gender: preferredGender,
          min_age: minAge,
          max_age: maxAge,
          max_distance_km: 500,
        },
        { onConflict: 'user_id' }
      )

    if (prefErr) { setBusy(false); setError(prefErr.message); return }

    // 3. Interests
    await supabase.from('profile_interests').delete().eq('profile_id', userId)
    const { error: iErr } = await supabase
      .from('profile_interests')
      .insert(selectedInterests.map((id) => ({ profile_id: userId, interest_id: id })))
    if (iErr) { setBusy(false); setError(iErr.message); return }

    // 4. Photo
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error: uErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, photoFile, { upsert: false, contentType: photoFile.type })
      if (uErr) { setBusy(false); setError(uErr.message); return }

      await supabase
        .from('profile_photos')
        .delete()
        .eq('user_id', userId)
        .eq('is_primary', true)

      await supabase.from('profile_photos').insert({
        user_id: userId,
        storage_path: path,
        display_order: 0,
        is_primary: true,
      })
    }

    // 5. Refresh
    const { data: refreshed } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(refreshed)

    // If the profile is now complete, grant the 100-coin bonus silently.
    // Function is idempotent — safe to call every time.
    try { await supabase.rpc('claim_profile_complete_bonus') } catch {}

    setBusy(false)
    nav('/discover', { replace: true })
  }

  return (
    <div className="mobile-shell flex flex-col isolate" style={{ position: 'relative' }}>
      <BrandGlow />
      {/* Ambient glow — anchored to the bottom so titles stay crisp */}

      <header className="px-7 pt-8 pb-4">
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i + 1 <= step ? 'bg-purple-500' : 'bg-line'
              }`}
            />
          ))}
        </div>
        <p className="text-subtle text-[11px] font-semibold tracking-[0.14em] uppercase">
          Step {step} of {STEPS.length} · {STEPS[step - 1]}
        </p>
      </header>

      <main className="flex-1 px-7 pb-6 overflow-y-auto">
        {step === 1 && (
          <Section
            title="What should we call you?"
            sub="Your name and username are how people will find you."
          >
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Bella" />
            </Field>
            <Field label="Username" hint="Lowercase, 3–20 chars, no spaces.">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. bella_b" />
            </Field>
          </Section>
        )}

        {step === 2 && (
          <Section
            title="About you"
            sub="Nakubonye is for adults only. Your age shows on your profile."
          >
            <Field label="Date of birth">
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Gender">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'female', label: 'Woman' },
                  { v: 'male', label: 'Man' },
                  { v: 'other', label: 'Other' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGender(v)}
                    className={`py-3 rounded-2xl text-[14px] font-semibold transition-colors border ${
                      gender === v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </Section>
        )}

        {step === 3 && (
          <Section
            title="Who do you want to meet?"
            sub="This decides who shows up in Discover. You can change it later."
          >
            <Field label="Interested in">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'female', label: 'Women', icon: <User size={16} /> },
                  { v: 'male', label: 'Men', icon: <User size={16} /> },
                  { v: 'everyone', label: 'Everyone', icon: <Users size={16} /> },
                ].map(({ v, label, icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPreferredGender(v)}
                    className={`py-3 rounded-2xl text-[13px] font-semibold transition-colors border flex flex-col items-center gap-1.5 ${
                      preferredGender === v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Age range" hint="People outside this range won't show up.">
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
          </Section>
        )}

        {step === 4 && (
          <Section
            title="What are you looking for?"
            sub="Honesty here means better connections."
          >
            <div className="flex flex-col gap-3">
              {LOOKING_FOR_OPTIONS.map((opt) => {
                const on = lookingFor === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLookingFor(opt.value)}
                    className={`text-left p-4 rounded-2xl border transition-colors flex items-start gap-3 ${
                      on
                        ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_24px_rgba(124,58,237,0.25)]'
                        : 'bg-elevated border-line'
                    }`}
                  >
                    <span className="text-2xl shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-bold text-[15px] mb-0.5 flex items-center gap-2">
                        {opt.title}
                        {on && <Check size={14} strokeWidth={3} className="text-purple-400" />}
                      </p>
                      <p className="text-muted text-[12.5px] leading-snug">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {step === 5 && (
          <Section
            title="Where are you?"
            sub="We only show your city — never your exact location."
          >
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bujumbura" />
            </Field>
            <Field label="Country">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Burundi" />
            </Field>
            <Field label="A short bio" hint={`${bio.length}/300`}>
              <Textarea
                rows={5}
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Something real about you. What you love, what you're looking for."
              />
            </Field>
          </Section>
        )}

        {step === 6 && (
          <Section
            title="What are you into?"
            sub={`Choose 3 to 8. ${selectedInterests.length} selected.`}
          >
            <div className="flex flex-wrap gap-2">
              {availableInterests.map((it) => {
                const on = selectedInterests.includes(it.id)
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleInterest(it.id)}
                    className={`px-4 py-2.5 rounded-full text-[13.5px] font-semibold transition-colors border ${
                      on
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-elevated border-line text-muted'
                    }`}
                  >
                    {it.name}
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {step === 7 && (
          <Section
            title="Add a photo"
            sub="A clear face photo works best. You can add more later."
          >
            <label className="block">
              <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
              <div className="aspect-[3/4] rounded-3xl border-2 border-dashed border-line bg-elevated grid place-items-center overflow-hidden cursor-pointer">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center px-6">
                    <p className="text-cream font-semibold mb-1">Tap to choose</p>
                    <p className="text-subtle text-[12.5px]">JPG, PNG, or WebP · up to 8 MB</p>
                  </div>
                )}
              </div>
            </label>
          </Section>
        )}

        {error && (
          <div className="mt-6 text-danger text-[13.5px] bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3">
            {error}
          </div>
        )}
      </main>

      <footer className="px-7 pb-8 pt-4 flex gap-3">
        <button
          type="button"
          onClick={back}
          disabled={busy}
          className="px-6 rounded-full bg-elevated border border-line text-muted font-semibold text-[15px] disabled:opacity-50"
        >
          Back
        </button>
        <Button onClick={next} disabled={busy} className="flex-1">
          {busy ? 'Saving…' : step === STEPS.length ? 'Finish & start discovering' : 'Continue'}
        </Button>
      </footer>
    </div>
  )
}

function Section({ title, sub, children }) {
  return (
    <div>
      <h1 className="text-cream text-[24px] leading-[1.2] font-extrabold tracking-tight mb-2">
        {title}
      </h1>
      <p className="text-muted text-[14.5px] mb-7">{sub}</p>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  )
}

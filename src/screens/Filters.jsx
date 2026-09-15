import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

export default function Filters() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [preferredGender, setPreferredGender] = useState('')
  const [minAge, setMinAge] = useState(18)
  const [maxAge, setMaxAge] = useState(100)
  const [sameCity, setSameCity] = useState(false)
  const [sameCountry, setSameCountry] = useState(false)
  const [sharedInterests, setSharedInterests] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')

    // Load preferences
    const { data: pref } = await supabase
      .from('discovery_preferences')
      .select('preferred_gender, min_age, max_age')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (pref) {
      setPreferredGender(pref.preferred_gender || '')
      setMinAge(pref.min_age || 18)
      setMaxAge(pref.max_age || 100)
    }

    // Load local Discover filters from sessionStorage (fast, no DB round-trip)
    const saved = sessionStorage.getItem('discover_filters')
    if (saved) {
      try {
        const f = JSON.parse(saved)
        setSameCity(!!f.sameCity)
        setSameCountry(!!f.sameCountry)
        setSharedInterests(!!f.sharedInterests)
        setVerifiedOnly(!!f.verifiedOnly)
        setOnlineOnly(!!f.onlineOnly)
      } catch {}
    }

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!session?.user?.id) return
    setSaving(true); setError('')

    // Validate age range
    if (minAge < 18 || minAge > 100 || maxAge < 18 || maxAge > 100) {
      setSaving(false)
      return setError('Age range must be between 18 and 100.')
    }
    if (maxAge < minAge) {
      setSaving(false)
      return setError('Max age must be higher than min age.')
    }

    // Save to discovery_preferences
    const { error: prefErr } = await supabase
      .from('discovery_preferences')
      .upsert({
        user_id: session.user.id,
        preferred_gender: preferredGender || null,
        min_age: minAge,
        max_age: maxAge,
        max_distance_km: 500,
      }, { onConflict: 'user_id' })

    if (prefErr) { setSaving(false); setError(prefErr.message); return }

    // Save Discover-local filters to sessionStorage
    sessionStorage.setItem('discover_filters', JSON.stringify({
      sameCity, sameCountry, sharedInterests, verifiedOnly, onlineOnly,
    }))

    setSaving(false)
    tap('light')
    nav(-1)
  }

  function reset() {
    tap('light')
    setPreferredGender('')
    setMinAge(18)
    setMaxAge(100)
    setSameCity(false)
    setSameCountry(false)
    setSharedInterests(false)
    setVerifiedOnly(false)
    setOnlineOnly(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-pink-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Filters</span>
        <button
          onClick={reset}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Reset"
        >
          <RotateCcw size={17} strokeWidth={2.3} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-32">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : (
          <>
            {/* Looking to meet */}
            <SectionTitle>Looking to meet</SectionTitle>
            <div className="grid grid-cols-3 gap-2 mb-7">
              {[
                { v: 'female', label: 'Women' },
                { v: 'male', label: 'Men' },
                { v: 'everyone', label: 'Everyone' },
              ].map((opt) => {
                const on = preferredGender === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => { tap('light'); setPreferredGender(on ? '' : opt.v) }}
                    className={`py-3 rounded-2xl text-[14px] font-semibold transition-colors border ${
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

            {/* Age range */}
            <SectionTitle>Age</SectionTitle>
            <div className="flex items-center gap-3 mb-2">
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
                  onChange={(e) => setMaxAge(Number(e.target.value) || 100)}
                  className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream text-[15px] focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <p className="text-subtle text-[11.5px] mb-7">
              Showing people between {minAge} and {maxAge} years old.
            </p>

            {/* Location toggles */}
            <SectionTitle>Location</SectionTitle>
            <ToggleRow
              label="Only from my country"
              desc="Show people in your country"
              on={sameCountry}
              onToggle={() => { tap('light'); setSameCountry(!sameCountry) }}
            />
            <ToggleRow
              label="Same city only"
              desc="Show people in your city"
              on={sameCity}
              onToggle={() => { tap('light'); setSameCity(!sameCity) }}
            />

            {/* Match quality */}
            <SectionTitle>Match quality</SectionTitle>
            <ToggleRow
              label="Shared interests"
              desc="Only people who share at least one of your interests"
              on={sharedInterests}
              onToggle={() => { tap('light'); setSharedInterests(!sharedInterests) }}
            />
            <ToggleRow
              label="Verified profiles only"
              desc="Only show profiles with a verified badge"
              on={verifiedOnly}
              onToggle={() => { tap('light'); setVerifiedOnly(!verifiedOnly) }}
            />
            <ToggleRow
              label="Online only"
              desc="Only people active in the last 5 minutes"
              on={onlineOnly}
              onToggle={() => { tap('light'); setOnlineOnly(!onlineOnly) }}
            />

            {error && (
              <div className="mt-6 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Save bar */}
      <div
        className="shrink-0 px-5 pt-3 border-t border-white/8"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={save}
          disabled={saving || loading}
          className="w-full h-12 rounded-full text-white font-bold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
            boxShadow: '0 10px 28px rgba(236,72,153,0.5)',
          }}
        >
          {saving ? 'Saving…' : (<><Check size={17} strokeWidth={2.6} /> Save filters</>)}
        </button>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mt-2 mb-3">
      {children}
    </p>
  )
}

function ToggleRow({ label, desc, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3.5 mb-2 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-cream font-semibold text-[14px] mb-0.5">{label}</p>
        <p className="text-muted text-[12px] leading-snug">{desc}</p>
      </div>
      <span className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-purple-600' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

import { useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { tap } from "../lib/haptic"

const TAG_INTEREST_LIMIT = 12

export default function ProfileEditSheet({ kind, person, myId, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Details fields
  const [profession, setProfession] = useState(person?.profession || "")
  const [education, setEducation] = useState(person?.education || "")
  const [city, setCity] = useState(person?.city || "")
  const [country, setCountry] = useState(person?.country || "")
  const [relationship, setRelationship] = useState(person?.relationship_status || "")
  const [bio, setBio] = useState(person?.bio || "")

  // Hobbies fields — comma-split names into local text state
  const [hobbiesText, setHobbiesText] = useState(() => {
    const arr = Array.isArray(person?.music_genres) ? person.music_genres : []
    return arr.join(", ")
  })

  async function save() {
    if (!myId || busy) return
    setBusy(true); setError(""); tap("light")

    try {
      if (kind === "details") {
        const { error: err } = await supabase.from("profiles").update({
          profession: profession.trim() || null,
          education: education.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          relationship_status: relationship.trim() || null,
          bio: bio.trim() || null,
        }).eq("id", myId)
        if (err) throw err
        onSaved?.({
          profession: profession.trim() || null,
          education: education.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          relationship_status: relationship.trim() || null,
          bio: bio.trim() || null,
        })
      } else if (kind === "hobbies") {
        const list = hobbiesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, TAG_INTEREST_LIMIT)
        const { error: err } = await supabase.from("profiles").update({
          music_genres: list,
        }).eq("id", myId)
        if (err) throw err
        onSaved?.({ music_genres: list })
      }
      onClose?.()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] flex flex-col"
        style={{ maxHeight: "90dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="shrink-0 pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="shrink-0 flex items-center justify-between px-4 pb-3 border-b border-white/8">
          <h3 className="text-cream font-extrabold text-[16px]">
            {kind === "details" ? "Personal details" : "Hobbies"}
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {kind === "details" && (
            <>
              <Field label="Profession"      value={profession} onChange={setProfession} placeholder="e.g. Designer, Engineer…" />
              <Field label="Education"       value={education}  onChange={setEducation}  placeholder="e.g. University of Burundi" />
              <Field label="City"            value={city}       onChange={setCity}       placeholder="Bujumbura" />
              <Field label="Country"         value={country}    onChange={setCountry}    placeholder="Burundi" />
              <Field label="Relationship"    value={relationship} onChange={setRelationship} placeholder="Single, In a relationship…" />
              <div>
                <p className="text-muted text-[11.5px] font-bold uppercase tracking-wide mb-1.5">Bio</p>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="A few words about you…"
                  className="w-full rounded-2xl bg-white/[0.05] border border-white/8 px-4 py-3 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500 resize-none"
                />
                <p className="text-subtle text-[11px] mt-1 text-right">{bio.length}/300</p>
              </div>
            </>
          )}

          {kind === "hobbies" && (
            <div>
              <p className="text-muted text-[11.5px] font-bold uppercase tracking-wide mb-1.5">Your hobbies & interests</p>
              <textarea
                value={hobbiesText}
                onChange={(e) => setHobbiesText(e.target.value)}
                rows={3}
                placeholder="IT, Crafting, Programming, Visual Arts…"
                className="w-full rounded-2xl bg-white/[0.05] border border-white/8 px-4 py-3 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500 resize-none"
              />
              <p className="text-subtle text-[11px] mt-1">Separate with commas. Up to {TAG_INTEREST_LIMIT}.</p>
              {/* Preview */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {hobbiesText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, TAG_INTEREST_LIMIT).map((h, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[12px] font-semibold border border-purple-500/30 text-purple-100" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)" }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-300 text-[12.5px] text-center bg-red-500/10 border border-red-500/30 rounded-2xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 px-4 pt-3 border-t border-white/8">
          <button
            onClick={save}
            disabled={busy}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <p className="text-muted text-[11.5px] font-bold uppercase tracking-wide mb-1.5">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 80))}
        placeholder={placeholder}
        className="w-full h-11 rounded-2xl bg-white/[0.05] border border-white/8 px-4 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500"
      />
    </div>
  )
}

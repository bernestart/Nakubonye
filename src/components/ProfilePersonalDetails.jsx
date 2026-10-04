import { MapPin, Home, Cake, Briefcase, GraduationCap, Heart, Lock, Pencil } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { tap } from "../lib/haptic"

export default function ProfilePersonalDetails({ person, isMe = false }) {
  if (!person) return null

  const rows = []
  if (person.city || person.country) {
    const loc = [person.city, person.country].filter(Boolean).join(", ")
    rows.push({ icon: MapPin, text: loc, locked: false })
  }
  if (person.profession) {
    rows.push({ icon: Briefcase, text: person.profession, locked: false })
  }
  if (person.education) {
    rows.push({ icon: GraduationCap, text: person.education, locked: false })
  }
  if (person.relationship_status) {
    rows.push({ icon: Heart, text: person.relationship_status, locked: false })
  }
  if (person.date_of_birth) {
    const d = new Date(person.date_of_birth)
    rows.push({ icon: Cake, text: d.toLocaleDateString([], { day: "numeric", month: "long" }), locked: false })
  }

  if (rows.length === 0) return null

  return (
    <section className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-cream font-extrabold text-[17px]">Personal details</h2>
        {isMe && (
          <button
            onClick={() => { tap("light"); /* nav to edit */ }}
            className="w-8 h-8 rounded-full grid place-items-center text-muted"
            aria-label="Edit personal details"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-col">
        {rows.map((r, i) => {
          const Icon = r.icon
          return (
            <div key={i} className="flex items-center gap-3.5 py-3">
              <Icon size={22} strokeWidth={1.7} className="text-cream shrink-0" />
              <span className="text-cream text-[15px] font-medium flex-1 min-w-0 truncate">
                {r.text}
              </span>
              {r.locked && <Lock size={14} className="text-muted shrink-0" />}
            </div>
          )
        })}
        <button
          onClick={() => { tap("light") }}
          className="self-start mt-1 text-muted text-[14px] font-semibold py-2"
        >
          See more details
        </button>
      </div>
    </section>
  )
}

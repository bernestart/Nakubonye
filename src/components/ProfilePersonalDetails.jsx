import { useState } from "react"
import { MapPin, Home, Cake, Briefcase, GraduationCap, Heart, Lock, Pencil, Ruler, User, Languages, BookOpen, Sparkles, Cigarette, Wine, Dumbbell, Salad, PawPrint, Baby } from "lucide-react"
import { tap } from "../lib/haptic"

export default function ProfilePersonalDetails({ person, isMe = false, onEdit, visibility }) {
  const [expanded, setExpanded] = useState(false)
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
  if (person.relationship_status && (!visibility || visibility.relationship !== false)) {
    rows.push({ icon: Heart, text: person.relationship_status, locked: false })
  }
  if (person.date_of_birth && (!visibility || visibility.birthday !== false)) {
    const d = new Date(person.date_of_birth)
    rows.push({ icon: Cake, text: d.toLocaleDateString([], { day: "numeric", month: "long" }), locked: false })
  }

  // Extra fields shown only when expanded
  if (expanded) {
    if (person.gender)               rows.push({ icon: User,       text: person.gender, locked: false })
    if (person.body_height_cm)       rows.push({ icon: Ruler,      text: person.body_height_cm + " cm", locked: false })
    if (person.languages?.length)    rows.push({ icon: Languages,  text: Array.isArray(person.languages) ? person.languages.join(", ") : person.languages, locked: false })
    if (person.religion)             rows.push({ icon: BookOpen,   text: person.religion, locked: false })
    if (person.looking_for)          rows.push({ icon: Sparkles,   text: "Looking for: " + person.looking_for, locked: false })
    if (person.smoker)               rows.push({ icon: Cigarette,  text: person.smoker, locked: false })
    if (person.drinking)             rows.push({ icon: Wine,       text: person.drinking, locked: false })
    if (person.exercise)             rows.push({ icon: Dumbbell,   text: person.exercise, locked: false })
    if (person.diet)                 rows.push({ icon: Salad,      text: person.diet, locked: false })
    if (person.pets)                 rows.push({ icon: PawPrint,   text: person.pets, locked: false })
    if (person.children)             rows.push({ icon: Baby,       text: person.children, locked: false })
  }

  if (rows.length === 0) return null

  return (
    <section className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-cream font-extrabold text-[17px]">Personal details</h2>
        {isMe && (
          <button
            onClick={() => { tap("light"); onEdit?.() }}
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
        {isMe || rows.length > 5 ? (
          <button
            onClick={() => { tap("light"); setExpanded((v) => !v) }}
            className="self-start mt-1 text-muted text-[14px] font-semibold py-2 active:opacity-70"
          >
            {expanded ? "See less" : "See more details"}
          </button>
        ) : null}
      </div>
    </section>
  )
}

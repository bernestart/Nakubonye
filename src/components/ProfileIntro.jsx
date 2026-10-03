export default function ProfileIntro({ person }) {
  if (!person) return null

  const bioSnippet = person.bio ? person.bio.slice(0, 100) + (person.bio.length > 100 ? '…' : '') : null
  const location = [person.city, person.country].filter(Boolean).join(', ')

  const hasAny = person.profession || person.education || location || person.relationship_status || bioSnippet
  if (!hasAny) return null

  return (
    <div className="mx-4 my-3 rounded-2xl bg-white/[0.03] border border-white/8 p-3.5 flex flex-col gap-2.5">
      {person.profession && (
        <div className="flex items-start gap-2.5">
          <span className="w-5 text-center text-[15px] shrink-0">💼</span>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-[11px] mb-0.5">Profession</p>
            <p className="text-cream text-[13.5px] leading-snug break-words">{person.profession}</p>
          </div>
        </div>
      )}
      {person.education && (
        <div className="flex items-start gap-2.5">
          <span className="w-5 text-center text-[15px] shrink-0">🎓</span>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-[11px] mb-0.5">Education</p>
            <p className="text-cream text-[13.5px] leading-snug break-words">{person.education}</p>
          </div>
        </div>
      )}
      {location && (
        <div className="flex items-start gap-2.5">
          <span className="w-5 text-center text-[15px] shrink-0">📍</span>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-[11px] mb-0.5">Lives in</p>
            <p className="text-cream text-[13.5px] leading-snug break-words">{location}</p>
          </div>
        </div>
      )}
      {person.relationship_status && (
        <div className="flex items-start gap-2.5">
          <span className="w-5 text-center text-[15px] shrink-0">💜</span>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-[11px] mb-0.5">Relationship</p>
            <p className="text-cream text-[13.5px] leading-snug break-words">{person.relationship_status}</p>
          </div>
        </div>
      )}
      {bioSnippet && (
        <div className="flex items-start gap-2.5">
          <span className="w-5 text-center text-[15px] shrink-0">📝</span>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-[11px] mb-0.5">Bio</p>
            <p className="text-cream/90 text-[13px] leading-snug break-words">{bioSnippet}</p>
          </div>
        </div>
      )}
    </div>
  )
}

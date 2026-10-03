export default function ProfileAbout({ person }) {
  if (!person) return null

  const hasAny =
    person.bio || person.profession || person.education || person.city ||
    person.gender || person.date_of_birth || person.relationship_status ||
    person.body_type || person.personality || person.music_genres?.length

  if (!hasAny) {
    return (
      <div className="py-12 text-center">
        <p className="text-cream font-bold text-[15px] mb-1">Nothing to show yet</p>
        <p className="text-muted text-[13px]">Details haven't been filled in.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      {person.bio && (
        <AboutSection title="Bio">
          <p className="text-cream/90 text-[13.5px] leading-[1.55] whitespace-pre-wrap">{person.bio}</p>
        </AboutSection>
      )}

      {(person.profession || person.education) && (
        <AboutSection title="Work & Education">
          {person.profession && <AboutRow icon="💼" label="Profession" value={person.profession} />}
          {person.education && <AboutRow icon="🎓" label="Education" value={person.education} />}
        </AboutSection>
      )}

      {(person.city || person.country) && (
        <AboutSection title="Location">
          <AboutRow icon="📍" label="Lives in" value={[person.city, person.country].filter(Boolean).join(', ')} />
        </AboutSection>
      )}

      {(person.date_of_birth || person.gender || person.languages?.length > 0) && (
        <AboutSection title="Basic info">
          {person.date_of_birth && (
            <AboutRow icon="🎂" label="Birthday" value={new Date(person.date_of_birth).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} />
          )}
          {person.gender && <AboutRow icon="👤" label="Gender" value={person.gender} />}
          {person.languages?.length > 0 && (
            <AboutRow icon="🗣️" label="Languages" value={Array.isArray(person.languages) ? person.languages.join(', ') : person.languages} />
          )}
        </AboutSection>
      )}

      {(person.relationship_status || person.looking_for || person.relationship_preference) && (
        <AboutSection title="Relationship">
          {person.relationship_status && <AboutRow icon="💜" label="Status" value={person.relationship_status} />}
          {person.looking_for && <AboutRow icon="🔍" label="Looking for" value={person.looking_for} />}
          {person.relationship_preference && <AboutRow icon="💫" label="Interested in" value={person.relationship_preference} />}
        </AboutSection>
      )}

      {(person.smoker || person.drinking || person.exercise || person.diet || person.pets || person.children || person.partying) && (
        <AboutSection title="Lifestyle">
          {person.smoker && <AboutRow icon="🚬" label="Smoking" value={person.smoker} />}
          {person.drinking && <AboutRow icon="🍷" label="Drinking" value={person.drinking} />}
          {person.exercise && <AboutRow icon="🏃" label="Exercise" value={person.exercise} />}
          {person.diet && <AboutRow icon="🥗" label="Diet" value={person.diet} />}
          {person.partying && <AboutRow icon="🎉" label="Partying" value={person.partying} />}
          {person.pets && <AboutRow icon="🐾" label="Pets" value={person.pets} />}
          {person.children && <AboutRow icon="👶" label="Children" value={person.children} />}
        </AboutSection>
      )}

      {(person.body_type || person.personality || person.tattoos || person.body_height_cm) && (
        <AboutSection title="Appearance & Personality">
          {person.body_height_cm && <AboutRow icon="📏" label="Height" value={person.body_height_cm + ' cm'} />}
          {person.body_type && <AboutRow icon="💪" label="Body type" value={person.body_type} />}
          {person.personality && <AboutRow icon="✨" label="Personality" value={person.personality} />}
          {person.tattoos && <AboutRow icon="🖋️" label="Tattoos" value={person.tattoos} />}
        </AboutSection>
      )}

      {person.music_genres?.length > 0 && (
        <AboutSection title="Music">
          <p className="text-cream/90 text-[13.5px]">
            {Array.isArray(person.music_genres) ? person.music_genres.join(', ') : person.music_genres}
          </p>
        </AboutSection>
      )}
    </div>
  )
}

export function AboutSection({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">{title}</p>
      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3.5 flex flex-col gap-2.5">
        {children}
      </div>
    </div>
  )
}

export function AboutRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-5 text-center text-[15px] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-muted text-[11.5px] mb-0.5">{label}</p>
        <p className="text-cream text-[13.5px] leading-snug break-words">{value}</p>
      </div>
    </div>
  )
}

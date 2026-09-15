import {
  Briefcase, GraduationCap, Church, Heart, Ruler, Languages,
  Activity, UserRound, Lock, Music2, Cigarette, Wine, PartyPopper,
  Dumbbell, Anchor, Utensils, Dog, Baby,
} from 'lucide-react'
import {
  EDUCATION_LABEL, RELATIONSHIP_LABEL, LANGUAGE_LABEL, LANGUAGE_FLAG,
} from '../lib/profileLabels'

const BODY_TYPE_LABEL = { slim:'Slim', average:'Average', athletic:'Athletic', muscular:'Muscular', curvy:'Curvy', other:'Other' }
const PERSONALITY_LABEL = { introvert:'Introvert', extrovert:'Extrovert', ambivert:'A mix of both' }
const REL_PREF_LABEL = { monogamous:'Monogamous', open:'Open relationship', figuring_out:'Figuring it out' }
const MUSIC_LABEL = { hip_hop:'Hip-Hop', rnb:'R&B', classical:'Classical', country:'Country', soul:'Soul', afro:'Afro', pop:'Pop', rock:'Rock', jazz:'Jazz', gospel:'Gospel' }

const SMOKER_LABEL = { never:"Doesn't smoke", sometimes:'Smokes sometimes', regularly:'Smokes regularly' }
const DRINKING_LABEL = { never:"Doesn't drink", socially:'Drinks socially', regularly:'Drinks regularly' }
const PARTYING_LABEL = { never:"Doesn't party", sometimes:'Parties sometimes', often:'Parties often' }
const EXERCISE_LABEL = { never:'Not active', sometimes:'Somewhat active', regularly:'Regularly active', daily:'Active daily' }
const TATTOOS_LABEL = { none:'No tattoos', some:'Some tattoos', many:'Many tattoos' }
const DIET_LABEL = { no_preference:'No diet preference', vegetarian:'Vegetarian', vegan:'Vegan', halal:'Halal', other:'Other diet' }
const PETS_LABEL = { none:"Doesn't have pets", cat:'Has a cat', dog:'Has a dog', both:'Has cats and dogs', other:'Has pets' }
const CHILDREN_LABEL = { have:'Has children', want_someday:'Wants kids someday', dont_want:"Doesn't want kids", open:'Open to kids' }

export default function ProfileDetails({ profile, empty = null }) {
  if (!profile) return empty

  const basics = []
  if (profile.profession) basics.push({ Icon: Briefcase, label: profile.profession })
  if (profile.education) basics.push({ Icon: GraduationCap, label: EDUCATION_LABEL[profile.education] || profile.education })
  if (profile.religion) basics.push({ Icon: Church, label: profile.religion })
  if (profile.relationship_status) basics.push({ Icon: Heart, label: RELATIONSHIP_LABEL[profile.relationship_status] || profile.relationship_status })
  if (profile.relationship_preference) basics.push({ Icon: Lock, label: REL_PREF_LABEL[profile.relationship_preference] || profile.relationship_preference })
  if (profile.body_height_cm) basics.push({ Icon: Ruler, label: `${profile.body_height_cm} cm` })
  if (profile.body_type) basics.push({ Icon: Activity, label: BODY_TYPE_LABEL[profile.body_type] || profile.body_type })
  if (profile.personality) basics.push({ Icon: UserRound, label: PERSONALITY_LABEL[profile.personality] || profile.personality })

  const langs = Array.isArray(profile.languages) ? profile.languages : []
  if (langs.length > 0) {
    basics.push({
      Icon: Languages,
      label: langs.map((l) => `${LANGUAGE_FLAG[l] || ''} ${LANGUAGE_LABEL[l] || l}`.trim()).join('  ·  '),
    })
  }

  const music = Array.isArray(profile.music_genres) ? profile.music_genres : []
  if (music.length > 0) {
    basics.push({ Icon: Music2, label: music.map((g) => MUSIC_LABEL[g] || g).join('  ·  ') })
  }

  const lifestyle = []
  if (profile.smoker) lifestyle.push({ Icon: Cigarette, label: SMOKER_LABEL[profile.smoker] || profile.smoker })
  if (profile.drinking) lifestyle.push({ Icon: Wine, label: DRINKING_LABEL[profile.drinking] || profile.drinking })
  if (profile.partying) lifestyle.push({ Icon: PartyPopper, label: PARTYING_LABEL[profile.partying] || profile.partying })
  if (profile.exercise) lifestyle.push({ Icon: Dumbbell, label: EXERCISE_LABEL[profile.exercise] || profile.exercise })
  if (profile.tattoos) lifestyle.push({ Icon: Anchor, label: TATTOOS_LABEL[profile.tattoos] || profile.tattoos })
  if (profile.diet) lifestyle.push({ Icon: Utensils, label: DIET_LABEL[profile.diet] || profile.diet })
  if (profile.pets) lifestyle.push({ Icon: Dog, label: PETS_LABEL[profile.pets] || profile.pets })
  if (profile.children) lifestyle.push({ Icon: Baby, label: CHILDREN_LABEL[profile.children] || profile.children })

  if (basics.length === 0 && lifestyle.length === 0) return empty

  return (
    <>
      {basics.length > 0 && (
        <div className="px-5 mt-6">
          <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
            Details
          </p>
          <div className="flex flex-col gap-2">
            {basics.map((it, i) => <Row key={i} Icon={it.Icon} label={it.label} />)}
          </div>
        </div>
      )}

      {lifestyle.length > 0 && (
        <div className="px-5 mt-6">
          <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
            Lifestyle
          </p>
          <div className="flex flex-col gap-2">
            {lifestyle.map((it, i) => <Row key={i} Icon={it.Icon} label={it.label} />)}
          </div>
        </div>
      )}
    </>
  )
}

function Row({ Icon, label }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/8">
      <Icon size={14} strokeWidth={2.3} className="text-purple-300 shrink-0" />
      <span className="text-cream text-[13.5px] font-medium truncate">{label}</span>
    </div>
  )
}

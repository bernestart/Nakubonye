import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'

export default function Privacy() {
  const nav = useNavigate()
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Privacy Policy</span>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5 pb-10">
        <p className="text-subtle text-[12px] mb-6">Last updated: September 2026</p>

        <H>Short version</H>
        <P>We collect what we need to run Nakubonye — nothing more. We never sell your data. We never show your email to other users. You can delete your account and everything goes with it.</P>

        <H>What we collect</H>
        <P>When you sign up and use Nakubonye, we store:</P>
        <UL>
          <li>Your email and password (encrypted)</li>
          <li>Name, username, date of birth, gender</li>
          <li>City and country</li>
          <li>Your bio, photos, interests, prompts, and lifestyle answers</li>
          <li>Messages you send and receive</li>
          <li>Likes, matches, and your coin wallet history</li>
          <li>Your verification selfie, if you choose to verify (stored privately, visible only to our team)</li>
          <li>Device type, operating system, and app version for debugging</li>
        </UL>

        <H>What we do NOT collect</H>
        <UL>
          <li>Your exact GPS location — we only know your city, which you typed in yourself</li>
          <li>Your phone number (unless you write it in your bio, which we advise against)</li>
          <li>Your contacts or address book</li>
          <li>Your browsing history outside Nakubonye</li>
          <li>Your microphone or camera — except during calls and verification, where you granted permission</li>
        </UL>

        <H>Who can see what</H>
        <P>Your profile (photos, name, age, city, bio, interests) is visible to other signed-in Nakubonye users. Your email is never shown to anyone. Your verification selfie is visible only to our admins and only until your request is reviewed. Your messages are only visible to you and the person you are talking to.</P>

        <H>Where your data lives</H>
        <P>Your data is stored on Supabase, a secure database provider with servers in the European Union and United States. All traffic is encrypted (HTTPS). Passwords are hashed and never readable, even by us.</P>

        <H>How long we keep it</H>
        <P>We keep your data while your account exists. When you delete your account (Settings → Delete account), we remove your profile, photos, messages, matches, and coins. This is permanent. Some records — like moderation reports about you — are kept without your identity attached, in case of legal need.</P>

        <H>Your rights</H>
        <P>You can:</P>
        <UL>
          <li>See all the data we have about you by opening your profile</li>
          <li>Correct anything wrong by editing your profile</li>
          <li>Delete everything by deleting your account</li>
          <li>Contact us at any time with questions</li>
        </UL>

        <H>Cookies</H>
        <P>Nakubonye stores a small amount of local data in your browser to keep you logged in. We don't use tracking cookies, and we don't advertise in the app.</P>

        <H>No selling, no ads</H>
        <P>We do not sell your data. We do not show third-party ads. We do not share your information with anyone except Supabase (our database provider) and, if legally required, the authorities.</P>

        <H>Contact us</H>
        <P>For anything about your privacy, reach us at:</P>
        <ContactBox />

        <p className="text-subtle text-[11.5px] text-center mt-8 leading-relaxed">
          © Nakubonye 2026 · Bujumbura, Burundi
        </p>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

function H({ children }) {
  return (
    <h2 className="text-cream text-[16px] font-extrabold tracking-tight mt-6 mb-2">
      {children}
    </h2>
  )
}

function P({ children }) {
  return (
    <p className="text-cream/85 text-[14px] leading-[1.65] mb-3">{children}</p>
  )
}

function UL({ children }) {
  return (
    <ul className="list-disc pl-5 mb-3 flex flex-col gap-1.5">
      {children}
    </ul>
  )
}

function ContactBox() {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 mt-3">
      <p className="text-cream text-[13.5px] mb-1.5">
        <span className="text-subtle">Email:</span> <span className="font-semibold">contact@nakubonye.com</span>
      </p>
      <p className="text-cream text-[13.5px]">
        <span className="text-subtle">WhatsApp:</span> <a href="https://wa.me/25765394084" target="_blank" rel="noopener" className="font-semibold text-purple-300">+257 65 39 40 84</a>
      </p>
    </div>
  )
}

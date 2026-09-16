import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'

export default function Terms() {
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
        <span className="text-cream font-bold text-[15px]">Terms of Service</span>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5 pb-10">
        <p className="text-subtle text-[12px] mb-6">Last updated: September 2026</p>

        <H>Welcome</H>
        <P>Nakubonye is a dating app for adults, wherever you are. By creating an account you agree to these terms. If anything here feels wrong to you, please don't use the app.</P>

        <H>Who can use Nakubonye</H>
        <P>You must be 18 or older. By signing up you confirm this is true. We remove any account we find to belong to someone under 18, with no warning and no refund.</P>

        <H>Your account</H>
        <P>You need one account, with real information about yourself. No fake names, no photos of other people, no pretending to be someone you are not. You are responsible for keeping your password safe and for anything done with your account.</P>

        <H>How to behave</H>
        <P>Nakubonye is for meeting real people respectfully. You agree not to:</P>
        <UL>
          <li>Harass, threaten, or abuse anyone</li>
          <li>Send sexual content to people who did not ask for it</li>
          <li>Impersonate another person or create fake profiles</li>
          <li>Ask for money, gifts, or crypto from other users</li>
          <li>Post content involving minors in any sexual context</li>
          <li>Post hate speech, or discriminate based on ethnicity, religion, gender, or sexuality</li>
          <li>Use the app to promote anything — products, services, other apps, or political causes</li>
          <li>Try to scrape, clone, or attack the service</li>
        </UL>
        <P>We can remove content, suspend accounts, or report you to the authorities if you break these rules.</P>

        <H>Verification</H>
        <P>A verified badge means we checked that someone's selfie matches their profile photos. It does not mean we guarantee they are safe, honest, or trustworthy. Always meet in public places and tell someone where you are going. See the Safety Center for more.</P>

        <H>Coins and Premium</H>
        <P>Coins and Premium subscriptions are digital items. Coins are not real money, cannot be transferred to another user, and are not refundable. Premium subscriptions do not auto-renew unless you set them up to. You can cancel Premium at any time and keep the benefits until the end of the paid period.</P>

        <H>What we do and don't promise</H>
        <P>We provide Nakubonye as-is. We don't guarantee you will find a partner, a date, or a friend. We don't guarantee the app will never break. We are not responsible for what other users do, on the app or after you meet them.</P>

        <H>Changes</H>
        <P>We may update these terms. If we do, we'll notify you in the app. Continuing to use Nakubonye after an update means you accept the new terms.</P>

        <H>Governing law</H>
        <P>These terms are governed by the laws of the Republic of Burundi.</P>

        <H>Contact us</H>
        <P>For anything about these terms, reach us at:</P>
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

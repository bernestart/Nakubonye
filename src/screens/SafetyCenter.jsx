import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, AlertTriangle, Lock, Users } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'

export default function SafetyCenter() {
  const nav = useNavigate()

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Safety Center</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-10">
        <div className="mb-7">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 grid place-items-center mb-4">
            <ShieldCheck size={26} strokeWidth={2} className="text-purple-300" />
          </div>
          <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2 leading-tight">
            Safety comes first
          </h1>
          <p className="text-muted text-[14px] leading-relaxed">
            Nakubonye is for meeting real people respectfully. Here's how to
            stay safe, and how we help.
          </p>
        </div>

        <Section icon={<AlertTriangle size={18} />} title="Meet safely">
          <Bullet>Meet in a public place the first few times — a café, a market, a busy street.</Bullet>
          <Bullet>Tell a trusted friend where you're going and who you're meeting.</Bullet>
          <Bullet>Arrange your own transport there and back.</Bullet>
          <Bullet>Stay sober enough to stay aware.</Bullet>
          <Bullet>Trust your instincts. If something feels off, leave.</Bullet>
        </Section>

        <Section icon={<Lock size={18} />} title="Protect your privacy">
          <Bullet>Never send money, gift cards, or crypto to someone you haven't met.</Bullet>
          <Bullet>Keep early conversations inside Nakubonye. Move to WhatsApp only when you're comfortable.</Bullet>
          <Bullet>Don't share your exact address, workplace, or financial details.</Bullet>
          <Bullet>Your city is shown. Your exact location is not.</Bullet>
        </Section>

        <Section icon={<AlertTriangle size={18} />} title="Recognize a scam">
          <Bullet>They ask to move off the app immediately.</Bullet>
          <Bullet>Their story is too perfect and moves too fast.</Bullet>
          <Bullet>They ask for money for a visa, medical bill, or emergency.</Bullet>
          <Bullet>Their photos look like a model's and they avoid video calls.</Bullet>
        </Section>

        <Section icon={<Users size={18} />} title="How we help">
          <Bullet>Every profile has a Report and Block option.</Bullet>
          <Bullet>You can block someone and they'll never know it was you.</Bullet>
          <Bullet>Reports are reviewed. We take harassment seriously.</Bullet>
          <Bullet>Verification is a signal, not a guarantee. Always meet in public.</Bullet>
        </Section>

        <div className="mt-8 p-4 rounded-2xl bg-red-500/8 border border-red-500/25">
          <p className="text-red-300 text-[13px] leading-relaxed">
            <strong className="font-bold">In an emergency</strong>, contact your local police
            immediately. Nakubonye is not an emergency service.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-400">{icon}</span>
        <h2 className="text-cream font-bold text-[15.5px]">{title}</h2>
      </div>
      <ul className="flex flex-col gap-2 pl-1">{children}</ul>
    </div>
  )
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-muted text-[13.5px] leading-relaxed">
      <span className="mt-[7px] w-1 h-1 rounded-full bg-purple-400/60 shrink-0" />
      <span>{children}</span>
    </li>
  )
}

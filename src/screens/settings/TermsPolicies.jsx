import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Shield, ShieldCheck, ChevronRight, ExternalLink,
} from 'lucide-react'
import { tap } from '../../lib/haptic'
import BrandGlow from '../../components/BrandGlow'

export default function TermsPolicies() {
  const nav = useNavigate()

  return (
    <div style={{
      position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/6"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => { tap('light'); nav(-1) }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-extrabold text-[16px]">Terms & policies</span>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">

        <p className="text-muted text-[12.5px] px-4 py-3 leading-relaxed">
          The rules that keep Nakubonye safe and honest for everyone.
        </p>

        <SectionTitle>Legal</SectionTitle>
        <Row
          icon={FileText}
          label="Terms of service"
          sub="What you agree to when you use Nakubonye"
          onClick={() => nav('/terms')}
        />
        <Row
          icon={Shield}
          label="Privacy policy"
          sub="What data we collect and how we use it"
          onClick={() => nav('/privacy')}
        />

        <SectionTitle>Safety</SectionTitle>
        <Row
          icon={ShieldCheck}
          label="Safety Center"
          sub="Stay safe, protect your privacy, spot scams"
          onClick={() => nav('/safety')}
        />

      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mt-6 mb-2 px-4">
      {children}
    </p>
  )
}

function Row({ icon: Icon, label, sub, onClick }) {
  return (
    <button
      onClick={() => { tap('light'); onClick?.() }}
      className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
    >
      <span className="shrink-0 text-cream">
        <Icon size={19} strokeWidth={2.1} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-medium text-cream">{label}</p>
        {sub && <p className="text-muted text-[12px] mt-0.5 leading-snug">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-muted shrink-0" strokeWidth={2.3} />
    </button>
  )
}

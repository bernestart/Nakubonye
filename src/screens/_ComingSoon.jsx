import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

export default function ComingSoon({ title = "Coming soon", message = "We're working on this. Check back soon." }) {
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
        <span className="text-cream font-bold text-[15px]">{title}</span>
      </header>
      <div className="flex-1 grid place-items-center px-6">
        <p className="text-muted text-center text-[14px] max-w-[280px] leading-relaxed">{message}</p>
      </div>
      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />
    </div>
  )
}

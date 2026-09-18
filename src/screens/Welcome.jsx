import { Link } from 'react-router-dom'
import BrandGlow from '../components/BrandGlow'

export default function Welcome() {
  return (
    <div className="mobile-shell flex flex-col relative overflow-hidden isolate">
      <BrandGlow />
      {/* Warm glow backdrop */}

      <main className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        {/* Logo */}
        <div
          className="w-[88px] h-[88px] rounded-[26px] grid place-items-center mb-8 relative"
          style={{
            background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
            boxShadow: '0 16px 48px rgba(168,85,247,0.55), 0 0 60px rgba(236,72,153,0.35)',
          }}
        >
          <span className="text-white font-black text-[44px] leading-none tracking-tight">
            N
          </span>
        </div>

        {/* WELCOME TO */}
        <p className="text-purple-300/80 text-[11.5px] font-bold tracking-[0.32em] mb-3">
          WELCOME TO
        </p>

        {/* Big headline */}
        <h1 className="text-white text-[46px] leading-[1.02] font-black tracking-tight mb-5">
          Nakubonye
          <span className="inline-block ml-2 align-middle text-[34px]">❤️</span>
        </h1>

        {/* Tagline */}
        <p className="text-purple-100/90 text-[19px] leading-[1.45] max-w-[300px] mb-10 font-semibold">
          Somebody is
          <br />
          looking for you.
        </p>

        {/* Three hearts */}
        <div className="flex items-end justify-center gap-2 mb-12">
          <span className="text-[36px] leading-none opacity-90">❤️</span>
          <span
            className="text-[64px] leading-none"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(236,72,153,0.55))' }}
          >
            💗
          </span>
          <span className="text-[32px] leading-none opacity-90 -ml-1">💕</span>
        </div>
      </main>

      <footer className="px-7 pb-10 pt-4 flex flex-col gap-3">
        <Link
          to="/signup"
          className="block text-center text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
            boxShadow: '0 12px 36px rgba(236,72,153,0.5), 0 4px 14px rgba(168,85,247,0.35)',
          }}
        >
          Create account
        </Link>

        <Link
          to="/signin"
          className="block text-center text-white/85 font-semibold text-[15px] rounded-full py-[15px] transition-colors border border-white/12 bg-white/[0.03] hover:bg-white/[0.06]"
        >
          Log in
        </Link>

        <p className="text-center text-white/45 text-[11px] leading-relaxed mt-4">
          <span>By continuing, you agree to our </span>
            <Link to="/terms" className="text-purple-300 font-semibold underline-offset-2 hover:underline">Terms</Link>
            <span> and </span>
            <Link to="/privacy" className="text-purple-300 font-semibold underline-offset-2 hover:underline">Privacy Policy</Link>
            <span>.</span>
        </p>
      </footer>
    </div>
  )
}

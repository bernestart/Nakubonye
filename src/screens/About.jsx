import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Mail, MessageCircle, FileText, ShieldCheck } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'

export default function About() {
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
        <span className="text-cream font-bold text-[15px]">About Nakubonye</span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-10">
        <div className="text-center mb-8">
          <div
            className="w-[76px] h-[76px] rounded-[24px] grid place-items-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
              boxShadow: '0 14px 40px rgba(168,85,247,0.5)',
            }}
          >
            <span className="text-white font-black text-[38px] leading-none">N</span>
          </div>
          <h1 className="text-cream text-[26px] font-extrabold tracking-tight mb-1.5">
            Nakubonye
          </h1>
          <p className="text-muted text-[13.5px]">
            I have seen you.
          </p>
          <p className="text-subtle text-[11.5px] mt-3">
            Version 2.0 · Proudly built in Burundi 🇧🇮 · For everyone, everywhere
          </p>
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 mb-6">
          <p className="text-purple-300 text-[11px] font-black tracking-[0.16em] uppercase mb-2">
            Why we exist
          </p>
          <p className="text-cream/90 text-[13.5px] leading-relaxed">
            Nakubonye is a place for people who want something real.
            Not endless swiping. Not fake profiles. Just honest people
            meeting honestly — for friendship, for community, or for
            something more. Wherever you are.
          </p>
        </div>

        <div
          className="rounded-2xl border border-purple-500/30 p-5 mb-6"
          style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.16) 0%, rgba(236,72,153,0.08) 100%)' }}
        >
          <p className="text-purple-300 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
            Built by
          </p>
          <p className="text-cream text-[18px] font-extrabold tracking-tight mb-1">
            Ernest Niyobuhungiro
          </p>
          <p className="text-purple-200 text-[13px] font-medium">
            aka <span className="font-bold">Bernest</span> 🎨 Designer
          </p>
          <p className="text-muted text-[12.5px] leading-relaxed mt-3">
            A designer and builder from Bujumbura, creating tools
            that help people connect honestly.
          </p>
        </div>

        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
          Get in touch
        </p>
        <div className="flex flex-col gap-2 mb-6">
          <a
            href="mailto:contact@nakubonye.com"
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
              <Mail size={16} strokeWidth={2.4} className="text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-cream font-semibold text-[13.5px]">Email</p>
              <p className="text-muted text-[12px] truncate">contact@nakubonye.com</p>
            </div>
          </a>

          <a
            href="https://wa.me/25765394084"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
              <MessageCircle size={16} strokeWidth={2.4} className="text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-cream font-semibold text-[13.5px]">WhatsApp</p>
              <p className="text-muted text-[12px]">+257 65 39 40 84</p>
            </div>
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => nav('/roadmap')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
              <Sparkles size={16} strokeWidth={2.4} className="text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="flex-1 text-cream font-semibold text-[13.5px]">What we're building</p>
              <p className="text-muted text-[12px]">See the roadmap</p>
            </div>
          </button>

          <button
            onClick={() => nav('/terms')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
              <FileText size={16} strokeWidth={2.4} className="text-purple-300" />
            </div>
            <p className="flex-1 text-cream font-semibold text-[13.5px]">Terms of Service</p>
          </button>

          <button
            onClick={() => nav('/privacy')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
              <ShieldCheck size={16} strokeWidth={2.4} className="text-purple-300" />
            </div>
            <p className="flex-1 text-cream font-semibold text-[13.5px]">Privacy Policy</p>
          </button>
        </div>

        <p className="text-center text-subtle text-[11px] mt-10 leading-relaxed">
          © Nakubonye 2026 · Bujumbura, Burundi
          <br />
          Built with <Heart size={10} className="inline text-pink-500" fill="currentColor" /> by Ernest Niyobuhungiro
        </p>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

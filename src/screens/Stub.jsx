import { Logo } from '../components/UI'
import BottomNav from '../components/BottomNav'

export default function Stub({ title }) {
  return (
    <div className="mobile-shell flex flex-col pb-24">
      <header className="px-7 pt-8 pb-4">
        <Logo />
      </header>
      <main className="flex-1 grid place-items-center px-7 text-center">
        <div>
          <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
            {title}
          </h1>
          <p className="text-muted text-[14px] max-w-[260px] mx-auto">
            Coming in the next session.
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

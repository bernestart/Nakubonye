import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/UI'

export default function DiscoverPlaceholder() {
  const nav = useNavigate()
  const { profile } = useAuth()

  async function signOut() {
    await supabase.auth.signOut()
    nav('/', { replace: true })
  }

  return (
    <div className="mobile-shell flex flex-col">
      <header className="px-7 pt-10 pb-4 flex items-center justify-between">
        <Logo />
        <button
          onClick={signOut}
          className="text-muted text-[13px] font-semibold hover:text-cream"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 grid place-items-center px-7 text-center">
        <div>
          <div className="w-16 h-16 rounded-3xl bg-purple-600/15 border border-purple-500/30 grid place-items-center mx-auto mb-5">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}
          </h1>
          <p className="text-muted text-[14.5px] max-w-[280px] mx-auto">
            Session A is complete. Discover comes next — real profiles, real
            cards, real matching.
          </p>
        </div>
      </main>
    </div>
  )
}

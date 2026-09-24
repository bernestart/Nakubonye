import { useNavigate } from 'react-router-dom'
import { tap } from '../lib/haptic'

export default function ProfileTabs({ active = 'preview' }) {
  const nav = useNavigate()

  return (
    <div
      className="px-5 pb-3 flex flex-col gap-3"
    >
      <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.05] border border-white/8">
        <button
          type="button"
          onClick={() => { tap('light'); nav('/me/edit') }}
          className={`flex-1 h-9 rounded-xl font-bold text-[13px] transition-colors ${
            active === 'edit'
              ? 'bg-white text-[#0B0B14] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-muted'
          }`}
        >
          Edit profile
        </button>
        <button
          type="button"
          onClick={() => { tap('light'); nav('/me/preview') }}
          className={`flex-1 h-9 rounded-xl font-bold text-[13px] transition-colors ${
            active === 'preview'
              ? 'bg-white text-[#0B0B14] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-muted'
          }`}
        >
          Preview
        </button>
      </div>
    </div>
  )
}

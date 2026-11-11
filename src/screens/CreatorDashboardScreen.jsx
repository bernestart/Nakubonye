import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import CreatorDashboard from "../components/CreatorDashboard"

export default function CreatorDashboardScreen() {
  const nav = useNavigate()
  const { session } = useAuth()
  
  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0B14] flex flex-col max-w-[480px] mx-auto">
      <header className="h-14 flex items-center px-4 border-b border-white/8 shrink-0">
        <button onClick={() => { tap("light"); nav(-1) }} className="w-10 h-10 rounded-full grid place-items-center text-muted">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-cream font-bold text-[16px] ml-2">Creator Dashboard</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <CreatorDashboard myId={session?.user?.id} />
      </div>
    </div>
  )
}
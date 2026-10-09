import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import ProfileConnections from "../components/ProfileConnections"

export default function FollowList() {
  const nav = useNavigate()
  const { userId } = useParams()
  const [params] = useSearchParams()
  const initialTab = params.get("tab") || "followers"

  return (
    <div
      className="mobile-shell flex flex-col"
      style={{
        position: "fixed", inset: 0,
        margin: "0 auto", maxWidth: 480,
        background: "#0B0B14",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 h-12 border-b border-white/8">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <div className="flex-1">
          <p className="text-cream font-bold text-[15px]">Connections</p>
          <p className="text-subtle text-[11.5px]">Followers · Following · Matches · Suggested</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        <ProfileConnections userId={userId} fullPage={true} initialTab={initialTab} />
      </div>
    </div>
  )
}

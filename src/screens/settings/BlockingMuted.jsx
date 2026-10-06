import { Ban, BellOff, Filter, EyeOff } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function BlockingMuted() {
  return (
    <SettingsScreen
      title="Blocking & Muting"
      subtitle="Manage who can't reach you and whose content you don't see."
      rows={[
        { icon: <Ban size={18} />, label: "Blocked users", to: "/blocked" },
        { icon: <BellOff size={18} />, label: "Muted users", to: "/settings/muted-users" },
        { icon: <Filter size={18} />, label: "Muted words", to: "/settings/muted-words" },
        { icon: <EyeOff size={18} />, label: "Restricted users", soon: true },
      ]}
    />
  )
}

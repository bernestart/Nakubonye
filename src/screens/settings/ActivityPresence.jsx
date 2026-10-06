import { Circle, Clock, CheckCheck, Eye, Sparkles } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function ActivityPresence() {
  return (
    <SettingsScreen
      title="Activity & Presence"
      subtitle="What others see about when you're active."
      rows={[
        { icon: <Circle size={18} />, label: "Online status", to: "/settings/privacy" },
        { icon: <Clock size={18} />, label: "Last seen", to: "/settings/privacy" },
        { icon: <CheckCheck size={18} />, label: "Read receipts", to: "/settings/privacy" },
        { icon: <Eye size={18} />, label: "Story view visibility", soon: true },
        { icon: <Sparkles size={18} />, label: "Incognito mode", to: "/settings/privacy" },
      ]}
    />
  )
}

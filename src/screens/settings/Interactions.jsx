import { MessageCircle, MessageSquare, Users, AtSign, Ban } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function Interactions() {
  return (
    <SettingsScreen
      title="Interactions"
      subtitle="Who can reach you and how."
      rows={[
        { icon: <MessageCircle size={18} />, label: "Who can message me", to: "/settings/privacy" },
        { icon: <MessageSquare size={18} />, label: "Who can comment on my posts", to: "/settings/privacy" },
        { icon: <AtSign size={18} />, label: "Who can reply to my stories", to: "/settings/privacy" },
        { icon: <Users size={18} />, label: "Who can add me to group chats", soon: true },
        { icon: <Ban size={18} />, label: "Filter keywords", soon: true },
      ]}
    />
  )
}

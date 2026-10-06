import { UserCircle, AtSign, Star, Users, Eye } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function ProfileTagging() {
  return (
    <SettingsScreen
      title="Profile & Tagging"
      subtitle="How you appear, and who can tag or mention you."
      rows={[
        { icon: <UserCircle size={18} />, label: "Edit profile", to: "/me/edit" },
        { icon: <AtSign size={18} />, label: "Who can tag or mention me", to: "/settings/privacy" },
        { icon: <Star size={18} />, label: "Tag review", to: "/settings/pending-tags" },
        { icon: <Star size={18} />, label: "Inner Circle", to: "/inner-circle" },
        { icon: <Users size={18} />, label: "Circles", to: "/circles" },
        { icon: <Eye size={18} />, label: "Preview profile", to: "/me/preview" },
      ]}
    />
  )
}

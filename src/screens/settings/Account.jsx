import { User, Mail, Phone, Lock, PauseCircle, Trash2 } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function Account() {
  return (
    <SettingsScreen
      title="Account"
      subtitle="Login info, account type, and deactivation."
      rows={[
        { icon: <User size={18} />, label: "Name & username" },
        { icon: <Mail size={18} />, label: "Email" },
        { icon: <Phone size={18} />, label: "Phone number" },
        { icon: <Lock size={18} />, label: "Password" },
        { icon: <PauseCircle size={18} />, label: "Deactivate account", soon: true },
        { icon: <Trash2 size={18} />, label: "Delete account", soon: true },
      ]}
    />
  )
}

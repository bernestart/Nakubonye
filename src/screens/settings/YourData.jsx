import { Download, PauseCircle, Trash2, Target, MapPin, Link2 } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function YourData() {
  return (
    <SettingsScreen
      title="Your Data"
      subtitle="Export, personalization, and account lifecycle."
      rows={[
        { icon: <Download size={18} />, label: "Download your data", soon: true },
        { icon: <Target size={18} />, label: "Personalized ads", soon: true },
        { icon: <MapPin size={18} />, label: "Location services", soon: true },
        { icon: <Link2 size={18} />, label: "Off-platform activity", soon: true },
        { icon: <PauseCircle size={18} />, label: "Deactivate account", soon: true },
        { icon: <Trash2 size={18} />, label: "Delete account", soon: true },
      ]}
    />
  )
}

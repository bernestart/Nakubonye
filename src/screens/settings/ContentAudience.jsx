import { Globe, Image, Video, PlayCircle, Download, Shuffle } from "lucide-react"
import SettingsScreen from "../../components/SettingsScreen"

export default function ContentAudience() {
  return (
    <SettingsScreen
      title="Content & Audience"
      subtitle="Defaults for what you post, and how others can reuse it."
      rows={[
        { icon: <Globe size={18} />, label: "Default audience for new posts", soon: true },
        { icon: <Image size={18} />, label: "Story visibility", to: "/settings/privacy" },
        { icon: <PlayCircle size={18} />, label: "Reels visibility", soon: true },
        { icon: <Download size={18} />, label: "Allow downloads of my reels", soon: true },
        { icon: <Shuffle size={18} />, label: "Allow remix / duet", soon: true },
        { icon: <Video size={18} />, label: "Live video visibility", soon: true },
      ]}
    />
  )
}

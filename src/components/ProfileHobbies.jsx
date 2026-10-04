import { Shapes, Pencil } from "lucide-react"
import { tap } from "../lib/haptic"

export default function ProfileHobbies({ interests = [], isMe = false }) {
  if (!interests || interests.length === 0) return null

  return (
    <section className="px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-cream font-extrabold text-[17px]">Hobbies</h2>
        {isMe && (
          <button
            onClick={() => { tap("light") }}
            className="w-8 h-8 rounded-full grid place-items-center text-muted"
            aria-label="Edit hobbies"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      <div className="flex items-start gap-3.5">
        <Shapes size={22} strokeWidth={1.7} className="text-cream shrink-0 mt-0.5" />
        <p className="text-cream text-[15px] font-medium leading-snug flex-1 min-w-0">
          {interests.slice(0, 5).join(" · ")}
          {interests.length > 5 && (
            <>
              {" … "}
              <button className="text-muted font-bold">more</button>
            </>
          )}
        </p>
      </div>
    </section>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function HashtagText({ text, className }) {
  const nav = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const limit = 180

  if (!text) return null

  // Regex to match hashtags
  const parts = text.split(/(\s+)/)
  const rendered = parts.map((part, i) => {
    if (part.startsWith("#") && part.length > 1) {
      return (
        <span
          key={i}
          className="text-purple-400 font-semibold cursor-pointer hover:underline"
          onClick={(e) => { e.stopPropagation(); nav("/hashtag/" + part.replace("#", "")) }}
        >
          {part}
        </span>
      )
    }
    return part
  })

  const isLong = text.length > limit
  const displayText = !expanded && isLong ? (
    <>
      {rendered.slice(0, Math.floor(parts.length * (limit / text.length)))}
      <span className="text-purple-400 font-bold ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setExpanded(true) }}>… more</span>
    </>
  ) : rendered

  return <p className={className}>{displayText}</p>
}

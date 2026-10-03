import { useState } from "react"

const MAX_CHARS = 300

export default function ExpandableText({ text, className = "" }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null

  const shouldTruncate = text.length > MAX_CHARS
  const shown = expanded || !shouldTruncate ? text : text.slice(0, MAX_CHARS).trimEnd() + "…"

  return (
    <p className={className}>
      {shown}
      {shouldTruncate && !expanded && (
        <>
          {" "}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            className="text-muted font-semibold active:opacity-70"
          >
            See more
          </button>
        </>
      )}
    </p>
  )
}

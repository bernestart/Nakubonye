import { useState } from "react"
import { useNavigate } from "react-router-dom"

const MAX_CHARS = 300

// Split text into tokens: hashtags, mentions, and plain text
function tokenize(text) {
  const parts = []
  const re = /(#[\p{L}\p{N}_]{2,30}|@[a-z0-9_]{3,20})/giu
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) })
    const tok = m[0]
    if (tok[0] === "#") parts.push({ type: "hashtag", value: tok.slice(1) })
    else parts.push({ type: "mention", value: tok.slice(1) })
    last = m.index + tok.length
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) })
  return parts
}

export default function ExpandableText({ text, className = "" }) {
  const nav = useNavigate()
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const shouldTruncate = text.length > MAX_CHARS
  const shown = expanded || !shouldTruncate ? text : text.slice(0, MAX_CHARS).trimEnd() + "…"
  const parts = tokenize(shown)

  return (
    <p className={className}>
      {parts.map((p, i) => {
        if (p.type === "hashtag") {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); nav("/search?q=" + encodeURIComponent("#" + p.value)) }}
              className="text-purple-300 font-semibold hover:underline active:opacity-70"
            >
              #{p.value}
            </button>
          )
        }
        if (p.type === "mention") {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); nav("/search?q=" + encodeURIComponent("@" + p.value)) }}
              className="text-purple-300 font-semibold hover:underline active:opacity-70"
            >
              @{p.value}
            </button>
          )
        }
        return <span key={i}>{p.value}</span>
      })}
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

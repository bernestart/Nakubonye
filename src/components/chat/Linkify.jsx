export default function Linkify({ text, mine }) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = String(text).split(urlRegex)
  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline ${mine ? "text-white/95" : "text-purple-300"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          )
        }
        urlRegex.lastIndex = 0
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

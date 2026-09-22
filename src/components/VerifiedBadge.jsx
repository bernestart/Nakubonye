import { Check } from "lucide-react"

export default function VerifiedBadge({ size = 14, className = "" }) {
  return (
    <span
      className={"inline-flex items-center justify-center rounded-full shrink-0 align-middle " + className}
      style={{
        width: size,
        height: size,
        background: "#1DA1F2",
        boxShadow: "0 1px 4px rgba(29,161,242,0.45)",
      }}
      aria-label="Verified"
    >
      <Check size={size * 0.58} strokeWidth={3.5} color="#fff" />
    </span>
  )
}

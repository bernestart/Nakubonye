import { X, Download } from "lucide-react"

export default function ImageLightbox({ url, onClose }) {
  if (!url) return null
  return (
    <div
      className="fixed inset-0 z-[600] bg-black/95 grid place-items-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full grid place-items-center bg-white/10 text-white"
        aria-label="Close"
      >
        <X size={20} strokeWidth={2.4} />
      </button>

      <img
        src={url}
        alt=""
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <a
        href={url}
        download
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2"
        style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
      >
        <Download size={15} /> Save / Open
      </a>
    </div>
  )
}

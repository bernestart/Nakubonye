export default function NewPostsPill({ count, onTap }) {
  if (!count || count < 1) return null
  return (
    <div
      className="sticky top-0 z-30 flex justify-center pointer-events-none"
      style={{ height: 0 }}
    >
      <button
        onClick={onTap}
        className="pointer-events-auto mt-2 h-9 px-4 rounded-full inline-flex items-center gap-2 text-white text-[12.5px] font-bold shadow-lg active:scale-95 transition-transform"
        style={{
          background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
          boxShadow: "0 4px 16px rgba(168,85,247,0.45)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
        {count === 1 ? "1 new post" : `${count} new posts`}
      </button>
    </div>
  )
}

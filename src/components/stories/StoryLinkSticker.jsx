export default function StoryLinkSticker({ url, onOpen }) {
  if (!url) return null
  let hostname = ""
  try { hostname = new URL(url).hostname.replace('www.', '') } catch { hostname = "Link" }
  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center z-20 px-4">
      <button onClick={() => onOpen(url)} className="w-full max-w-[280px] flex items-center justify-center gap-2 bg-white text-black h-11 rounded-full font-bold text-[13px] shadow-lg active:scale-95 transition-transform">
        <span className="truncate">🔗 {hostname}</span>
        <span className="text-[11px] text-gray-500 font-normal">Swipe up</span>
      </button>
    </div>
  )
}

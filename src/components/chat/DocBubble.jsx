import { } from "lucide-react"
export default function DocBubble({ url, name, type, mine }) {
  const ext = name?.split('.').pop()?.toUpperCase() || "FILE"
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-xl border ${mine ? 'bg-purple-600/30 border-purple-500/40' : 'bg-white/[0.05] border-white/10'}`}>
      <div className="w-10 h-10 rounded-lg bg-black/20 grid place-items-center shrink-0">
        <span className={mine ? "text-white" : "text-purple-300"} style={{ width: 20, height: 20, display: 'inline-block' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
      </div>
      <div className="flex-1 min-w-0 pr-2">
        <p className={`text-[13.5px] font-semibold truncate ${mine ? 'text-white' : 'text-cream'}`}>{name || `Document.${ext.toLowerCase()}`}</p>
        <p className={`text-[11px] ${mine ? 'text-white/60' : 'text-muted'}`}>{ext} Document</p>
      </div>
      <span className={mine ? "text-white/70" : "text-muted"} style={{ width: 18, height: 18, display: 'inline-block' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
    </a>
  )
}

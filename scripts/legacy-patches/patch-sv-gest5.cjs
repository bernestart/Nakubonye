const fs = require('fs');
const p = 'src/components/StoryViewer.jsx';
let s = fs.readFileSync(p, 'utf8');
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,150))); process.exit(1); }
  s = s.replace(find, replace);
  console.log('✅', label);
}

apply(
`  const lastTapRef = useRef(0)
  const toastTimerRef = useRef(null)
  const burstTimerRef = useRef(null)`,
`  const lastTapRef = useRef(0)
  const singleTapTimerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const burstTimerRef = useRef(null)`,
'add singleTapTimerRef');

apply(
`  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY`,
`  function onTouchStart(e) {
    if (e.target && e.target.closest && e.target.closest('[data-nk-tap-ignore]')) return
    touchStartY.current = e.touches[0].clientY`,
'onTouchStart guard');

apply(
`  function onTouchEnd(e, tapAction) {
    clearTimeout(longPressTimer.current)
    if (pressFiredRef.current) {
      resumeNow()
      pressFiredRef.current = false
      return
    }
    const now = Date.now()
    const isDoubleTap = (now - lastTapRef.current) < 280
    lastTapRef.current = now
    if (isDoubleTap) {
      lastTapRef.current = 0
      if (!isMine && group?.user_id && story?.id) sendReaction("❤️")
      return
    }
    if (tapAction) tapAction()
  }`,
`  function onTouchEnd(e) {
    clearTimeout(longPressTimer.current)
    if (e.target && e.target.closest && e.target.closest('[data-nk-tap-ignore]')) {
      pressFiredRef.current = false
      return
    }
    if (pressFiredRef.current) {
      resumeNow()
      pressFiredRef.current = false
      return
    }
    const now = Date.now()
    const isDoubleTap = (now - lastTapRef.current) < 260
    lastTapRef.current = now
    if (isDoubleTap) {
      lastTapRef.current = 0
      clearTimeout(singleTapTimerRef.current)
      if (!isMine && group?.user_id && story?.id) sendReaction("❤️")
      return
    }
    const x = e.changedTouches?.[0]?.clientX ?? e.clientX ?? 0
    const w = (typeof window !== 'undefined' ? window.innerWidth : 400)
    clearTimeout(singleTapTimerRef.current)
    singleTapTimerRef.current = setTimeout(() => {
      if (x < w / 3) back()
      else advance()
    }, 260)
  }`,
'rewrite onTouchEnd');

apply(
`      onTouchEnd={(e) => onTouchEnd(e, null)}`,
`      onTouchEnd={onTouchEnd}`,
'wrapper onTouchEnd');

apply(
`      {/* Tap zones (behind the reply bar) */}
      <button
        onClick={() => {}}
        onMouseDown={onTouchStart}
        onMouseUp={(e) => onTouchEnd(e, back)}
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => onTouchEnd(e, back)}
        aria-label="Previous"
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
      />
      <button
        onClick={() => {}}
        onMouseDown={onTouchStart}
        onMouseUp={(e) => onTouchEnd(e, advance)}
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => onTouchEnd(e, advance)}
        aria-label="Next"
        className="absolute right-0 top-0 bottom-0 w-2/3 z-10"
      />`,
`      {/* Tap zones removed — outer wrapper handles single-tap & double-tap */}`,
'remove tap zones');

apply(
`      <div
        className="absolute top-6 left-3 right-3 flex items-center gap-3 z-20"`,
`      <div
        data-nk-tap-ignore
        className="absolute top-6 left-3 right-3 flex items-center gap-3 z-20"`,
'header ignore');

apply(
`      <div className="absolute bottom-4 left-3 right-3 z-30 flex items-center gap-2"`,
`      <div data-nk-tap-ignore className="absolute bottom-4 left-3 right-3 z-30 flex items-center gap-2"`,
'reply bar ignore');

apply(
`        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex gap-0.5 p-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/12 shadow-2xl"`,
`        <div data-nk-tap-ignore
             className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex gap-0.5 p-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/12 shadow-2xl"`,
'reaction picker ignore');

fs.writeFileSync(p, s);
console.log('✅ StoryViewer.jsx patched — 8 edits');

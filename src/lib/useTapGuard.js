import { useRef } from "react"
export function useTapGuard(onTap, opts = {}) {
  const { moveThreshold = 10, timeThreshold = 400 } = opts
  const start = useRef({ x: 0, y: 0, t: 0 })
  function onPointerDown(e) { start.current = { x: e.clientX, y: e.clientY, t: Date.now() } }
  function onPointerUp(e) {
    const dx = Math.abs(e.clientX - start.current.x)
    const dy = Math.abs(e.clientY - start.current.y)
    const dt = Date.now() - start.current.t
    if (dx < moveThreshold && dy < moveThreshold && dt < timeThreshold) onTap(e)
  }
  return { onPointerDown, onPointerUp }
}

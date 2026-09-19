import { useEffect, useMemo, useRef, useState } from "react"
import {
  X, Music, Image as ImageIcon, Sparkles, Type, Pencil, Wand2,
  AtSign, Download, MoreHorizontal, Send, Undo2, Redo2, Trash2, Eraser, Crop, RotateCw, RotateCcw, FlipHorizontal, FlipVertical,
  Users, Plus, Smile, Check,
} from "lucide-react"

const COLORS = ["#ffffff", "#000000", "#EC4899", "#A855F7", "#F59E0B", "#22C55E", "#3B82F6", "#EF4444", "#06B6D4", "#8B5CF6", "#F97316", "#EAB308", "#84CC16", "#10B981", "#F43F5E", "#6366F1"]

const FONTS = [
  { id: "sans",     name: "Bold",       css: "900 1em system-ui, -apple-system, sans-serif" },
  { id: "serif",    name: "Serif",      css: "700 1em Georgia, 'Times New Roman', serif" },
  { id: "hand",     name: "Handwriting",css: "700 1em 'Brush Script MT', 'Comic Sans MS', cursive" },
  { id: "mono",     name: "Mono",       css: "800 1em 'Courier New', monospace" },
  { id: "display",  name: "Display",    css: "900 1em 'Impact', 'Arial Black', sans-serif" },
  { id: "italic",   name: "Italic",     css: "italic 700 1em Georgia, serif" },
]
const STICKER_LIB = ["❤️","😂","😍","🥰","🔥","✨","💯","👏","🙌","😎","🤩","😘","💜","💕","🌸","🌈","☀️","⭐","🎉","🎈","🍀","🌹","🦋","🍕","☕","🎶","⚡","💫","🌙","👑"]
const FILTERS = [
  { id: "none",    name: "Original", css: "none" },
  { id: "warm",    name: "Warm",     css: "sepia(0.35) saturate(1.3) brightness(1.05)" },
  { id: "cool",    name: "Cool",     css: "hue-rotate(180deg) saturate(1.1) brightness(1.05)" },
  { id: "mono",    name: "Mono",     css: "grayscale(1) contrast(1.1)" },
  { id: "vivid",   name: "Vivid",    css: "saturate(1.8) contrast(1.1)" },
  { id: "fade",    name: "Fade",     css: "saturate(0.7) brightness(1.15) contrast(0.9)" },
  { id: "vintage", name: "Vintage",  css: "sepia(0.55) saturate(1.1) contrast(1.05)" },
  { id: "noir",    name: "Noir",     css: "grayscale(1) contrast(1.3) brightness(0.95)" },
]

export default function StoryEditor({ src, onCancel, onSave }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const baseImgRef = useRef(null)
  const currentStroke = useRef([])
  const drawing = useRef(false)
  const dragRef = useRef(null)
  const historyRef = useRef([])
  const redoRef = useRef([])

  const [activeTool, setActiveTool] = useState(null) // null | draw | text | stickers | filters
  const [color, setColor] = useState("#ffffff")
  const [width, setWidth] = useState(6)
  const [mode, setMode] = useState("pen")
  const [strokeHistory, setStrokeHistory] = useState([])
  const [displaySrc, setDisplaySrc] = useState(src)
  const colorInputRef = useRef(null)
  const [customColorTarget, setCustomColorTarget] = useState(null)
  const [texts, setTexts] = useState([])
  const [stickers, setStickers] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [filterId, setFilterId] = useState("none")
  const [caption, setCaption] = useState("")
  const [audience, setAudience] = useState("Everyone")
  const [toast, setToast] = useState("")
  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(""), 1600)
  }

  const filterCss = useMemo(() => FILTERS.find((f) => f.id === filterId)?.css || "none", [filterId])

  // Load image
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      baseImgRef.current = img
      const c = canvasRef.current
      if (!c) return
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      redraw()
    }
    img.src = displaySrc
  }, [displaySrc])

  function redraw() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")
    ctx.clearRect(0, 0, c.width, c.height)
    const rect = c.getBoundingClientRect()
    const sx = c.width / rect.width
    const sy = c.height / rect.height
    strokeHistory.forEach((s) => paintStroke(ctx, s, sx, sy))
    if (currentStroke.current.length > 0) {
      paintStroke(ctx, { color, width, mode, points: currentStroke.current }, sx, sy)
    }
  }

  function paintStroke(ctx, stroke, sx = 1, sy = 1) {
    const pts = stroke.points
    if (!pts.length) return
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = stroke.width * Math.max(sx, sy)
    if (stroke.mode === "eraser") ctx.globalCompositeOperation = "destination-out"
    else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = stroke.color }
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.5, pts[0].y + 0.5)
    ctx.stroke()
    ctx.globalCompositeOperation = "source-over"
  }

  function pointFromEvent(e) {
    const c = canvasRef.current
    const rect = c.getBoundingClientRect()
    const t = e.touches?.[0] || e
    return {
      x: ((t.clientX - rect.left) / rect.width) * c.width,
      y: ((t.clientY - rect.top) / rect.height) * c.height,
      rx: (t.clientX - rect.left) / rect.width,
      ry: (t.clientY - rect.top) / rect.height,
    }
  }

  function onStart(e) {
    if (activeTool !== "draw") return
    e.preventDefault()
    drawing.current = true
    currentStroke.current = [pointFromEvent(e)]
    redraw()
  }
  function onMove(e) {
    if (!drawing.current) return
    e.preventDefault()
    currentStroke.current.push(pointFromEvent(e))
    redraw()
  }
  function onEnd(e) {
    if (!drawing.current) return
    e?.preventDefault?.()
    if (currentStroke.current.length) {
      snapshot()
      setStrokeHistory((h) => [...h, { color, width, mode, points: currentStroke.current }])
    }
    currentStroke.current = []
    drawing.current = false
    redraw()
  }

  const lastPlaceRef = useRef(0)
  function placeAt(e) {
    const now = Date.now()
    if (now - lastPlaceRef.current < 300) return
    lastPlaceRef.current = now
    if (activeTool === "text") {
      snapshot()
      const p = pointFromEvent(e)
      const id = crypto.randomUUID()
      setTexts((t) => [...t, { id, text: "Tap to type", x: p.rx, y: p.ry, color: "#ffffff", size: 24, rotation: 0, fontId: "sans", style: "plain" }])
      setActiveId(id)
    } else if (activeTool === "stickers") {
      snapshot()
      const p = pointFromEvent(e)
      const id = crypto.randomUUID()
      setStickers((s) => [...s, { id, emoji: STICKER_LIB[0], x: p.rx, y: p.ry, size: 56, rotation: 0 }])
      setActiveId(id)
    }
  }

  function itemById(kind, id) {
    return kind === "text" ? texts.find((x) => x.id === id) : stickers.find((x) => x.id === id)
  }
  function pinchData(touches) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return {
      dist: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx) * (180 / Math.PI),
    }
  }
  function startDrag(kind, id, e) {
    e.stopPropagation()
    setActiveId(id)
    const wrap = wrapRef.current?.getBoundingClientRect()
    if (!wrap) return
    const touches = e.touches
    const item = itemById(kind, id)
    if (touches && touches.length >= 2) {
      const { dist, angle } = pinchData(touches)
      dragRef.current = {
        mode: "pinch",
        kind, id, wrap,
        initialDist: dist,
        initialAngle: angle,
        initialSize: item?.size || 24,
        initialRotation: item?.rotation || 0,
      }
    } else {
      dragRef.current = { mode: "drag", kind, id, wrap }
    }
  }
  function onDragMove(e) {
    const ref = dragRef.current
    if (!ref) return
    const touches = e.touches
    // If we were pinching but now only one touch remains, switch to drag
    if (ref.mode === "pinch" && (!touches || touches.length < 2)) {
      ref.mode = "drag"
    }
    if (ref.mode === "pinch") {
      const { dist, angle } = pinchData(touches)
      const scale = Math.max(0.2, Math.min(8, dist / ref.initialDist))
      const newSize = Math.max(10, Math.min(240, ref.initialSize * scale))
      const newRotation = ref.initialRotation + (angle - ref.initialAngle)
      if (ref.kind === "text") {
        setTexts((arr) => arr.map((x) => (x.id === ref.id ? { ...x, size: newSize, rotation: newRotation } : x)))
      } else {
        setStickers((arr) => arr.map((x) => (x.id === ref.id ? { ...x, size: newSize, rotation: newRotation } : x)))
      }
      return
    }
    // drag mode
    const t = (touches && touches[0]) || e
    const nx = Math.max(0.02, Math.min(0.98, (t.clientX - ref.wrap.left) / ref.wrap.width))
    const ny = Math.max(0.02, Math.min(0.98, (t.clientY - ref.wrap.top) / ref.wrap.height))
    if (ref.kind === "text") {
      setTexts((arr) => arr.map((x) => (x.id === ref.id ? { ...x, x: nx, y: ny } : x)))
    } else {
      setStickers((arr) => arr.map((x) => (x.id === ref.id ? { ...x, x: nx, y: ny } : x)))
    }
  }
  function onDragEnd() { dragRef.current = null }

  function transformAll({ rotate = 0, flip = null }) {
    const img = baseImgRef.current
    if (!img) return
    const oldW = img.naturalWidth
    const oldH = img.naturalHeight
    let newW = oldW, newH = oldH
    if (rotate === 90 || rotate === -90) { newW = oldH; newH = oldW }

    // 1. Bake transform into new image
    const c = document.createElement("canvas")
    c.width = newW
    c.height = newH
    const ctx = c.getContext("2d")
    ctx.translate(newW / 2, newH / 2)
    if (rotate) ctx.rotate((rotate * Math.PI) / 180)
    if (flip === "h") ctx.scale(-1, 1)
    if (flip === "v") ctx.scale(1, -1)
    ctx.drawImage(img, -oldW / 2, -oldH / 2)
    const newSrc = c.toDataURL("image/jpeg", 0.95)

    const newImg = new Image()
    newImg.onload = () => {
      baseImgRef.current = newImg
      setDisplaySrc(newSrc)

      const canvas = canvasRef.current
      if (canvas) { canvas.width = newW; canvas.height = newH }

      // 2. Transform strokes
      const newStrokes = strokeHistory.map((st) => ({
        ...st,
        points: st.points.map((pt) => {
          let x = pt.x, y = pt.y
          if (rotate === 90) { const nx = oldH - y; const ny = x; x = nx; y = ny }
          else if (rotate === -90) { const nx = y; const ny = oldW - x; x = nx; y = ny }
          else if (rotate === 180) { x = oldW - x; y = oldH - y }
          if (flip === "h") x = newW - x
          if (flip === "v") y = newH - y
          return { x, y }
        }),
      }))
      setStrokeHistory(newStrokes)

      // 3. Transform texts + stickers (fractions)
      const remap = (item) => {
        let x = item.x, y = item.y
        let rotation = item.rotation || 0
        if (rotate === 90) { const nx = 1 - y; const ny = x; x = nx; y = ny; rotation += 90 }
        else if (rotate === -90) { const nx = y; const ny = 1 - x; x = nx; y = ny; rotation -= 90 }
        else if (rotate === 180) { x = 1 - x; y = 1 - y; rotation += 180 }
        if (flip === "h") { x = 1 - x; rotation = -rotation }
        if (flip === "v") { y = 1 - y; rotation = -rotation }
        return { ...item, x, y, rotation }
      }
      setTexts((arr) => arr.map(remap))
      setStickers((arr) => arr.map(remap))

      setTimeout(redraw, 0)
    }
    newImg.src = newSrc
  }

  function snapshot() {
    historyRef.current.push({
      strokes: strokeHistory.map((x) => ({ ...x })),
      texts: texts.map((x) => ({ ...x })),
      stickers: stickers.map((x) => ({ ...x })),
    })
    if (historyRef.current.length > 40) historyRef.current.shift()
    redoRef.current = []
  }

  function undoAll() {
    if (historyRef.current.length === 0) {
      // Nothing to undo — maybe just undo a single stroke as fallback
      if (strokeHistory.length > 0) {
        redoRef.current.push({
          strokes: strokeHistory.map((x) => ({ ...x })),
          texts: texts.map((x) => ({ ...x })),
          stickers: stickers.map((x) => ({ ...x })),
        })
        const next = strokeHistory.slice(0, -1)
        setStrokeHistory(next)
        setTimeout(redraw, 0)
      }
      return
    }
    const snap = historyRef.current.pop()
    redoRef.current.push({
      strokes: strokeHistory.map((x) => ({ ...x })),
      texts: texts.map((x) => ({ ...x })),
      stickers: stickers.map((x) => ({ ...x })),
    })
    setStrokeHistory(snap.strokes)
    setTexts(snap.texts)
    setStickers(snap.stickers)
    currentStroke.current = []
    setTimeout(redraw, 0)
  }

  function redoAll() {
    if (redoRef.current.length === 0) return
    const snap = redoRef.current.pop()
    historyRef.current.push({
      strokes: strokeHistory.map((x) => ({ ...x })),
      texts: texts.map((x) => ({ ...x })),
      stickers: stickers.map((x) => ({ ...x })),
    })
    setStrokeHistory(snap.strokes)
    setTexts(snap.texts)
    setStickers(snap.stickers)
    setTimeout(redraw, 0)
  }

  useEffect(() => {
    const move = (e) => onDragMove(e)
    const up = () => onDragEnd()
    window.addEventListener("mousemove", move)
    window.addEventListener("touchmove", move, { passive: false })
    window.addEventListener("mouseup", up)
    window.addEventListener("touchend", up)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("touchmove", move)
      window.removeEventListener("mouseup", up)
      window.removeEventListener("touchend", up)
    }
  })

  useEffect(() => { redraw() }, [strokeHistory, color, width, mode])

  function save() {
    const img = baseImgRef.current
    const c = canvasRef.current
    if (!img || !c) return
    const out = document.createElement("canvas")
    out.width = img.naturalWidth
    out.height = img.naturalHeight
    const ctx = out.getContext("2d")
    ctx.filter = filterCss === "none" ? "none" : filterCss
    ctx.drawImage(img, 0, 0)
    ctx.filter = "none"
    ctx.drawImage(c, 0, 0, out.width, out.height)
    const W = out.width, H = out.height
    texts.forEach((t) => {
      const fs = Math.round((t.size / 100) * W * 0.9)
      const fontFamily = (FONTS.find((f) => f.id === (t.fontId || "sans"))?.css || "system-ui").replace(/^[^ ]+ /, "").replace(/^[\d.]+em /, "")
      ctx.save()
      ctx.translate(t.x * W, t.y * H)
      ctx.rotate(((t.rotation || 0) * Math.PI) / 180)
      ctx.font = "900 " + fs + "px " + fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      const metrics = ctx.measureText(t.text)
      const padX = fs * 0.4, padY = fs * 0.25
      if (t.style === "bg") {
        const w = metrics.width + padX * 2
        const h = fs + padY * 2
        ctx.fillStyle = t.color
        const r = Math.min(h / 2, 14)
        const x = -w / 2, y = -h / 2
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = "#0B0B14"
        ctx.fillText(t.text, 0, 0)
      } else if (t.style === "outline") {
        ctx.lineWidth = Math.max(1, fs * 0.07)
        ctx.strokeStyle = t.color
        ctx.strokeText(t.text, 0, 0)
      } else {
        ctx.lineWidth = Math.max(3, fs * 0.14); ctx.strokeStyle = "rgba(0,0,0,0.75)"
        ctx.strokeText(t.text, 0, 0)
        ctx.fillStyle = t.color
        ctx.fillText(t.text, 0, 0)
      }
      ctx.restore()
    })
    stickers.forEach((s) => {
      const fs = Math.round((s.size / 100) * W * 0.9)
      ctx.save()
      ctx.translate(s.x * W, s.y * H)
      ctx.rotate(((s.rotation || 0) * Math.PI) / 180)
      ctx.font = fs + "px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(s.emoji, 0, 0)
      ctx.restore()
    })
    out.toBlob((blob) => { if (blob) onSave(blob, { caption, audience }) }, "image/jpeg", 0.92)
  }

  const sidebarItems = [
    { label: "Stickers", icon: <Smile size={16} />,          on: () => setActiveTool("stickers") },
    { label: "Effects",  icon: <Wand2 size={16} />,          on: () => setActiveTool("filters") },
    { label: "Crop",     icon: <Crop size={16} />,            on: () => setActiveTool("crop") },
    { label: "Mention",  icon: <AtSign size={16} />,         on: () => { setCaption((c) => (c + " @").slice(0, 200)); showToast("Added @ to caption") } },
    { label: "Save",     icon: <Download size={16} />,       on: save },
    { label: "More",     icon: <MoreHorizontal size={16} />, on: () => showToast("More options coming soon") },
  ]

  return (
    <>
    <input
      ref={colorInputRef}
      type="color"
      style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
      onChange={(e) => {
        const c = e.target.value
        if (customColorTarget === "text") {
          setTexts((arr) => arr.map((x) => (x.id === activeId ? { ...x, color: c } : x)))
        } else if (customColorTarget === "draw") {
          setColor(c); setMode("pen")
        }
      }}
    />
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-black overflow-hidden select-none flex flex-col justify-between"
      style={{ width: "100vw", height: "100dvh", zIndex: 9999 }}
    >
      {/* Background media */}
      <img
        src={displaySrc}
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        style={{ filter: filterCss }}
        draggable={false}
      />

      {/* Drawing canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{
          objectFit: "cover",
          touchAction: activeTool === "draw" ? "none" : "auto",
          pointerEvents: activeTool === "draw" ? "auto" : "none",
        }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />

      {/* Tap layer for placing text/stickers */}
      {(activeTool === "text" || activeTool === "stickers") && (
        <div className="absolute inset-0 z-10" onClick={placeAt} />
      )}

      {/* Text overlays */}
      {texts.map((t) => (
        <div
          key={t.id}
          onMouseDown={(e) => startDrag("text", t.id, e)}
          onTouchStart={(e) => startDrag("text", t.id, e)}
          onClick={(e) => { e.stopPropagation(); setActiveId(t.id) }}
          style={(() => {
            const fontFamily = (FONTS.find((f) => f.id === (t.fontId || "sans"))?.css || "").replace(/^[^ ]+ /, "").replace(/^[\d.]+em /, "")
            const base = {
              position: "absolute",
              left: (t.x * 100) + "%",
              top: (t.y * 100) + "%",
              transform: `translate(-50%,-50%) rotate(${t.rotation || 0}deg)`,
              color: t.color,
              fontWeight: 900,
              fontSize: t.size,
              fontFamily,
              whiteSpace: "nowrap",
              zIndex: 15,
              touchAction: "none",
              border: activeId === t.id && activeTool === "text" ? "1px dashed rgba(255,255,255,0.55)" : "none",
              padding: 4,
            }
            if (t.style === "bg") {
              return { ...base, background: t.color, color: "#0B0B14", padding: "6px 14px", borderRadius: 10 }
            }
            if (t.style === "outline") {
              return {
                ...base,
                color: "transparent",
                WebkitTextStroke: `${Math.max(1, t.size / 14)}px ${t.color}`,
                textShadow: "none",
              }
            }
            return { ...base, textShadow: "0 2px 12px rgba(0,0,0,0.85)", WebkitTextStroke: "0.5px rgba(0,0,0,0.5)" }
          })()}
        >
          {t.text}
        </div>
      ))}

      {/* Sticker overlays */}
      {stickers.map((s) => (
        <div
          key={s.id}
          onMouseDown={(e) => startDrag("sticker", s.id, e)}
          onTouchStart={(e) => startDrag("sticker", s.id, e)}
          onClick={(e) => { e.stopPropagation(); setActiveId(s.id) }}
          style={{
            position: "absolute",
            left: (s.x * 100) + "%",
            top: (s.y * 100) + "%",
            transform: `translate(-50%,-50%) rotate(${s.rotation || 0}deg)`,
            fontSize: s.size,
            zIndex: 15,
            touchAction: "none",
            border: activeId === s.id && activeTool === "stickers" ? "1px dashed rgba(255,255,255,0.55)" : "none",
            padding: 4,
          }}
        >
          {s.emoji}
        </div>
      ))}

      {/* TOP TOOLBAR */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-20">
        <button
          onClick={onCancel}
          aria-label="Close"
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto cursor-pointer"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
        <div className="bg-black/40 backdrop-blur-md rounded-full p-2 text-white flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => showToast("Music coming soon")}
            className="w-8 h-8 rounded-full grid place-items-center"
            aria-label="Music"
            title="Music"
          >
            <Music size={16} />
          </button>
          <button
            onClick={() => showToast("Change photo from the previous screen")}
            className="w-8 h-8 rounded-full grid place-items-center"
            aria-label="Media"
            title="Media"
          >
            <ImageIcon size={16} />
          </button>
          <button
            onClick={() => setActiveTool("filters")}
            className="w-8 h-8 rounded-full grid place-items-center"
            aria-label="Restyle"
            title="Restyle"
          >
            <Sparkles size={16} />
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className="w-8 h-8 rounded-full grid place-items-center"
            aria-label="Text"
            title="Text"
          >
            <Type size={16} />
          </button>
          <button
            onClick={() => setActiveTool("draw")}
            className="w-8 h-8 rounded-full grid place-items-center"
            aria-label="Draw"
            title="Draw"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="absolute right-4 top-20 flex flex-col items-end gap-3.5 z-20">
        {sidebarItems.map((item) => (
          <button
            key={item.label}
            onClick={item.on}
            className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-white text-xs font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {item.label}
            </span>
            <span className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-lg">
              {item.icon}
            </span>
          </button>
        ))}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full z-50 pointer-events-none">
          {toast}
        </div>
      )}

      {/* BOTTOM OVERLAY */}
      {!activeTool && (
        <div
          className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-3 z-20 pt-12"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.3) 55%, transparent)" }}
        >
          <button
            onClick={() => setActiveTool("filters")}
            className="text-white/80 text-xs text-center font-medium drop-shadow mb-1 animate-pulse"
          >
            Swipe up for filters...
          </button>

          <div className="w-full bg-black/50 backdrop-blur-md border border-white/15 rounded-full px-4 py-3 flex items-center gap-3 text-white shadow-2xl">
            <ImageIcon size={18} className="text-white/70" />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption..."
              className="bg-transparent border-none outline-none text-white placeholder-gray-300 w-full text-sm"
            />
            <AtSign size={18} className="text-white/70" />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setAudience((a) => (a === "Everyone" ? "Close Friends" : "Everyone"))}
              className="bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs px-4 py-2.5 rounded-full flex items-center gap-2 cursor-pointer font-medium"
            >
              <Users size={14} /> Status ({audience}) <Plus size={12} />
            </button>
            <button
              onClick={save}
              aria-label="Send"
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center font-bold text-lg shadow-xl cursor-pointer hover:scale-105 transition-transform"
            >
              <Send size={20} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {/* CONTEXTUAL TOOL PANELS */}
      {activeTool === "draw" && (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-30 bg-black/70 backdrop-blur-md flex flex-col gap-2"
             style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("pen")}
              className="w-10 h-10 rounded-full grid place-items-center"
              style={{ background: mode === "pen" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)" }}
              aria-label="Pen"
            >
              <Pencil size={18} className="text-white" />
            </button>
            <button
              onClick={() => setMode("eraser")}
              className="w-10 h-10 rounded-full grid place-items-center"
              style={{ background: mode === "eraser" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)" }}
              aria-label="Eraser"
            >
              <Eraser size={18} className="text-white" />
            </button>
            <div className="flex gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: "none" }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setMode("pen") }}
                  aria-label={"Color " + c}
                  className="shrink-0 w-8 h-8 rounded-full border-2"
                  style={{ background: c, borderColor: color === c && mode === "pen" ? "#fff" : "rgba(255,255,255,0.15)" }}
                />
              ))}
              <button
                data-custom="draw"
                onClick={() => { setCustomColorTarget("draw"); colorInputRef.current?.click() }}
                aria-label="Custom color"
                className="shrink-0 w-8 h-8 rounded-full border-2 border-white/25 grid place-items-center"
                style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
              />
            </div>
            <div className="flex gap-1.5">
              {[3, 6, 12].map((w) => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  aria-label={"Width " + w}
                  className="w-8 h-8 rounded-full grid place-items-center border-2"
                  style={{ borderColor: width === w ? "#fff" : "rgba(255,255,255,0.15)" }}
                >
                  <span style={{ width: w + 2, height: w + 2, borderRadius: 999, background: "#fff", display: "block" }} />
                </button>
              ))}
            </div>
            <button
              onClick={undoAll}
              className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.08]"
              aria-label="Undo"
            >
              <Undo2 size={16} className="text-white" />
            </button>
            <button
              onClick={redoAll}
              className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.08]"
              aria-label="Redo"
            >
              <Redo2 size={16} className="text-white" />
            </button>
            <button
              onClick={() => { snapshot(); setStrokeHistory([]); currentStroke.current = []; redraw() }}
              className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.08]"
              aria-label="Clear"
            >
              <Trash2 size={16} className="text-white" />
            </button>
          </div>
          <button
            onClick={() => { setActiveTool(null); setActiveId(null) }}
            className="self-center h-9 px-4 rounded-full bg-white/[0.08] text-white text-[13px] font-bold inline-flex items-center gap-1.5"
          >
            <Check size={14} strokeWidth={3} /> Done
          </button>
        </div>
      )}

      {activeTool === "text" && (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-30 bg-black/70 backdrop-blur-md flex flex-col gap-2"
             style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <input
            value={texts.find((x) => x.id === activeId)?.text || ""}
            onChange={(e) => {
              const v = e.target.value.slice(0, 120)
              setTexts((arr) => arr.map((x) => (x.id === activeId ? { ...x, text: v } : x)))
            }}
            placeholder="Type your text..."
            autoFocus
            className="h-11 rounded-full bg-white/[0.08] px-4 text-white text-[14px] placeholder:text-white/50 focus:outline-none"
          />
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {[
              { id: "plain",   label: "Plain" },
              { id: "bg",      label: "Background" },
              { id: "outline", label: "Outline" },
            ].map((st) => {
              const active = (texts.find((x) => x.id === activeId)?.style || "plain") === st.id
              return (
                <button
                  key={st.id}
                  onClick={() => setTexts((arr) => arr.map((x) => (x.id === activeId ? { ...x, style: st.id } : x)))}
                  className="shrink-0 h-9 px-3 rounded-full text-white text-[12px] border"
                  style={{
                    borderColor: active ? "#fff" : "rgba(255,255,255,0.15)",
                    background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {st.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FONTS.map((f) => {
              const active = (texts.find((x) => x.id === activeId)?.fontId || "sans") === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setTexts((arr) => arr.map((x) => (x.id === activeId ? { ...x, fontId: f.id } : x)))}
                  className="shrink-0 h-9 px-3 rounded-full text-white text-[12px] border"
                  style={{
                    fontFamily: f.css.replace(/^[^ ]+ /, "").replace(/^[\d.]+em /, ""),
                    borderColor: active ? "#fff" : "rgba(255,255,255,0.15)",
                    background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {f.name}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setTexts((arr) => arr.map((x) => (x.id === activeId ? { ...x, color: c } : x)))}
                aria-label={"Color " + c}
                className="shrink-0 w-8 h-8 rounded-full border-2"
                style={{ background: c, borderColor: texts.find((x) => x.id === activeId)?.color === c ? "#fff" : "rgba(255,255,255,0.15)" }}
              />
            ))}
            <button
              data-custom="text"
              onClick={() => { setCustomColorTarget("text"); colorInputRef.current?.click() }}
              aria-label="Custom color"
              className="shrink-0 w-8 h-8 rounded-full border-2 border-white/25"
              style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
            />
            {[16, 24, 36, 52].map((sz) => (
              <button
                key={sz}
                onClick={() => setTexts((arr) => arr.map((x) => (x.id === activeId ? { ...x, size: sz } : x)))}
                className="shrink-0 h-8 px-3 rounded-full text-white text-[12px] font-bold border"
                style={{
                  borderColor: texts.find((x) => x.id === activeId)?.size === sz ? "#fff" : "rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                {sz}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setActiveTool(null); setActiveId(null) }}
            className="self-center h-9 px-4 rounded-full bg-white/[0.08] text-white text-[13px] font-bold inline-flex items-center gap-1.5"
          >
            <Check size={14} strokeWidth={3} /> Done
          </button>
        </div>
      )}

      {activeTool === "stickers" && (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-30 bg-black/70 backdrop-blur-md flex flex-col gap-2"
             style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {STICKER_LIB.map((e) => (
              <button
                key={e}
                onClick={() => {
                  if (activeId) setStickers((arr) => arr.map((x) => (x.id === activeId ? { ...x, emoji: e } : x)))
                  else {
                    const id = crypto.randomUUID()
                    setStickers((arr) => [...arr, { id, emoji: e, x: 0.5, y: 0.5, size: 56, rotation: 0 }])
                    setActiveId(id)
                  }
                }}
                className="shrink-0 w-11 h-11 rounded-full grid place-items-center text-2xl"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {[32, 48, 64, 88].map((sz) => (
              <button
                key={sz}
                onClick={() => setStickers((arr) => arr.map((x) => (x.id === activeId ? { ...x, size: sz } : x)))}
                className="h-8 px-3 rounded-full text-white text-[12px] font-bold border"
                style={{
                  borderColor: stickers.find((x) => x.id === activeId)?.size === sz ? "#fff" : "rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                {sz}
              </button>
            ))}
            <button
              onClick={() => { snapshot(); setStickers([]); setActiveId(null) }}
              className="ml-auto w-10 h-10 rounded-full grid place-items-center bg-white/[0.08]"
              aria-label="Clear stickers"
            >
              <Trash2 size={16} className="text-white" />
            </button>
            <button
              onClick={() => { setActiveTool(null); setActiveId(null) }}
              className="h-9 px-4 rounded-full bg-white/[0.08] text-white text-[13px] font-bold inline-flex items-center gap-1.5"
            >
              <Check size={14} strokeWidth={3} /> Done
            </button>
          </div>
        </div>
      )}

      {activeTool === "crop" && (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-30 bg-black/70 backdrop-blur-md flex flex-col gap-2"
             style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <p className="text-white/70 text-[11.5px] font-semibold text-center">Rotate · Flip</p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => transformAll({ rotate: -90 })}
              className="h-12 px-4 rounded-full bg-white/[0.08] text-white font-bold text-[13px] inline-flex items-center gap-2"
            >
              <RotateCcw size={16} /> Left
            </button>
            <button
              onClick={() => transformAll({ rotate: 90 })}
              className="h-12 px-4 rounded-full bg-white/[0.08] text-white font-bold text-[13px] inline-flex items-center gap-2"
            >
              <RotateCw size={16} /> Right
            </button>
            <button
              onClick={() => transformAll({ flip: "h" })}
              className="h-12 px-4 rounded-full bg-white/[0.08] text-white font-bold text-[13px] inline-flex items-center gap-2"
            >
              <FlipHorizontal size={16} /> Flip
            </button>
            <button
              onClick={() => transformAll({ flip: "v" })}
              className="h-12 px-4 rounded-full bg-white/[0.08] text-white font-bold text-[13px] inline-flex items-center gap-2"
            >
              <FlipVertical size={16} /> Flip V
            </button>
          </div>
          <button
            onClick={() => setActiveTool(null)}
            className="self-center h-9 px-4 rounded-full bg-white/[0.08] text-white text-[13px] font-bold inline-flex items-center gap-1.5"
          >
            <Check size={14} strokeWidth={3} /> Done
          </button>
        </div>
      )}

      {activeTool === "filters" && (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-30 bg-black/70 backdrop-blur-md flex flex-col gap-2"
             style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <p className="text-white/70 text-[11.5px] font-semibold text-center">Filters</p>
          <div className="flex gap-3 overflow-x-auto px-1" style={{ scrollbarWidth: "none" }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterId(f.id)}
                className="shrink-0 flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-16 h-16 rounded-2xl overflow-hidden border-2"
                  style={{ borderColor: filterId === f.id ? "#fff" : "transparent" }}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" style={{ filter: f.css }} />
                </div>
                <span className="text-white text-[11px] font-semibold">{f.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setActiveTool(null)}
            className="self-center h-9 px-4 rounded-full bg-white/[0.08] text-white text-[13px] font-bold inline-flex items-center gap-1.5"
          >
            <Check size={14} strokeWidth={3} /> Done
          </button>
        </div>
      )}
    </div>
    </>
  )
}

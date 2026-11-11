import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useAnimation } from "framer-motion"
import { useGesture } from "@use-gesture/react"
import {
  X, Type, Smile, Sparkles, Loader2, Send,
  MapPin, Clock, CloudSun, Trash2, Music, BarChart,
  Link as LinkIcon, AtSign, HelpCircle, Settings, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, Eye, Mic, ArrowLeft, Search,
  Calendar, Heart, UserCircle, PenTool, Highlighter, Eraser, Undo2, Redo2, Play
} from "lucide-react"
import { drawStickerToCanvas } from "./drawSticker"
import DrawingLayer from "./DrawingLayer"
import { FilePicker } from "@capawesome/capacitor-file-picker"
import { Capacitor } from "@capacitor/core"
import { base64ToBlob } from "../../lib/storyUpload"
import { useAuth } from "../../lib/auth"
import { publicPhotoUrl } from "../../lib/photo"

const TEXT_STYLES = [
  { id: "classic", name: "Classic", className: "font-sans font-medium text-white drop-shadow-md" },
  { id: "neon", name: "Neon", className: "font-sans font-bold text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]" },
  { id: "strong", name: "Strong", className: "font-sans font-black text-white uppercase tracking-wider drop-shadow-lg" },
  { id: "typewriter", name: "Typewriter", className: "font-mono font-bold text-white drop-shadow-md" },
]

const STICKER_PILLS = [
  { id: "photo", label: "Photo", icon: <ImageIcon size={18} className="text-blue-400" />, badge: "New" },
  { id: "location", label: "Location", icon: <MapPin size={18} className="text-red-400" /> },
  { id: "time", label: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), icon: <Clock size={18} className="text-yellow-400" /> },
  { id: "gif", label: "GIF", icon: <Search size={18} className="text-green-400" /> },
  { id: "music", label: "Music", icon: <Music size={18} className="text-pink-400" /> },
  { id: "event", label: "Event", icon: <Calendar size={18} className="text-red-400" /> },
  { id: "tag", label: "Tag", icon: <AtSign size={18} className="text-teal-400" /> },
  { id: "feelings", label: "Feelings", icon: <Smile size={18} className="text-yellow-400" /> },
  { id: "donate", label: "Donate", icon: <Heart size={18} className="text-red-400" /> },
  { id: "poll", label: "Poll", icon: <BarChart size={18} className="text-orange-400" /> },
  { id: "question", label: "Question", icon: <HelpCircle size={18} className="text-red-400" /> },
  { id: "avatar", label: "Avatar", icon: <UserCircle size={18} className="text-pink-400" /> },
  { id: "link", label: "Link", icon: <LinkIcon size={18} className="text-blue-400" /> },
]

const FEELINGS_LIST = [
  { emoji: "😊", label: "Happy" }, { emoji: "🥰", label: "Loved" }, { emoji: "💖", label: "Lovely" },
  { emoji: "🤩", label: "Excited" }, { emoji: "😎", label: "Cool" }, { emoji: "😇", label: "Blessed" },
  { emoji: "🥺", label: "Thankful" }, { emoji: "😍", label: "In love" }, { emoji: "😊", label: "Grateful" },
  { emoji: "😴", label: "Relaxed" }, { emoji: "😔", label: "Sad" }, { emoji: "😡", label: "Angry" }
]

const MOCK_GIFS = [
  "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
  "https://media.giphy.com/media/l41Yc5j9K8Gq7G6GQ/giphy.gif",
  "https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif",
  "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
  "https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"
]

const FILTERS = [
  { id: "none", name: "No filter", css: "none" },
  { id: "8k", name: "8K ULTRAHD", css: "contrast(1.2) saturate(1.2) brightness(1.05)" },
  { id: "glitch", name: "GLITCH", css: "contrast(1.5) hue-rotate(90deg) saturate(1.5)" }
]

export default function StoryEditor({ src, mediaType = "image", mediaMime = "", onCancel, onShare }) {
  const { profile } = useAuth()
  const [layers, setLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [activeModal, setActiveModal] = useState(null)
  const [filter, setFilter] = useState(FILTERS[0])

  const [textInput, setTextInput] = useState("")
  const [textStyle, setTextStyle] = useState(TEXT_STYLES[0])
  const [textAlign, setTextAlign] = useState("center")
  const [isHidden, setIsHidden] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [questionPrompt, setQuestionPrompt] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [mentionQuery, setMentionQuery] = useState("")
  const [addYoursPrompt, setAddYoursPrompt] = useState("")
  const [audience, setAudience] = useState("everyone")

  const [selectedMusic, setSelectedMusic] = useState(null)
  const [gifs, setGifs] = useState([])
  const [gifQuery, setGifQuery] = useState("")
  const [gifLoading, setGifLoading] = useState(false)

  const [drawingMode, setDrawingMode] = useState(false)
  const [brushType, setBrushType] = useState("pen")
  const [brushColor, setBrushColor] = useState("#FFFFFF")
  const [brushSize, setBrushSize] = useState(6)
  const drawingRef = useRef(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [caption, setCaption] = useState("")

  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const videoRef = useRef(null)
  
  const controls = useAnimation()
  const bindCanvas = useGesture({
    onDrag: ({ movement: [, my], last }) => {
      if (activeModal || drawingMode) return 
      if (my > 0) { controls.set({ y: my }); if (last && my > 100) onCancel(); else if (last) controls.start({ y: 0 }) }
    }
  })

  function addSticker(type, data, content) {
    const newLayer = { id: crypto.randomUUID(), type, data, content, x: 0, y: 0, scale: 1, rotation: 0 }
    setLayers(prev => [...prev, newLayer])
    setSelectedId(newLayer.id)
    setActiveModal(null)
  }

  function addTextLayer() {
    if (!textInput.trim()) { setActiveModal(null); return }
    const newLayer = { id: crypto.randomUUID(), type: "text", content: textInput, style: textStyle, align: textAlign, hidden: isHidden, x: 0, y: 0, scale: 1, rotation: 0 }
    setLayers(prev => [...prev, newLayer])
    setSelectedId(newLayer.id)
    setTextInput(""); setTextStyle(TEXT_STYLES[0]); setTextAlign("center"); setIsHidden(false)
    setActiveModal(null)
  }

  async function pickPhotoSticker() {
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await FilePicker.pickImages({ limit: 1, readData: true })
        if (res.files && res.files[0]?.data) {
          const blob = base64ToBlob(res.files[0].data, "image/jpeg")
          const url = URL.createObjectURL(blob)
          addSticker("image", null, url)
          setActiveModal(null)
        }
      } else {
        const input = document.createElement("input")
        input.type = "file"; input.accept = "image/*"
        input.onchange = () => {
          if (input.files?.[0]) {
            addSticker("image", null, URL.createObjectURL(input.files[0]))
            setActiveModal(null)
          }
        }
        input.click()
      }
    } catch (e) { console.warn(e) }
  }

  function updateLayer(id, patch) { setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)) }
  function deleteLayer(id) { setLayers(prev => prev.filter(l => l.id !== id)); if (selectedId === id) setSelectedId(null) }
  function bringToFront(id) { setLayers(prev => { const layer = prev.find(l => l.id === id); if (!layer) return prev; return [...prev.filter(l => l.id !== id), layer] }) }

  async function fetchGifs(q = "trending") {
    setGifLoading(true)
    try {
      const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=20`)
      const data = await res.json()
      setGifs(data.results.map(g => g.media[0].gif.url))
    } catch (e) { console.warn(e) }
    setGifLoading(false)
  }

  useEffect(() => { if (activeModal === "gif" && gifs.length === 0) fetchGifs("trending") }, [activeModal])

  async function fetchGifs(q = "trending") {
    setGifLoading(true)
    try {
      const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=20`)
      const data = await res.json()
      setGifs(data.results.map(g => g.media[0].gif.url))
    } catch (e) { console.warn(e) }
    setGifLoading(false)
  }

  useEffect(() => { if (activeModal === "gif" && gifs.length === 0) fetchGifs("trending") }, [activeModal])

  async function fetchGifs(q = "trending") {
    setGifLoading(true)
    try {
      const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=20`)
      const data = await res.json()
      setGifs(data.results?.map(g => g.media[0].gif.url) || [])
    } catch (e) { console.warn(e) }
    setGifLoading(false)
  }

  useEffect(() => { if (activeModal === "gif" && gifs.length === 0) fetchGifs("trending") }, [activeModal])

  async function composeAndShare() {
    if (!containerRef.current) return
if (mediaType === "image" && !imgRef.current) return
    setBusy(true); setError("")
    try {
      const img = imgRef.current
      // ---- VIDEO PATH: never rasterise a video through canvas ----
      if (mediaType === "video") {
        const fetchUrl = /^(https?:|blob:)/.test(src) ? src : Capacitor.convertFileSrc(src)
        const res = await fetch(fetchUrl)
        if (!res.ok) throw new Error("Could not read video from device (" + res.status + ").")
        const rawBlob = await res.blob()
        if (!rawBlob || rawBlob.size === 0) throw new Error("The video file is empty or unreadable.")
        const mime = (mediaMime || rawBlob.type || "video/mp4").toLowerCase()
        const typedBlob = rawBlob.type === mime ? rawBlob : new Blob([rawBlob], { type: mime })

        const metaExtract = {}
        const pollLayer = layers.find(l => l.type === "poll"); if (pollLayer) metaExtract.poll = pollLayer.data
        const questionLayer = layers.find(l => l.type === "question"); if (questionLayer) metaExtract.question = questionLayer.data
        if (selectedMusic) metaExtract.music = selectedMusic

        await onShare(typedBlob, { caption, audience, metadata: metaExtract, mediaType: "video", mimeType: mime })
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const containerAspect = rect.width / rect.height
      let canvasW = containerAspect >= 1 ? Math.min(1920, Math.round(rect.width * 2)) : Math.round((Math.min(1920, Math.round(rect.height * 2))) * containerAspect)
      let canvasH = containerAspect >= 1 ? Math.round(canvasW / containerAspect) : Math.min(1920, Math.round(rect.height * 2))
      const canvas = document.createElement("canvas")
      canvas.width = canvasW; canvas.height = canvasH
      const ctx = canvas.getContext("2d")
      
      // -- Calculate object-fit: cover math to stop elastic stretching --
      const imgAspect = img.naturalWidth / img.naturalHeight
      const canvasAspect = canvasW / canvasH
      let drawW = canvasW
      let drawH = canvasH
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        drawW = canvasH * imgAspect
        offsetX = (canvasW - drawW) / 2
      } else {
        drawH = canvasW / imgAspect
        offsetY = (canvasH - drawH) / 2
      }

      ctx.filter = filter.css === "none" ? "none" : filter.css
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
      ctx.filter = "none"
      if (drawingRef.current?.getCanvas()) { ctx.drawImage(drawingRef.current.getCanvas(), 0, 0, canvasW, canvasH) }

      // Preload image layers
      const imgCache = {}
      for (const layer of layers) {
        if (layer.type === "image" || layer.type === "avatar") {
          const image = new Image(); image.crossOrigin = "anonymous"; image.src = layer.content;
          await new Promise(r => { image.onload = r; image.onerror = r })
          imgCache[layer.content] = image
        }
      }

      for (const layer of layers) { drawStickerToCanvas(ctx, layer, rect.width, rect.height, canvasW, canvasH, imgCache) }
      
      const blob = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Canvas export timed out")), 15000)
        canvas.toBlob((b) => { clearTimeout(timeout); if (b) resolve(b); else reject(new Error("Canvas export failed")) }, "image/jpeg", 0.92)
      })
      
      const metaExtract = {}
      const pollLayer = layers.find(l => l.type === 'poll'); if (pollLayer) metaExtract.poll = pollLayer.data
      const questionLayer = layers.find(l => l.type === 'question'); if (questionLayer) metaExtract.question = questionLayer.data
      if (selectedMusic) metaExtract.music = selectedMusic

      await onShare(blob, { caption, audience, metadata: metaExtract, mediaType: "image", mimeType: blob.type || "image/jpeg" })
    } catch (err) { console.error(err); setError(err.message || "Failed to share story"); setBusy(false) }
  }

  return createPortal(
    <motion.div animate={controls} className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden select-none">
      <div ref={containerRef} className="absolute inset-0 z-0" {...bindCanvas()}>
        {mediaType === "video" ? (
          <video ref={videoRef} src={src} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{ filter: filter.css }} />
        ) : (
          <img ref={imgRef} src={src} className="w-full h-full object-cover" style={{ filter: filter.css }} alt="" />
        )}
      </div>

      <DrawingLayer ref={drawingRef} active={drawingMode} brushType={brushType} color={brushColor} size={brushSize} />

      {!drawingMode && <div className="absolute inset-0 z-[5]" onClick={() => setSelectedId(null)} />}

      {!drawingMode && layers.map(layer => (
        <LayerView key={layer.id} layer={layer} isSelected={selectedId === layer.id}
          onSelect={() => { setSelectedId(layer.id); bringToFront(layer.id) }}
          onUpdate={(patch) => updateLayer(layer.id, patch)} onDelete={() => deleteLayer(layer.id)}
        />
      ))}

      {/* Music Pill (Top) */}
      {selectedMusic && !drawingMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
           <Music size={16} className="text-pink-400" />
           <span className="text-white text-xs font-bold">{selectedMusic.title}</span>
           <button onClick={() => setSelectedMusic(null)}><X size={14} className="text-white/60" /></button>
        </div>
      )}

      {!drawingMode && (
        <div className="relative z-20 flex items-center justify-between px-4 pb-3 bg-gradient-to-b from-black/60 to-transparent shrink-0 pointer-events-auto" style={{ paddingTop: "max(16px, var(--safe-top, 32px))" }}>
          <button onClick={onCancel} className="p-2"><X className="text-white" size={26} strokeWidth={2.5} /></button>
          <button onClick={() => setActiveModal("music")} className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5">
            <Music size={16} className="text-white" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-white text-sm font-bold">{selectedMusic ? selectedMusic.title : "Add music"}</span>
              <span className="text-white/60 text-[11px]">{selectedMusic ? selectedMusic.artist : "Discover suggestions"}</span>
            </div>
          </button>
          <button onClick={() => setActiveModal("settings")} className="p-2"><Settings className="text-white" size={24} /></button>
        </div>
      )}

      {!drawingMode && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-5 items-end pointer-events-auto">
          <ToolButton icon={Smile} label="Stickers" onClick={() => setActiveModal("stickers")} />
          <ToolButton icon={Type} label="Text" onClick={() => setActiveModal("text")} />
          <ToolButton icon={PenTool} label="Draw" onClick={() => setDrawingMode(true)} />
          <ToolButton icon={Sparkles} label="Effects" onClick={() => setActiveModal("effects")} />
          <ToolButton icon={AtSign} label="Mention" onClick={() => setActiveModal("mention")} />
          <ToolButton icon={LinkIcon} label="Link" onClick={() => setActiveModal("link")} />
        </div>
      )}

      {!drawingMode && (
        <div className="relative z-20 mt-auto bg-gradient-to-t from-black/80 to-transparent px-4 pb-safe flex items-center justify-between pointer-events-auto" style={{ paddingTop: 40, paddingBottom: "max(16px, var(--safe-bottom, 8px))" }}>
          
          <button onClick={composeAndShare} disabled={busy} className="h-12 bg-gradient-to-r from-purple-600 to-pink-600 px-8 rounded-lg text-white font-bold text-[16px] shadow-lg active:scale-95 transition-transform disabled:opacity-50">
            {busy ? <Loader2 size={22} className="text-white animate-spin" /> : "Share"}
          </button>
        </div>
      )}

      {drawingMode && (
        <div className="absolute bottom-0 inset-x-0 z-[70] bg-black/90 backdrop-blur-md pb-safe pt-3 px-4 flex flex-col gap-3 border-t border-white/10">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button onClick={() => { setBrushType("pen"); setBrushColor("#FFFFFF") }} className={`w-10 h-10 rounded-full grid place-items-center ${brushType === "pen" ? "bg-white/20" : ""}`}><PenTool size={20} className="text-white" /></button>
              <button onClick={() => { setBrushType("highlighter"); setBrushColor("#FBBF24") }} className={`w-10 h-10 rounded-full grid place-items-center ${brushType === "highlighter" ? "bg-white/20" : ""}`}><Highlighter size={20} className="text-yellow-400" /></button>
              <button onClick={() => setBrushType("eraser")} className={`w-10 h-10 rounded-full grid place-items-center ${brushType === "eraser" ? "bg-white/20" : ""}`}><Eraser size={20} className="text-white" /></button>
            </div>
            <div className="flex gap-4">
              <button onClick={() => drawingRef.current?.undo()}><Undo2 size={20} className="text-white" /></button>
              <button onClick={() => drawingRef.current?.redo()}><Redo2 size={20} className="text-white" /></button>
              <button onClick={() => setDrawingMode(false)} className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-sm">Done</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {["#FFFFFF", "#000000", "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"].map(c => (
                <button key={c} onClick={() => setBrushColor(c)} className={`w-8 h-8 rounded-full border-2 ${brushColor === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
            <input type="range" min="2" max="30" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="flex-1" />
          </div>
        </div>
      )}

      {/* TEXT EDITOR MODAL */}
      <AnimatePresence>
        {activeModal === "text" && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col" style={{ paddingTop: "max(16px, var(--safe-top, 32px))" }}>
            <div className="px-4 flex justify-between items-center mb-4">
              <button onClick={() => setActiveModal(null)}><X className="text-white" size={24} /></button>
              <div className="flex gap-4">
                <button onClick={() => setIsHidden(!isHidden)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${isHidden ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "bg-white/10 text-white/70"}`}><Eye size={14} /> Thoughts</button>
                <button onClick={() => setTextAlign(textAlign === "center" ? "left" : textAlign === "left" ? "right" : "center")} className="w-10 h-10 rounded-full bg-white/10 grid place-items-center">{textAlign === "center" ? <AlignCenter size={20} className="text-white" /> : textAlign === "left" ? <AlignLeft size={20} className="text-white" /> : <AlignRight size={20} className="text-white" />}</button>
              </div>
              <button onClick={addTextLayer} className="text-white font-bold text-[16px]">Done</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
              <textarea autoFocus value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Start typing" className={`w-full bg-transparent text-center outline-none resize-none overflow-hidden ${textStyle.className}`} style={{ textAlign: textAlign }} rows={3} />
            </div>
            <div className="flex justify-center gap-3 mb-6 overflow-x-auto px-4 py-2">
              {TEXT_STYLES.map(style => <button key={style.id} onClick={() => setTextStyle(style)} className={`shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all ${textStyle.id === style.id ? "bg-white text-black" : "bg-white/10 text-white"}`}>{style.name}</button>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POLL MODAL */}
      <AnimatePresence>
        {activeModal === "poll" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/60 grid place-items-center px-6">
            <div className="bg-[#1C1C1E] w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col border border-white/10">
              <input autoFocus type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question..." className="w-full text-center text-white font-bold text-lg outline-none placeholder-white/40 mb-6 bg-transparent" />
              <div className="flex h-14 bg-white/5 rounded-full overflow-hidden border border-white/10"><button onClick={() => { if(pollQuestion) { addSticker("poll", { question: pollQuestion, options: ["YES", "NO"] }); setPollQuestion(""); } }} className="flex-1 border-r border-white/10 text-blue-400 font-bold text-lg">YES</button><button onClick={() => { if(pollQuestion) { addSticker("poll", { question: pollQuestion, options: ["YES", "NO"] }); setPollQuestion(""); } }} className="flex-1 text-blue-400 font-bold text-lg">NO</button></div>
              <button onClick={() => setActiveModal(null)} className="mt-6 text-white/50 font-semibold text-sm text-center">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUESTION MODAL */}
      <AnimatePresence>
        {activeModal === "question" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/60 flex flex-col justify-end">
            <div className="bg-[#1C1C1E] w-full rounded-t-3xl p-6 shadow-2xl flex flex-col pb-safe border-t border-white/10">
              <input autoFocus type="text" value={questionPrompt} onChange={e => setQuestionPrompt(e.target.value)} placeholder="ASK A QUESTION..." className="w-full bg-transparent text-center text-white/60 font-bold text-sm tracking-widest outline-none mb-4 uppercase placeholder-white/30" />
              <div className="bg-white/5 rounded-xl p-4 text-center text-white/40 text-sm mb-6">People can answer here.</div>
              <div className="flex gap-2"><button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-white/60 font-bold">Cancel</button><button onClick={() => { if(questionPrompt) { addSticker("question", { prompt: questionPrompt }); setQuestionPrompt(""); } }} disabled={!questionPrompt.trim()} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-bold disabled:opacity-50">Add</button></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LINK & MENTION MODALS */}
      <AnimatePresence>
        {activeModal === "link" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1C1C1E] rounded-t-3xl p-6" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))" }}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-white font-bold text-lg">Add Link</h3><button onClick={() => setActiveModal(null)}><X className="text-white" /></button></div>
            <input autoFocus type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full bg-white/10 rounded-xl px-4 py-3 text-white outline-none mb-4" />
            <button onClick={() => { if(linkUrl) { addSticker("link", { url: linkUrl }); setLinkUrl(""); } }} disabled={!linkUrl.trim()} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">Add Link</button>
          </motion.div>
        )}
        {activeModal === "mention" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1C1C1E] rounded-t-3xl p-6" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))" }}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-white font-bold text-lg">Mention</h3><button onClick={() => setActiveModal(null)}><X className="text-white" /></button></div>
            <input autoFocus type="text" value={mentionQuery} onChange={e => setMentionQuery(e.target.value)} placeholder="@username" className="w-full bg-white/10 rounded-xl px-4 py-3 text-white outline-none mb-4" />
            <button onClick={() => { if(mentionQuery) { addSticker("mention", { username: mentionQuery.startsWith('@') ? mentionQuery : '@' + mentionQuery }); setMentionQuery(""); } }} disabled={!mentionQuery.trim()} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">Tag User</button>
          </motion.div>
        )}
        {activeModal === "tag" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-0 z-[60] bg-[#0B0B14] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-safe"><button onClick={() => setActiveModal(null)} className="p-2"><ArrowLeft className="text-white" size={24} /></button><h2 className="text-white font-bold text-lg">Tag people</h2><div className="w-8" /></div>
            <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 mt-4">{["Danny Kenthia", "Harerimana Jérôme", "Tësa Korbero", "Fidlich Fdc"].map((name, i) => <button key={i} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 text-left"><div className="w-11 h-11 rounded-full bg-gray-700" /><span className="text-white font-semibold text-[15px]">{name}</span></button>)}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EFFECTS MODAL */}
      <AnimatePresence>
        {activeModal === "effects" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1C1C1E] rounded-t-3xl p-6" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))" }}>
            <div className="flex justify-between items-center mb-6"><h3 className="text-white font-bold text-lg">Filters</h3><button onClick={() => setActiveModal(null)}><X className="text-white" /></button></div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f)} className="shrink-0 flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${filter.id === f.id ? "border-purple-500" : "border-transparent"}`}><img src={src} className="w-full h-full object-cover" style={{ filter: f.css }} /></div>
                  <span className={`text-xs ${filter.id === f.id ? "text-blue-400 font-bold" : "text-white/70"}`}>{f.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="absolute bottom-24 left-0 right-0 text-red-400 text-xs text-center">{error}</p>}
      {/* STICKER TRAY */}
      <AnimatePresence>
        {activeModal === "stickers" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1A1A1A] rounded-t-3xl flex flex-col pointer-events-auto" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))", maxHeight: "80dvh" }}>
            <div className="flex justify-between items-center px-4 pt-4 pb-2 border-b border-white/10"><h3 className="text-white font-bold text-lg">Stickers</h3><button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/10 grid place-items-center"><X size={18} className="text-white" /></button></div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex flex-wrap gap-2 mb-6 mt-4">
                {STICKER_PILLS.map(pill => (
                  <button key={pill.id} onClick={() => {
                      if (pill.id === "photo") pickPhotoSticker()
                      else if (pill.id === "location") addSticker("location", { city: "Bujumbura" })
                      else if (pill.id === "time") addSticker("time", { time: pill.label })
                      else if (pill.id === "poll") setActiveModal("poll")
                      else if (pill.id === "question") setActiveModal("question")
                      else if (pill.id === "tag") setActiveModal("tag")
                      else if (pill.id === "feelings") setActiveModal("feelings")
                      else if (pill.id === "avatar") { if(profile?.primary_photo) addSticker("avatar", null, publicPhotoUrl(profile.primary_photo)); setActiveModal(null) }
                      else if (pill.id === "gif") setActiveModal("gif")
                      else setActiveModal(pill.id)
                    }} className="relative flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 shadow-sm active:bg-white/10">
                    {pill.badge && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{pill.badge}</span>}
                    {pill.icon}<span className="text-white text-[13px] font-semibold">{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIF TRAY */}
      <AnimatePresence>
        {activeModal === "gif" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1C1C1E] rounded-t-3xl flex flex-col" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))", maxHeight: "80dvh" }}>
            <div className="flex justify-between items-center px-4 pt-4 pb-2 border-b border-white/10"><h3 className="text-white font-bold text-lg">GIFs</h3><button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/10 grid place-items-center"><X size={18} className="text-white" /></button></div>
            <div className="p-4"><div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2.5"><Search size={18} className="text-white/50" /><input type="text" placeholder="Search Tenor..." value={gifQuery} onChange={(e) => { setGifQuery(e.target.value); if(e.target.value.length > 2 || e.target.value === "") fetchGifs(e.target.value) }} className="flex-1 bg-transparent text-white outline-none" /></div></div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 grid grid-cols-2 gap-2">
              {gifLoading ? <p className="text-white/50 col-span-2 text-center py-4">Loading GIFs...</p> : gifs.map((url, i) => (
                <button key={i} onClick={() => { addSticker("image", null, url); setActiveModal(null); }} className="aspect-square bg-white/5 rounded-lg overflow-hidden border border-white/10 relative">
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FEELINGS MODAL */}
      <AnimatePresence>
        {activeModal === "feelings" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-0 z-[60] bg-[#0B0B14] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-safe"><button onClick={() => setActiveModal(null)} className="p-2"><ArrowLeft className="text-white" size={24} /></button><h2 className="text-white font-bold text-lg">How are you feeling?</h2><div className="w-8" /></div>
            <div className="flex-1 overflow-y-auto px-4 grid grid-cols-2 gap-2 pb-4">
              {FEELINGS_LIST.map((f, i) => (
                <button key={i} onClick={() => { addSticker("emoji", null, f.emoji); addSticker("text", { content: f.label, align: "center" }, f.label); setActiveModal(null); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 text-left">
                  <span className="text-3xl">{f.emoji}</span><span className="text-white font-semibold text-[15px]">{f.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MUSIC MODAL */}
      <AnimatePresence>
        {activeModal === "music" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1A1A1A] rounded-t-3xl flex flex-col" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))", maxHeight: "85dvh" }}>
            <div className="flex justify-between items-center px-4 pt-4 pb-2 border-b border-white/10"><h3 className="text-white font-bold text-lg">Add Music</h3><button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/10 grid place-items-center"><X size={18} className="text-white" /></button></div>
            <div className="p-4"><div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2.5"><Search size={18} className="text-white/50" /><input type="text" placeholder="Search music..." className="flex-1 bg-transparent text-white outline-none" /></div></div>
            <div className="flex-1 overflow-y-auto px-4"><p className="text-white/50 text-xs font-bold uppercase mb-3">For You</p>
              {[{title:"God's Plan", artist:"Drake"}, {title:"Blinding Lights", artist:"The Weeknd"}, {title:"Bizima", artist:"Ish Kevin"}, {title:"Slowly", artist:"pikoOo7"}].map((track, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-white/5">
                  <div className="w-10 h-10 bg-gray-700 rounded" />
                  <div className="flex-1"><p className="text-white font-bold text-sm">{track.title}</p><p className="text-white/50 text-xs">{track.artist}</p></div>
                  <button onClick={() => { setSelectedMusic(track); setActiveModal(null); }} className="w-8 h-8 bg-white rounded-full grid place-items-center"><Play size={14} className="text-black ml-0.5" /></button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {activeModal === "settings" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 inset-x-0 z-50 bg-[#1C1C1E] rounded-t-3xl p-6" style={{ paddingBottom: "max(24px, var(--safe-bottom, 8px))" }}>
            <div className="flex justify-between items-center mb-6"><h3 className="text-white font-bold text-lg">Story Settings</h3><button onClick={() => setActiveModal(null)}><X className="text-white" /></button></div>
            <p className="text-white/50 text-xs font-bold uppercase mb-3">Who can see this story?</p>
            <div className="flex flex-col gap-2">
              {[
                { id: "everyone", label: "Everyone", desc: "Anyone on Nakubonye" },
                { id: "matches", label: "Matches", desc: "Your mutual matches" },
                { id: "following", label: "Followers", desc: "People who follow you" },
                { id: "inner_circle", label: "Inner Circle", desc: "Your closest people" },
                { id: "private", label: "Only Me", desc: "Just you" },
              ].map(opt => (
                <button key={opt.id} onClick={() => setAudience(opt.id)} className={`flex items-center justify-between p-4 rounded-xl border ${audience === opt.id ? "border-purple-500 bg-purple-500/10" : "border-white/10 bg-white/5"}`}>
                  <div className="flex flex-col text-left">
                    <span className="text-white font-medium">{opt.label}</span>
                    <span className="text-white/50 text-xs mt-0.5">{opt.desc}</span>
                  </div>
                  {audience === opt.id && <div className="w-4 h-4 rounded-full bg-purple-500" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  )
}

function LayerView({ layer, isSelected, onSelect, onUpdate, onDelete }) {
  const { x, y, scale, rotation } = layer
  const bind = useGesture({ onDrag: ({ offset: [ox, oy] }) => { if (isSelected) onUpdate({ x: ox, y: oy }) }, onPinch: ({ offset: [s, a] }) => { if (isSelected) onUpdate({ scale: Math.max(0.2, Math.min(10, s)), rotation: a }) } }, { drag: { from: () => [x, y], filterTaps: true }, pinch: { from: () => [scale, rotation], scaleBounds: { min: 0.2, max: 10 } } })
  const style = { position: "absolute", left: "50%", top: "50%", transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotation}rad) scale(${scale})`, zIndex: isSelected ? 12 : 10, touchAction: "none", pointerEvents: "auto", cursor: "grab" }
  return (
    <div {...bind()} style={style} onPointerDown={(e) => { e.stopPropagation(); onSelect() }}>
      {isSelected && <div className="absolute -inset-3 border-2 border-dashed border-white/50 rounded-lg pointer-events-none"><button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-5 -right-5 w-7 h-7 bg-red-500 rounded-full grid place-items-center text-white pointer-events-auto shadow-lg active:scale-90 transition-transform"><Trash2 size={14} /></button></div>}
      {layer.type === "text" && (layer.hidden ? <div className="bg-white text-black px-6 py-3 rounded-full flex items-center gap-2 shadow-xl"><Eye size={20} /> <span className="font-bold">Thoughts</span></div> : <div className={`text-4xl whitespace-pre-wrap ${layer.style?.className || "text-white"}`} style={{ textAlign: layer.align || "center", minWidth: "100px" }}>{layer.content}</div>)}
      {layer.type === "emoji" && <div className="text-6xl drop-shadow-xl">{layer.content}</div>}
      {layer.type === "time" && <div className="flex items-center gap-1.5 bg-white text-black px-4 py-2 rounded-full shadow-lg"><Clock size={16} /><span className="font-bold text-sm whitespace-nowrap">{layer.data?.time}</span></div>}
      {layer.type === "location" && <div className="flex items-center gap-1.5 bg-white text-black px-4 py-2 rounded-full shadow-lg"><MapPin size={16} /><span className="font-bold text-sm whitespace-nowrap">{layer.data?.city}</span></div>}
      {layer.type === "mention" && <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full shadow-lg"><AtSign size={16} /><span className="font-bold text-sm whitespace-nowrap">{layer.data?.username}</span></div>}
      {layer.type === "link" && <div className="flex items-center gap-1.5 bg-white text-black px-4 py-2 rounded-full shadow-lg"><LinkIcon size={16} /><span className="font-bold text-sm whitespace-nowrap">Link</span></div>}
      {layer.type === "poll" && (<div className="bg-white rounded-2xl p-4 shadow-xl w-64 flex flex-col items-center"><p className="text-black font-bold text-sm mb-3 text-center">{layer.data?.question}</p><div className="flex w-full h-10 bg-gray-100 rounded-full overflow-hidden border border-gray-200"><div className="flex-1 border-r border-gray-200 grid place-items-center text-blue-500 font-bold text-sm">YES</div><div className="flex-1 grid place-items-center text-blue-500 font-bold text-sm">NO</div></div></div>)}
      {layer.type === "question" && (<div className="bg-white rounded-2xl p-4 shadow-xl w-64 flex flex-col items-center"><p className="text-gray-400 font-bold text-xs uppercase mb-2">{layer.data?.prompt}</p><div className="w-full bg-gray-100 rounded-xl p-3 text-center text-gray-400 text-xs">People can answer here.</div></div>)}
      {(layer.type === "image" || layer.type === "avatar") && <img src={layer.content} className="max-w-[200px] max-h-[200px] object-cover rounded-xl shadow-xl pointer-events-none" />}
    </div>
  )
}

function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center justify-end active:scale-90 transition-transform" title={label}>
      <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 shadow-lg grid place-items-center"><Icon size={24} className="text-white drop-shadow-md" /></div>
    </button>
  )
}

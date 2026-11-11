import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react"

const DrawingLayer = forwardRef(({ active, brushType, color, size }, ref) => {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight

    if (history.length === 0) {
      const ctx = canvas.getContext("2d")
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)])
      setHistoryIndex(0)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    clear: () => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      saveHistory()
    },
    undo: () => {
      if (historyIndex > 0) {
        const ctx = canvasRef.current.getContext("2d")
        ctx.putImageData(history[historyIndex - 1], 0, 0)
        setHistoryIndex(prev => prev - 1)
      }
    },
    redo: () => {
      if (historyIndex < history.length - 1) {
        const ctx = canvasRef.current.getContext("2d")
        ctx.putImageData(history[historyIndex + 1], 0, 0)
        setHistoryIndex(prev => prev + 1)
      }
    }
  }))

  function saveHistory() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(imageData)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  function startDrawing(e) {
    if (!active) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  function draw(e) {
    if (!isDrawing || !active) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = size

    if (brushType === "eraser") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.strokeStyle = "rgba(0,0,0,1)"
    } else {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = color
      ctx.globalAlpha = brushType === "highlighter" ? 0.4 : 1
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopDrawing() {
    if (!isDrawing) return
    setIsDrawing(false)
    saveHistory()
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-[8] ${active ? "pointer-events-auto" : "pointer-events-none"}`}
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={stopDrawing}
      onPointerLeave={stopDrawing}
    />
  )
})

export default DrawingLayer

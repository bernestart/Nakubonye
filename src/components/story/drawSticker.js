export function drawStickerToCanvas(ctx, layer, containerW, containerH, canvasW, canvasH, imgCache = {}) {
  if (!ctx || !layer || !containerW || !containerH || !canvasW || !canvasH) return

  const sx = canvasW / containerW
  const sy = canvasH / containerH
  const cx = (containerW / 2 + (layer.x || 0)) * sx
  const cy = (containerH / 2 + (layer.y || 0)) * sy
  const scale = layer.scale || 1
  const rotation = layer.rotation || 0

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotation)
  ctx.scale(scale * sx, scale * sy)

  if (layer.type === "text") {
    drawTextLayer(ctx, layer)
  } else if (layer.type === "location") {
    drawPill(ctx, "rgba(239,68,68,0.95)", `📍 ${layer.data?.city || ""}`)
  } else if (layer.type === "time") {
    drawPill(ctx, "rgba(0,0,0,0.7)", `🕒 ${layer.data?.time || ""}`)
  } else if (layer.type === "weather") {
    drawPill(ctx, "rgba(56,189,248,0.95)", `☀️ ${layer.data?.temp || ""}°C`)
  } else if (layer.type === "mention") {
    drawPill(ctx, "rgba(0,0,0,0.6)", `@ ${layer.data?.username || "friend"}`)
  } else if (layer.type === "link") {
    drawPill(ctx, "rgba(255,255,255,0.95)", `🔗 Link`)
  } else if (layer.type === "music") {
    drawMusicPill(ctx, layer.data)
  } else if (layer.type === "emoji") {
    ctx.font = "60px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#fff"
    ctx.fillText(layer.content || "😎", 0, 0)
  } else if (layer.type === "image" || layer.type === "avatar" || layer.type === "gif") {
    const img = imgCache[layer.src]
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -100, -100, 200, 200)
    }
  }

  ctx.restore()
}

function drawTextLayer(ctx, layer) {
  const isNeon = layer.style?.id === "neon"
  const isStrong = layer.style?.id === "strong"
  let fontStr = "bold 36px sans-serif"
  if (layer.style?.id === "typewriter") fontStr = "bold 32px monospace"
  if (isStrong) fontStr = "900 38px sans-serif"
  ctx.font = fontStr
  ctx.textAlign = layer.align || "center"
  
  if (layer.hidden) {
    ctx.font = "bold 24px sans-serif"
    const text = "👁️ Thoughts"
    const w = ctx.measureText(text).width + 40
    const h = 50
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, 25)
    else ctx.rect(-w/2, -h/2, w, h)
    ctx.fill()
    ctx.fillStyle = "#000000"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, 0, 2)
    return
  }

  const lines = (layer.content || "").split("\n")
  const lineHeight = 44
  const totalH = lines.length * lineHeight
  const startY = -totalH / 2 + lineHeight / 2

  if (isNeon) {
    ctx.fillStyle = "#67e8f9"
    ctx.shadowColor = "rgba(34,211,238,0.9)"
    ctx.shadowBlur = 16
  } else {
    ctx.fillStyle = "#ffffff"
    ctx.shadowColor = "rgba(0,0,0,0.6)"
    ctx.shadowBlur = 8
  }

  lines.forEach((line, i) => {
    ctx.fillText(line, 0, startY + i * lineHeight)
  })
}

function drawPill(ctx, bgColor, text) {
  ctx.font = "bold 14px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const w = ctx.measureText(text).width + 32
  const h = 30
  ctx.shadowColor = "rgba(0,0,0,0.35)"
  ctx.shadowBlur = 4
  ctx.fillStyle = bgColor
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, h/2)
  else ctx.rect(-w/2, -h/2, w, h)
  ctx.fill()
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.fillStyle = "#ffffff"
  ctx.fillText(text, 0, 1)
}

function drawMusicPill(ctx, data) {
  ctx.fillStyle = "rgba(0,0,0,0.7)"
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(-100, -25, 200, 50, 25)
  else ctx.rect(-100, -25, 200, 50)
  ctx.fill()
  ctx.fillStyle = "#1DB954"
  ctx.beginPath()
  ctx.arc(-70, 0, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = "bold 12px sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(data?.title || "Song", -45, -5)
  ctx.font = "10px sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.fillText(data?.artist || "Artist", -45, 10)
}

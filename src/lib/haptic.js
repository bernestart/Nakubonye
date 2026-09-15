export function tap(intensity = 'light') {
  if (typeof navigator === 'undefined') return
  if (!('vibrate' in navigator)) return
  try {
    if (intensity === 'light') navigator.vibrate(8)
    else if (intensity === 'medium') navigator.vibrate(15)
    else if (intensity === 'heavy') navigator.vibrate(30)
    else if (intensity === 'match') navigator.vibrate([20, 40, 20, 40, 60])
  } catch {}
}

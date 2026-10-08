import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export async function tap(intensity = 'light') {
  if (Capacitor.isNativePlatform()) {
    try {
      if (intensity === 'match') {
        await Haptics.impact({ style: ImpactStyle.Medium })
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 120)
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}), 260)
      } else {
        const style =
          intensity === 'heavy' ? ImpactStyle.Heavy :
          intensity === 'medium' ? ImpactStyle.Medium :
          ImpactStyle.Light
        await Haptics.impact({ style })
      }
      return
    } catch {}
  }
  if (typeof navigator === 'undefined') return
  if (!('vibrate' in navigator)) return
  try {
    if (intensity === 'light') navigator.vibrate(8)
    else if (intensity === 'medium') navigator.vibrate(15)
    else if (intensity === 'heavy') navigator.vibrate(30)
    else if (intensity === 'match') navigator.vibrate([20, 40, 20, 40, 60])
  } catch {}
}

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useSafeArea() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const isAndroid = Capacitor.getPlatform() === 'android';

    function probeEnv(side) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:0;' +
        'padding-top:env(safe-area-inset-' + side + ',0px);' +
        'visibility:hidden;pointer-events:none;';
      document.body.appendChild(el);
      const h = el.getBoundingClientRect().height;
      document.body.removeChild(el);
      return h;
    }

    const cs = getComputedStyle(root);
    const pluginTop = parseFloat(cs.getPropertyValue('--safe-area-inset-top')) || 0;
    const pluginBottom = parseFloat(cs.getPropertyValue('--safe-area-inset-bottom')) || 0;
    const envTop = probeEnv('top');
    const envBottom = probeEnv('bottom');

    // SystemBars (insetsHandling: 'css') writes --safe-area-inset-* on Android.
    // On older WebView (< 140), env() returns 0 but SystemBars still writes the correct value.
    // Priority: SystemBars plugin value > env() probe > platform fallback.
    const systemBarTop = parseFloat(cs.getPropertyValue('--safe-area-inset-top')) || 0;
    const systemBarBottom = parseFloat(cs.getPropertyValue('--safe-area-inset-bottom')) || 0;

    const safeTop = Math.max(systemBarTop, pluginTop, envTop, 0);
    const safeBottom = Math.max(systemBarBottom, pluginBottom, envBottom, isAndroid ? 8 : 0);

    root.style.setProperty('--safe-top', safeTop + 'px');
    root.style.setProperty('--safe-bottom', safeBottom + 'px');
    console.log('[useSafeArea]', { isAndroid, envTop, envBottom, pluginTop, pluginBottom, safeTop, safeBottom });
  }, []);
}

/**
 * Device Detection Utility
 *
 * Hard-detects mobile and tablet devices, specifically defeating "Desktop Mode"
 * or "Request Desktop Site" in mobile browsers (Chrome, Safari, Firefox, Edge, etc.).
 *
 * Checks include:
 * 1. WebGL UNMASKED_RENDERER_WEBGL (Mobile GPU hardware: Adreno, Mali, PowerVR, Apple GPU, etc.)
 * 2. Apple iOS desktop mode spoofing detection (platform === 'MacIntel' && maxTouchPoints > 1)
 * 3. Client Hints API (navigator.userAgentData.mobile)
 * 4. Input pointer classification (pointer: coarse vs fine, hover: none vs hover)
 * 5. Physical screen dimensions & mobile aspect ratios (cannot be spoofed by desktop mode)
 * 6. Standard User-Agent regex patterns
 * 7. Touch hardware & touch event presence
 */

export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. Direct User-Agent matching (Standard mobile browser mode)
  const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
  const mobileUaRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|silk|kindle|fennec|maemo|bb10|rim|touch/i;
  if (mobileUaRegex.test(ua)) {
    return true;
  }

  // 2. Client Hints API (Chromium browsers)
  // Even when "Desktop site" is toggled, userAgentData often still exposes mobile: true or Android platform
  const navAny = navigator as any;
  if (navAny.userAgentData) {
    if (navAny.userAgentData.mobile === true) {
      return true;
    }
    const platform = String(navAny.userAgentData.platform || '').toLowerCase();
    if (platform === 'android' || platform === 'ios') {
      return true;
    }
  }

  // 3. Apple iOS Desktop Mode Spoofing:
  // In iOS Safari / Chrome on iOS, "Desktop site" changes UA to "Macintosh; Intel Mac OS X 10_15_7"
  // and navigator.platform to "MacIntel".
  // However, physical Macs DO NOT HAVE TOUCHSCREENS (maxTouchPoints = 0).
  // Apple's official standard: iPad or iPhone in Desktop mode has:
  // (navigator.platform === 'MacIntel' || ua.includes('macintosh')) && navigator.maxTouchPoints > 1.
  if ((navigator.platform === 'MacIntel' || ua.includes('macintosh')) && navigator.maxTouchPoints > 1) {
    return true;
  }

  // 4. WebGL Hardware GPU Fingerprint (UN-SPOOFABLE BY MOBILE DESKTOP MODE):
  // When mobile browsers spoof the User-Agent and viewport, they CANNOT spoof the underlying
  // physical GPU chipset reported by the WebGL hardware driver.
  // Mobile chipsets strictly use Adreno (Snapdragon), Mali (ARM), PowerVR (Imagination),
  // Apple GPU (iPhone/iPad A-series/iOS), MediaTek Immortalis, or Samsung Xclipse.
  // Standard PC/Mac laptops and desktops use Intel, Nvidia, AMD, or Apple Silicon (Apple M1/M2/M3/M4).
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = String((gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        
        // Dedicated mobile GPU architectures:
        const mobileGpus = ['adreno', 'mali', 'powervr', 'immortalis', 'xclipse', 'vivante', 'sgx'];
        if (mobileGpus.some(gpu => renderer.includes(gpu))) {
          return true;
        }

        // Apple GPU on iOS devices (Macs report Apple M1/M2/M3 or Intel/AMD):
        if (renderer.includes('apple gpu')) {
          if (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) {
            return true;
          }
        }
      }
    }
  } catch {
    // Proceed with further checks if WebGL query encounters an issue
  }

  // 5. Input Pointer & Hover Capabilities:
  // Mobile devices with touchscreens (even in desktop mode) have coarse primary pointers and no native hover.
  // Desktop computers with mouse/trackpad have fine pointer and native hover.
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const isFine = window.matchMedia('(pointer: fine)').matches;
  const hasNoHover = window.matchMedia('(hover: none)').matches;
  const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);

  // If the device has ONLY a coarse pointer (touch) and no fine pointer (mouse/trackpad):
  if (isCoarse && !isFine) {
    return true;
  }

  // If the device has no hover capability and has physical touch hardware:
  if (hasNoHover && hasTouch) {
    return true;
  }

  // 6. Physical Screen Dimensions (Cannot be spoofed by Desktop Mode):
  // When Desktop Mode is toggled in Chrome Android, window.innerWidth is artificially scaled to 980px+,
  // but window.screen.width and window.screen.height represent the physical screen resolution.
  // Smartphone short-edge dimension is typically between 320px and 480px.
  // Tablets are up to 800px.
  const screenMin = Math.min(window.screen.width, window.screen.height);
  const screenMax = Math.max(window.screen.width, window.screen.height);

  // Any device where the minimum screen dimension is <= 500px and has touch is a mobile smartphone:
  if (screenMin <= 500 && hasTouch) {
    return true;
  }

  // Any device where the minimum screen dimension is <= 768px with coarse pointer or touch:
  if (screenMin <= 768 && (isCoarse || hasTouch)) {
    return true;
  }

  // Extreme smartphone aspect ratio (e.g. 19.5:9, 20:9 -> ratio >= 1.85) with touch:
  const aspectRatio = screenMax / (screenMin || 1);
  if (aspectRatio >= 1.85 && hasTouch) {
    return true;
  }

  // 7. Orientation check:
  // If the device is currently in portrait orientation with touch and physical short edge < 900px:
  const isPortrait = window.matchMedia('(orientation: portrait)').matches ||
    (window.screen.orientation && window.screen.orientation.type.includes('portrait')) ||
    (window.innerHeight > window.innerWidth);

  if (isPortrait && screenMin < 900 && hasTouch) {
    return true;
  }

  return false;
}

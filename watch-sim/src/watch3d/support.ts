export type WatchView = '2d' | '3d'
/** `software` means WebGL only runs with a major performance caveat, e.g. SwiftShader. */
export type WebglSupport = 'none' | 'software' | 'ok'

/**
 * `?view=2d` always wins. `?view=3d` forces the scene wherever WebGL exists at all.
 * Otherwise the 3D watch needs fast WebGL and no reduced-motion preference.
 */
export function chooseView(search: string, env: { reducedMotion: boolean; webgl: WebglSupport }): WatchView {
  const asked = new URLSearchParams(search).get('view')
  if (asked === '2d' || env.webgl === 'none') return '2d'
  if (asked === '3d') return '3d'
  if (env.reducedMotion || env.webgl === 'software') return '2d'
  return '3d'
}

function release(gl: WebGLRenderingContext | null): boolean {
  if (!gl) return false
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return true
}

function context(options?: WebGLContextAttributes): WebGLRenderingContext | null {
  const canvas = document.createElement('canvas')
  return canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)
}

export function probeWebgl(): WebglSupport {
  try {
    if (release(context({ failIfMajorPerformanceCaveat: true }))) return 'ok'
    if (release(context())) return 'software'
    return 'none'
  } catch {
    return 'none'
  }
}

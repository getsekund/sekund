import { describe, expect, it } from 'vitest'
import { chooseView } from './support'

const ok = { reducedMotion: false, webgl: 'ok' } as const

describe('chooseView', () => {
  it('uses the 3D watch when WebGL is fast and motion is allowed', () => {
    expect(chooseView('', ok)).toBe('3d')
    expect(chooseView('?room=sekund-demo', ok)).toBe('3d')
  })

  it('keeps the 2D watch for ?view=2d', () => {
    expect(chooseView('?room=sekund-demo&view=2d', ok)).toBe('2d')
  })

  it('keeps the 2D watch without WebGL, even when 3D is asked for', () => {
    expect(chooseView('', { ...ok, webgl: 'none' })).toBe('2d')
    expect(chooseView('?view=3d', { ...ok, webgl: 'none' })).toBe('2d')
  })

  it('keeps the 2D watch for reduced motion and software WebGL unless 3D is asked for', () => {
    expect(chooseView('', { ...ok, reducedMotion: true })).toBe('2d')
    expect(chooseView('', { ...ok, webgl: 'software' })).toBe('2d')
    expect(chooseView('?view=3d', { reducedMotion: true, webgl: 'software' })).toBe('3d')
  })
})

export type Button = 'A' | 'B' | 'C' | 'D'
/** Sorted, unique set of buttons pressed together. */
export type Gesture = readonly Button[]

export const BUTTONS: readonly Button[] = ['A', 'B', 'C', 'D']

export function gesture(...buttons: Button[]): Gesture {
  return [...new Set(buttons)].sort()
}

export function sameGesture(a: Gesture, b: Gesture): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Turns press/release streams into gestures. A gesture fires when the last
 * held button is released and contains every button pressed since the first
 * press, so C then D held together yields C+D. Latched buttons (shift-click)
 * count as held until the next gesture fires, which makes chords possible
 * with a single mouse pointer.
 */
export class GestureRecognizer {
  private held = new Set<Button>()
  private latched = new Set<Button>()
  private current = new Set<Button>()
  private readonly onGesture: (g: Gesture) => void
  private readonly onChange: () => void

  constructor(onGesture: (g: Gesture) => void, onChange: () => void = () => {}) {
    this.onGesture = onGesture
    this.onChange = onChange
  }

  get pressed(): ReadonlySet<Button> {
    return this.held
  }

  isLatched(b: Button): boolean {
    return this.latched.has(b)
  }

  press(b: Button): void {
    if (this.held.has(b)) return
    this.held.add(b)
    this.current.add(b)
    this.onChange()
  }

  release(b: Button): void {
    if (!this.held.has(b) || this.latched.has(b)) return
    this.held.delete(b)
    if ([...this.held].every((h) => this.latched.has(h))) this.fire()
    else this.onChange()
  }

  latch(b: Button): void {
    if (this.latched.has(b)) {
      this.latched.delete(b)
      this.held.delete(b)
      this.current.delete(b)
    } else {
      this.latched.add(b)
      this.held.add(b)
      this.current.add(b)
    }
    this.onChange()
  }

  cancel(): void {
    this.held.clear()
    this.latched.clear()
    this.current.clear()
    this.onChange()
  }

  private fire(): void {
    const g = gesture(...this.current)
    this.held.clear()
    this.latched.clear()
    this.current.clear()
    this.onChange()
    if (g.length > 0) this.onGesture(g)
  }
}

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { COMPANION_PORT, type TransportState } from '@sekund/protocol'
import { DotLoader } from '@/components/dot-loader'
import { ThemeControl, ThemeRoot } from '@/components/theme-chrome'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { renderFace } from '@/face/screens'
import { Watch } from '@/face/Watch'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/face/wordmark'
import { type Control, controlsFor, pinProgress, POSITION, stepActions, stepHint } from '@/hints'
import type { Button as Pusher } from '@/machine/gestures'
import type { LogEntry } from '@/machine/log'
import { secondsLeft } from '@/machine/machine'
import { bootWatch, controller, identity, relayUrl, startSecureElement, transport } from '@/services'
import { cn } from '@/lib/utils'
import { KEYS, useWatch } from '@/useWatch'

const COMPANION_URL = `http://127.0.0.1:${COMPANION_PORT}`
const PUSHER_LABELS: Record<Pusher, string> = {
  A: 'Button A, previous',
  B: 'Button B, next',
  C: 'Button C, back',
  D: 'Button D, select',
}
/** Mobile shows the legend as a 2 × 2 grid in the pushers' physical layout. */
const MOBILE_ORDER: Record<Control, string> = {
  A: 'order-1',
  C: 'order-2',
  B: 'order-3',
  D: 'order-4',
  'C+D': 'order-5 col-span-2 lg:col-span-1',
}

function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', fn)
      return () => m.removeEventListener('change', fn)
    },
    () => window.matchMedia(query).matches,
  )
}

function useLink(): { state: TransportState; peer: boolean } {
  const state = useSyncExternalStore(
    (fn) => (transport ? transport.onState(fn) : () => {}),
    () => transport?.state ?? 'closed',
  )
  const peer = useSyncExternalStore(
    (fn) => (transport ? transport.onPeer(() => fn()) : () => {}),
    () => transport?.peerConnected ?? false,
  )
  return { state, peer }
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-(--sk-chip-h) items-center justify-between gap-3">
        <h2 className="text-24 font-semibold leading-snug">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <code className={cn('font-mono tabular', className)}>{children}</code>
}

const clock = (at: number) => new Date(at).toTimeString().slice(0, 8)
const grouped = (address: string) => address.match(/.{1,4}/g)?.join(' ') ?? address

function Legend({ controls, normal }: { controls: Record<Control, string | null>; normal: boolean }) {
  const rows: { id: Control; key: string; caps: string[] }[] = [
    { id: 'A', key: KEYS.A, caps: ['A'] },
    { id: 'B', key: KEYS.B, caps: ['B'] },
    { id: 'C', key: KEYS.C, caps: ['C'] },
    { id: 'D', key: KEYS.D, caps: ['D'] },
    { id: 'C+D', key: 'Space', caps: ['C', 'D'] },
  ]
  return (
    <Section title="Buttons">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-1 lg:gap-y-2">
        {rows.map((r) => {
          const action = controls[r.id]
          return (
            <li key={r.id} className={cn('flex items-start gap-3 text-sm lg:order-none', MOBILE_ORDER[r.id])}>
              <span className="flex shrink-0 items-center gap-1 pt-0.5">
                {r.caps.map((c, i) => (
                  <span key={c} className="flex items-center gap-1">
                    {i > 0 && <span className="text-graphite">+</span>}
                    <span className="sk-keycap">{c}</span>
                  </span>
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-14 text-graphite">{POSITION[r.id]}</span>
                <span className={cn('block text-16', action ? 'text-ink' : 'text-graphite')}>{action ?? 'Not used'}</span>
                <span className="hidden font-mono text-12 text-graphite lg:block">{r.key}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-graphite">
        {normal
          ? 'The face shows the time until you hold upper left (A) and lower right (D).'
          : 'Click a pusher, or use the key on a wide screen. W toggles the wrist.'}
      </p>
    </Section>
  )
}

function linkCopy(relayUp: boolean, peer: boolean) {
  if (!relayUp) {
    return (
      <>
        The local relay stands in for Bluetooth. Run <Mono className="text-ink">pnpm relay</Mono>. The watch connects to{' '}
        <Mono className="text-ink">{relayUrl}</Mono> on its own.
      </>
    )
  }
  if (peer) return 'The companion is connected. Its requests appear on the watch once Secure Mode is unlocked.'
  return (
    <>
      Relay running. Open the companion at{' '}
      <a className="text-ink underline underline-offset-4" href={COMPANION_URL}>
        {COMPANION_URL.replace('http://', '')}
      </a>{' '}
      to send a transfer.
    </>
  )
}

function ResetSimulator() {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button variant="destructive" className="self-start" onClick={() => setConfirming(true)}>
        Reset simulator
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-3 border-l-2 border-spot pl-3">
      <p className="text-sm">
        <span className="font-semibold">The key is already erased.</span> Reset returns the watch to first-use setup with a
        new PIN and a new key.
      </p>
      <div className="flex gap-3">
        <Button
          variant="destructive"
          onClick={() => {
            controller?.reset()
            setConfirming(false)
          }}
        >
          Reset
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function EventLog({ entries }: { entries: readonly LogEntry[] }) {
  return (
    <Section title="Event log">
      {entries.length === 0 ? (
        <p className="text-sm text-graphite">Nothing yet. Events appear here newest first.</p>
      ) : (
        <ol className="flex max-h-72 flex-col overflow-y-auto font-mono text-sm tabular">
          {entries.map((e, i) => {
            const prev = entries[i - 1]
            const newGroup = prev !== undefined && (prev.requestId ?? '') !== (e.requestId ?? '')
            return (
              <li key={e.id} className={cn('flex gap-4 py-0.5', newGroup && 'mt-1.5 border-t border-rule pt-2')}>
                <span className="shrink-0 text-graphite">{clock(e.at)}</span>
                <span>{e.text}</span>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}

function Wordmark({ className }: { className?: string }) {
  return (
    <svg className={cn('w-24 fill-ink', className)} viewBox={WORDMARK_VIEWBOX} role="img" aria-label="SEKUND">
      <path d={WORDMARK_PATH} />
    </svg>
  )
}

function AlreadyOpen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-(--sk-margin) text-center">
      <Wordmark />
      <h1 className="text-32 font-semibold leading-tight tracking-display">Watch already open</h1>
      <p className="max-w-[42ch] text-16 text-graphite">
        Another tab in this browser owns the watch, the simulated secure element, and the relay seat. Close it, or use that tab.
      </p>
      <p className="font-mono text-14 text-graphite">Room {identity.roomId}</p>
    </div>
  )
}

function ActiveWatch() {
  const watch = useWatch(controller!)
  const { state } = watch
  const reducedMotion = useReducedMotion()
  const face = useMemo(() => renderFace(state, { reducedMotion }), [state, reducedMotion])
  const controls = controlsFor(state)
  const hint = stepHint(state)
  const progress = pinProgress(state)
  const actions = stepActions(state)
  const log = useSyncExternalStore(controller!.subscribe, controller!.getLog)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    startSecureElement().catch((err: unknown) => setBootError(err instanceof Error ? err.message : String(err)))
  }, [])

  const wiped = state.screen.kind === 'wiped'
  const pending = state.request ? secondsLeft(state) : null
  const link = useLink()
  const relayUp = link.state === 'open'

  return (
    <div className="min-h-dvh">
      <nav className="border-b border-rule">
        <div className="mx-auto flex min-h-(--sk-nav-h) max-w-(--sk-content-max) flex-wrap items-center justify-between gap-x-4 gap-y-2 px-(--sk-margin) py-2">
          <span className="sk-plate">
            <Wordmark />
          </span>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a href="/" aria-current="page" className="sk-plate font-semibold underline underline-offset-4">
              Simulator
            </a>
            <a href={COMPANION_URL} className="sk-plate hover:underline hover:underline-offset-4">
              Companion
            </a>
            <ThemeControl />
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-(--sk-content-max) grid-cols-1 gap-(--sk-gutter) px-(--sk-margin) py-6 lg:grid-cols-12 lg:items-start">
        <div className="order-1 flex flex-col gap-3 lg:sticky lg:top-6 lg:col-span-7">
          <div className="sk-bench flex justify-center rounded-sm bg-paper-2 px-4 py-6 md:px-12 md:py-8">
            <Watch
              face={face}
              pressed={watch.pressed}
              labels={PUSHER_LABELS}
              onPress={watch.onPress}
              onRelease={watch.onRelease}
            />
          </div>
          <p className="sr-only" aria-live="polite">
            {face.spoken}
          </p>
          <p className="sk-plate bg-paper text-14 text-graphite">The secure element in this simulator is software. The signatures are real.</p>
        </div>

        <div className="order-2 flex flex-col gap-8 lg:col-span-5">
          <div className="flex flex-col gap-3">
            <header className="flex flex-col gap-2">
              <h1 className="text-32 font-semibold leading-tight tracking-display">Watch simulator</h1>
              <p className="text-16 text-graphite">Solana devnet. Requests come from the companion. Approval happens only here.</p>
            </header>
            {hint && (
              <p className="bg-paper text-16 text-ink" data-testid="step-hint" aria-live="polite">
                {hint}
              </p>
            )}
            {progress && (
              <div className="sk-plate bg-paper" data-testid="pin-readout">
                <p className="font-mono text-32 leading-tight tabular text-ink">{progress.pattern}</p>
                <p className="text-14 text-graphite">{progress.line}</p>
              </div>
            )}
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-3 md:hidden">
                {actions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.tone === 'primary' ? 'default' : 'secondary'}
                    onClick={() => watch.chord(...action.buttons)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Legend controls={controls} normal={state.screen.kind === 'normal'} />
          {bootError && (
            <p className="border-l-2 border-spot pl-3 text-sm text-spot">
              <span className="font-semibold">The simulated secure element did not start.</span> {bootError}. Use a browser
              with WebCrypto Ed25519 and IndexedDB (Chrome 137+, Firefox, Safari), then reload.
            </p>
          )}

          <Section title="Wrist">
            <label className="flex min-h-(--sk-control-h) cursor-pointer items-center justify-between gap-4">
              <span className="flex flex-col">
                <span className="text-sm font-medium">On wrist</span>
                <span className="text-sm text-graphite">Off ends the session</span>
              </span>
              <Switch checked={state.onWrist} onCheckedChange={(on) => controller?.setWrist(on)} />
            </label>
          </Section>

          <Section
            title="This session"
            aside={
              wiped ? (
                <Badge variant="stop">LOCKED</Badge>
              ) : pending !== null ? (
                <Badge variant="waiting">WAITING</Badge>
              ) : link.peer ? (
                <Badge variant="ink">CONNECTED</Badge>
              ) : null
            }
          >
            <p className="text-14 text-graphite">{linkCopy(relayUp, link.peer)}</p>
            {state.address && (
              <div className="bg-paper">
                <p className="text-14 text-graphite">Address</p>
                <p className="font-mono text-16 leading-body break-words">{grouped(state.address)}</p>
              </div>
            )}
            <dl>
              {(
                [
                  { label: 'PIN tries', value: state.hasPin ? `${state.attemptsLeft} left` : 'No PIN yet' },
                  { label: 'Request', value: pending === null ? 'None' : `${pending} s left` },
                ]
              ).map((row) => (
                <div key={row.label} className="grid grid-cols-[var(--sk-dt-width)_1fr] gap-3 border-t border-rule py-2 text-14">
                  <dt className="text-graphite">{row.label}</dt>
                  <dd className="font-mono tabular">{row.value}</dd>
                </div>
              ))}
            </dl>
            {state.ready && !state.hasPin && !wiped && (
              <p className="text-14 text-graphite">
                First use. Hold upper left (A) and lower right (D), choose a four-digit PIN, then enter it again. The secure
                element creates a devnet key that stays in this browser.
              </p>
            )}
            {wiped && <ResetSimulator />}
          </Section>

          <EventLog entries={log} />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [boot, setBoot] = useState<'loading' | 'active' | 'blocked'>('loading')
  useEffect(() => {
    void bootWatch().then((r) => setBoot(r.kind))
  }, [])
  let screen
  if (boot === 'loading') {
    screen = (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-(--sk-margin)">
        <Wordmark />
        <p className="flex items-center gap-3 text-16 text-graphite">
          <DotLoader />
          Starting the watch.
        </p>
      </div>
    )
  } else if (boot === 'blocked') {
    screen = <AlreadyOpen />
  } else {
    screen = <ActiveWatch />
  }
  return (
    <ThemeRoot>{screen}</ThemeRoot>
  )
}

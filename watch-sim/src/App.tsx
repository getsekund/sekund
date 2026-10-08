import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { COMPANION_PORT, type TransportState } from '@sekund/protocol'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { renderFace } from '@/face/screens'
import { Watch } from '@/face/Watch'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/face/wordmark'
import { type Control, controlsFor } from '@/hints'
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
        <h2 className="text-base font-semibold">{title}</h2>
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
            <li key={r.id} className={cn('flex items-center gap-3 text-sm lg:order-none', MOBILE_ORDER[r.id])}>
              <span className="flex w-14 shrink-0 items-center gap-1">
                {r.caps.map((c, i) => (
                  <span key={c} className="flex items-center gap-1">
                    {i > 0 && <span className="text-graphite">+</span>}
                    <span className="sk-keycap">{c}</span>
                  </span>
                ))}
              </span>
              <span className="hidden w-12 shrink-0 font-mono text-xs text-graphite lg:inline">{r.key}</span>
              <span className={action ? 'text-ink' : 'text-graphite'}>{action ?? 'Not used'}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-graphite">
        {normal
          ? 'Normal shows only the time. Secure Mode opens with a hidden combination: hold A and D together.'
          : 'Click the pushers or use the keys. Hold two keys for a combination; shift-click holds a pusher. W toggles the wrist.'}
      </p>
    </Section>
  )
}

function CompanionLink() {
  const link = useLink()
  const relayUp = link.state === 'open'
  return (
    <Section
      title="Companion link"
      aside={
        <Badge variant={link.peer ? 'ink' : 'idle'}>{!relayUp ? 'No relay' : link.peer ? 'Connected' : 'No app'}</Badge>
      }
    >
      <p className="text-sm text-graphite">
        {!relayUp ? (
          <>
            The local relay stands in for Bluetooth. Run <Mono className="text-ink">pnpm relay</Mono>; the watch connects to{' '}
            <Mono className="text-ink">{relayUrl}</Mono> on its own.
          </>
        ) : link.peer ? (
          'The companion is connected. Its requests appear on the watch once Secure Mode is unlocked.'
        ) : (
          <>
            Relay running. Open the companion at{' '}
            <a className="text-ink underline underline-offset-4" href={COMPANION_URL}>
              {COMPANION_URL.replace('http://', '')}
            </a>{' '}
            to send a transfer.
          </>
        )}
      </p>
    </Section>
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

function AlreadyOpen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-(--sk-margin) text-center">
      <svg className="w-24 fill-ink" viewBox={WORDMARK_VIEWBOX} role="img" aria-label="SEKUND">
        <path d={WORDMARK_PATH} />
      </svg>
      <h1 className="font-mono text-20 tracking-caps">WATCH ALREADY OPEN</h1>
      <p className="max-w-[40ch] text-16 text-graphite">
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
  const log = useSyncExternalStore(controller!.subscribe, controller!.getLog)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    startSecureElement().catch((err: unknown) => setBootError(err instanceof Error ? err.message : String(err)))
  }, [])

  const wiped = state.screen.kind === 'wiped'
  const pending = state.request ? secondsLeft(state) : null

  return (
    <div className="min-h-dvh">
      <nav className="border-b border-rule">
        <div className="mx-auto flex h-(--sk-nav-h) max-w-(--sk-content-max) items-center justify-between px-(--sk-margin)">
          <svg className="w-24 fill-ink" viewBox={WORDMARK_VIEWBOX} role="img" aria-label="SEKUND">
            <path d={WORDMARK_PATH} />
          </svg>
          <div className="flex gap-6 text-sm">
            <a href="/" aria-current="page" className="font-semibold underline underline-offset-4">
              Simulator
            </a>
            <a href={COMPANION_URL} className="hover:underline hover:underline-offset-4">
              Companion
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-(--sk-content-max) grid-cols-1 gap-(--sk-gutter) px-(--sk-margin) py-6 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:col-span-7">
          <div className="flex justify-center rounded-sm bg-paper-2 px-4 py-6 md:px-12 md:py-8">
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
          <div className="flex flex-wrap gap-3 md:hidden">
            <Button variant="secondary" size="sm" onClick={() => watch.chord('C', 'D')}>
              Press C + D
            </Button>
            <Button variant="secondary" size="sm" onClick={() => watch.chord('A', 'D')}>
              Press A + D
            </Button>
          </div>
          <p className="text-sm text-graphite">The secure element in this simulator is software. The signatures are real.</p>
        </div>

        <div className="flex flex-col gap-8 lg:col-span-5">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">Watch simulator</h1>
            <p className="text-sm text-graphite">Solana devnet. Requests come from the companion; approval happens only here.</p>
          </header>

          {bootError && (
            <p className="border-l-2 border-spot pl-3 text-sm text-spot">
              <span className="font-semibold">The simulated secure element did not start.</span> {bootError}. Use a browser
              with WebCrypto Ed25519 and IndexedDB (Chrome 137+, Firefox, Safari), then reload.
            </p>
          )}

          <Legend controls={controls} normal={state.screen.kind === 'normal'} />

          <Section title="Wrist">
            <label className="flex min-h-(--sk-control-h) cursor-pointer items-center justify-between gap-4">
              <span className="flex flex-col">
                <span className="text-sm font-medium">On wrist</span>
                <span className="text-sm text-graphite">Off ends the session</span>
              </span>
              <Switch checked={state.onWrist} onCheckedChange={(on) => controller?.setWrist(on)} />
            </label>
          </Section>

          <CompanionLink />

          <Section title="Room">
            <p className="text-sm text-graphite">
              Demo room <Mono className="text-ink">{identity.roomId}</Mono>. The companion must use the same{' '}
              <Mono className="text-ink">?room=</Mono> value. Override with the query string; default is sekund-demo.
            </p>
          </Section>

          <Section
            title="Secure element"
            aside={wiped ? <Badge variant="stop">Locked</Badge> : pending !== null ? <Badge variant="waiting">Waiting</Badge> : null}
          >
            <dl className="grid grid-cols-[var(--sk-dt-width)_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-graphite">Profile</dt>
              <dd>{state.profile ? `${state.profile}, simulated` : 'Starting'}</dd>
              <dt className="text-graphite">Wallet</dt>
              <dd>{!state.ready ? 'Starting' : wiped ? 'Key erased' : state.address ? 'Key present' : 'Not set up'}</dd>
              <dt className="text-graphite">Session</dt>
              <dd>{state.session ? 'Open' : 'Closed'}</dd>
              <dt className="text-graphite">PIN tries</dt>
              <dd className="font-mono tabular">{state.hasPin ? `${state.attemptsLeft} left` : 'No PIN set'}</dd>
              <dt className="text-graphite">Max size</dt>
              <dd className="font-mono tabular">{state.maxMessageBytes ? `${state.maxMessageBytes} bytes` : 'Starting'}</dd>
              <dt className="text-graphite">Request</dt>
              <dd className="font-mono tabular">{pending === null ? 'None' : `${pending} s left on the watch`}</dd>
              {state.address && (
                <>
                  <dt className="text-graphite">Address</dt>
                  <dd className="font-mono break-words">{grouped(state.address)}</dd>
                </>
              )}
            </dl>
            {state.ready && !state.hasPin && !wiped && (
              <p className="text-sm text-graphite">
                First use. Hold A and D, choose a four-digit PIN, then enter it again to confirm. The secure
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
  if (boot === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-14 text-graphite">Starting the watch…</div>
    )
  }
  if (boot === 'blocked') return <AlreadyOpen />
  return <ActiveWatch />
}

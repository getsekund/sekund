import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { COMPANION_PORT, type TransportState } from '@sekund/protocol'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { renderFace } from '@/face/screens'
import { Watch } from '@/face/Watch'
import { hintsFor } from '@/hints'
import { secondsLeft } from '@/machine/machine'
import { controller, relayUrl, startSecureElement, transport } from '@/services'
import { KEY_FOR, useWatch } from '@/useWatch'

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border px-1 font-mono text-xs text-foreground">
      {children}
    </kbd>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-foreground">{children}</code>
}

function useLink(): { state: TransportState; peer: boolean } {
  const state = useSyncExternalStore(
    (fn) => transport.onState(fn),
    () => transport.state,
  )
  const peer = useSyncExternalStore(
    (fn) => transport.onPeer(fn),
    () => transport.peerConnected,
  )
  return { state, peer }
}

function CompanionLink() {
  const link = useLink()
  const relayUp = link.state === 'open'
  const badge = !relayUp ? 'Relay offline' : link.peer ? 'Paired' : 'Waiting'
  return (
    <Section
      title="Companion link"
      aside={
        <Badge variant="outline" className={link.peer ? 'text-sk-ok' : relayUp ? '' : 'text-sk-warn'}>
          {badge}
        </Badge>
      }
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        {relayUp ? (
          link.peer ? (
            <>The companion is connected. Sign requests appear on the watch once Secure Mode is unlocked.</>
          ) : (
            <>
              Connected to the local relay. Open the companion on port <Code>{COMPANION_PORT}</Code> to pair.
            </>
          )
        ) : (
          <>
            Stands in for Bluetooth. Run <Code>pnpm relay</Code> in the repo; the watch reconnects to{' '}
            <Code>{relayUrl}</Code> on its own.
          </>
        )}
      </p>
    </Section>
  )
}

export default function App() {
  const watch = useWatch(controller)
  const { state } = watch
  const face = useMemo(() => renderFace(state), [state])
  const hints = hintsFor(state)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    startSecureElement().catch((err: unknown) => setBootError(err instanceof Error ? err.message : String(err)))
  }, [])

  const se = controller.secureElement
  const wiped = state.screen.kind === 'wiped'
  const wallet = !state.ready ? 'Starting…' : wiped ? 'Key wiped' : state.address ? 'Ready' : 'Not set up'
  const pending = state.request ? secondsLeft(state) : null

  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-12 lg:py-10">
        <div className="flex w-full flex-1 flex-col items-center gap-3 lg:sticky lg:top-10">
          <Watch
            face={face}
            pressed={watch.pressed}
            keyFor={KEY_FOR}
            onPress={watch.onPress}
            onRelease={watch.onRelease}
          />
          <div className="flex gap-2 lg:hidden">
            <Button variant="outline" size="sm" onClick={() => watch.chord('C', 'D')}>
              Press C + D
            </Button>
            <Button variant="outline" size="sm" onClick={() => watch.chord('A', 'D')}>
              Press A + D
            </Button>
          </div>
        </div>

        <aside className="flex w-full max-w-(--sk-panel-width) flex-col gap-6 rounded-lg border border-border bg-card p-5">
          <header className="flex flex-col gap-1">
            <h1 className="text-base font-semibold">Watch simulator</h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Solana devnet proof of concept. The secure element is simulated in software; the hardware is the
              roadmap.
            </p>
          </header>

          {bootError && (
            <p className="rounded-md border border-sk-danger/40 p-3 text-xs text-sk-danger">
              The simulated secure element could not start: {bootError}. This browser may lack WebCrypto Ed25519
              (Chrome 137+, Firefox, Safari) or IndexedDB.
            </p>
          )}

          <Section title="Wrist">
            <label className="flex items-center justify-between gap-4">
              <span className="flex flex-col">
                <span className="text-sm">{state.onWrist ? 'On wrist' : 'Off wrist'}</span>
                <span className="text-xs text-muted-foreground">Taking the watch off ends the session.</span>
              </span>
              <Switch checked={state.onWrist} onCheckedChange={(on) => controller.setWrist(on)} />
            </label>
          </Section>

          <Separator />

          <Section title="Buttons">
            <ul className="flex min-h-21 flex-col gap-2 text-sm">
              {hints.map((h) => (
                <li key={h.keys + h.action} className="flex items-center justify-between gap-3">
                  <span className="flex gap-1">
                    {h.keys.split(/\s*([+/])\s*/).map((part, i) =>
                      part === '+' || part === '/' ? (
                        <span key={i} className="text-sk-faint">
                          {part}
                        </span>
                      ) : (
                        <Kbd key={i}>{part}</Kbd>
                      ),
                    )}
                  </span>
                  <span className="text-right text-muted-foreground">{h.action}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-sk-faint">
              Keys <Kbd>A</Kbd> <Kbd>B</Kbd> <Kbd>C</Kbd> <Kbd>D</Kbd> press the buttons; hold two together for a
              combination. Shift-click holds a button. <Kbd>W</Kbd> toggles the wrist.
            </p>
          </Section>

          <Separator />

          <CompanionLink />

          <Separator />

          <Section title="Secure element" aside={<Badge variant="outline">{se?.profile ?? 'TROPIC01'} · simulated</Badge>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Wallet</dt>
              <dd className={wiped ? 'text-sk-danger' : ''}>{wallet}</dd>
              <dt className="text-muted-foreground">Session</dt>
              <dd>{state.session ? 'Open' : 'Closed'}</dd>
              <dt className="text-muted-foreground">PIN tries left</dt>
              <dd>{state.hasPin ? state.attemptsLeft : '—'}</dd>
              <dt className="text-muted-foreground">Max message</dt>
              <dd>{se ? `${se.maxMessageBytes} bytes` : '—'}</dd>
              <dt className="text-muted-foreground">Request</dt>
              <dd>{pending === null ? 'None' : `${pending} s left`}</dd>
            </dl>
            {state.address && <p className="font-mono text-xs break-all text-muted-foreground">{state.address}</p>}
            {state.ready && !state.hasPin && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {wiped ? 'The key was wiped after 3 wrong PINs. ' : 'First use. '}
                Press <Kbd>A</Kbd> + <Kbd>D</Kbd> on the watch and choose a 4-digit PIN to create a new devnet key. It
                stays in this browser (Web Worker + IndexedDB) and never leaves the simulated chip.
              </p>
            )}
          </Section>
        </aside>
      </main>
    </div>
  )
}

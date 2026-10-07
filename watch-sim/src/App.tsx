import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { STUB_DEMO_PIN } from '@/adapters/stubSecureElement'
import type { StubRequestKind } from '@/adapters/stubTransport'
import { renderFace } from '@/face/screens'
import { Watch } from '@/face/Watch'
import { hintsFor } from '@/hints'
import { secondsLeft } from '@/machine/machine'
import { controller, secureElement, transport } from '@/services'
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

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'text-sk-ok',
  REJECTED: 'text-sk-warn',
  EXPIRED: 'text-sk-warn',
  TOO_LARGE: 'text-sk-danger',
  UNSUPPORTED: 'text-sk-danger',
  LOCKED: 'text-sk-danger',
  SENT: 'text-muted-foreground',
}

const KIND_LABEL: Record<StubRequestKind, string> = {
  transfer: 'Transfer 0.01 SOL',
  'short-expiry': 'Transfer, 12 s expiry',
  oversize: 'Oversize message',
  nonce: 'Durable nonce',
  replay: 'Replay last request',
}

function StubCompanion() {
  const log = useSyncExternalStore(
    (fn) => transport.subscribe(fn),
    () => transport.log,
  )
  return (
    <Section title="Stub companion" aside={<Badge variant="outline">local stub</Badge>}>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Stands in for the companion app until the shared transport lands. It sends signed-request envelopes to the
        watch and verifies returned signatures. It does not broadcast.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button className="col-span-2" onClick={() => transport.send('transfer')}>
          Send sign request
        </Button>
        {(['short-expiry', 'replay', 'oversize', 'nonce'] as const).map((k) => (
          <Button key={k} variant="outline" size="sm" onClick={() => transport.send(k)}>
            {KIND_LABEL[k]}
          </Button>
        ))}
      </div>
      {log.length === 0 ? (
        <p className="text-xs text-sk-faint">No requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 font-mono text-xs">
          {log.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">
                {e.requestId.slice(0, 8)} · {KIND_LABEL[e.kind]}
              </span>
              <span className={`shrink-0 ${STATUS_TONE[e.status]}`}>
                {e.status}
                {e.verified === true && ' · verified'}
                {e.verified === false && ' · BAD SIG'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export default function App() {
  const watch = useWatch(controller)
  const { state } = watch
  const face = useMemo(() => renderFace(state), [state])
  const hints = hintsFor(state)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    controller
      .boot()
      .catch((err: unknown) => setBootError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBooting(false))
  }, [])

  const seStatus = state.wiped ? 'Key wiped' : state.address ? 'Key present' : booting ? 'Generating key…' : 'No key'
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
            {transport.kind === 'stub' && (
              <Button variant="outline" size="sm" onClick={() => transport.send('transfer')}>
                Send request
              </Button>
            )}
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
              (Chrome 137+, Firefox, Safari).
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

          <Section title="Secure element" aside={<Badge variant="outline">{secureElement.profile} · stub</Badge>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Wallet</dt>
              <dd className={state.wiped ? 'text-sk-danger' : ''}>{seStatus}</dd>
              <dt className="text-muted-foreground">Session</dt>
              <dd>{state.session ? 'Open' : 'Closed'}</dd>
              <dt className="text-muted-foreground">PIN tries left</dt>
              <dd>{state.attemptsLeft}</dd>
              <dt className="text-muted-foreground">Max message</dt>
              <dd>{secureElement.maxMessageBytes} bytes</dd>
              <dt className="text-muted-foreground">Request</dt>
              <dd>{pending === null ? 'None' : `${pending} s left`}</dd>
              <dt className="text-muted-foreground">Demo PIN</dt>
              <dd className="font-mono">{STUB_DEMO_PIN}</dd>
            </dl>
            {controller.address && (
              <p className="font-mono text-xs break-all text-muted-foreground">{controller.address}</p>
            )}
            {state.wiped && (
              <Button variant="outline" onClick={() => void controller.resetWallet()}>
                Create a new wallet key
              </Button>
            )}
          </Section>

          {transport.kind === 'stub' && (
            <>
              <Separator />
              <StubCompanion />
            </>
          )}
        </aside>
      </main>
    </div>
  )
}

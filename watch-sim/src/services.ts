import { RELAY_URL, createRelayTransport, type Transport } from '@sekund/protocol'
import { createBrowserSecureElement } from '@sekund/se-sim/browser'
import { WatchController } from '@/machine/controller'
import { watchIdentityFromLocation } from '@/lib/session'
import { acquireWatchLease, type LeaseHandle } from '@/storage/lease'
import { createIndexedDbReplayJournal } from '@/storage/replay'

export const relayUrl = RELAY_URL
export const identity = watchIdentityFromLocation()

export let transport: Transport | null = null
export let controller: WatchController | null = null
export let lease: LeaseHandle | null = null

export type WatchBoot = { kind: 'active' } | { kind: 'blocked' }

let boot: Promise<WatchBoot> | null = null
let seStarted: Promise<void> | null = null

/** Exclusive tab lease, then relay + controller. Secondary tabs get `blocked` and never connect. */
export function bootWatch(): Promise<WatchBoot> {
  boot ??= (async () => {
    const acquired = await acquireWatchLease()
    if (!acquired) return { kind: 'blocked' as const }
    lease = acquired
    const replay = await createIndexedDbReplayJournal()
    transport = createRelayTransport({ role: 'watch', identity })
    controller = new WatchController({ transport, replay })
    return { kind: 'active' as const }
  })()
  return boot
}

export function startSecureElement(): Promise<void> {
  if (!controller) return Promise.reject(new Error('watch runtime not started'))
  const c = controller
  seStarted ??= createBrowserSecureElement({ profile: 'TROPIC01' }).then((se) => c.boot(se))
  return seStarted
}

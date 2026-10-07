import { createRelayTransport, RELAY_URL } from '@sekund/protocol'
import { createBrowserSecureElement } from '@sekund/se-sim/browser'
import { WatchController } from '@/machine/controller'

export const relayUrl = RELAY_URL
export const transport = createRelayTransport({ role: 'watch' })
export const controller = new WatchController({ transport })

let started: Promise<void> | null = null

/** Starts the simulated SE (Web Worker + IndexedDB) once and hands it to the controller. */
export function startSecureElement(): Promise<void> {
  started ??= createBrowserSecureElement({ profile: 'TROPIC01' }).then((se) => controller.boot(se))
  return started
}

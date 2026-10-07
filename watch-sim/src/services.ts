import { StubSecureElement } from '@/adapters/stubSecureElement'
import { StubTransport } from '@/adapters/stubTransport'
import { WatchController } from '@/machine/controller'

export const secureElement = new StubSecureElement({ profile: 'TROPIC01' })
export const transport = new StubTransport()
export const controller = new WatchController({ se: secureElement, transport })

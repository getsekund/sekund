import { RELAY_HOST } from "../constants.ts";
import { startRelay } from "./server.ts";

const port = Number(process.env.SEKUND_RELAY_PORT ?? 4319);
const relay = await startRelay({ port, log: (line) => console.log(`[relay] ${line}`) });
console.log(`[relay] SEKUND local transport listening on ws://${RELAY_HOST}:${relay.port}`);

const shutdown = () => void relay.close().then(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

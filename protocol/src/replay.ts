/** How long requestId/nonce tombstones are kept (beyond any blockhash lifetime). */
export const REPLAY_TTL_MS = 10 * 60_000;

export interface ReplayEntry {
  value: string;
  expiresAt: number;
}

export interface ReplayJournal {
  /** Currently unexpired tombstones (`id:…` / `nonce:…`). */
  list(): Promise<string[]>;
  remember(value: string, expiresAt: number): Promise<void>;
  prune(now: number): Promise<void>;
}

export function createMemoryReplayJournal(seed: ReplayEntry[] = []): ReplayJournal {
  const entries = new Map<string, number>(seed.map((e) => [e.value, e.expiresAt]));
  return {
    async list() {
      const now = Date.now();
      for (const [value, expiresAt] of [...entries]) if (expiresAt <= now) entries.delete(value);
      return [...entries.keys()];
    },
    async remember(value, expiresAt) {
      entries.set(value, expiresAt);
    },
    async prune(now) {
      for (const [value, expiresAt] of [...entries]) if (expiresAt <= now) entries.delete(value);
    },
  };
}

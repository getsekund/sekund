/**
 * Persistent storage for the simulated SE. The private key is stored as a non-extractable
 * CryptoKey object: IndexedDB keeps the structured-clone handle, never key bytes.
 */

export interface PinRecord {
  salt: Uint8Array;
  hash: Uint8Array;
}

export interface KeyRecord {
  privateKey: CryptoKey;
  /** RFC 8032 order. */
  publicKey: Uint8Array;
}

export interface SeStore {
  getKey(slot: number): Promise<KeyRecord | undefined>;
  putKey(slot: number, record: KeyRecord): Promise<void>;
  getPin(): Promise<PinRecord | undefined>;
  putPin(record: PinRecord): Promise<void>;
  getFailedAttempts(): Promise<number>;
  putFailedAttempts(count: number): Promise<void>;
  /** Erases keys, PIN and counter. */
  clear(): Promise<void>;
}

export function createMemoryStore(): SeStore {
  const keys = new Map<number, KeyRecord>();
  let pin: PinRecord | undefined;
  let failed = 0;
  return {
    getKey: async (slot) => keys.get(slot),
    putKey: async (slot, record) => void keys.set(slot, record),
    getPin: async () => pin,
    putPin: async (record) => void (pin = record),
    getFailedAttempts: async () => failed,
    putFailedAttempts: async (count) => void (failed = count),
    clear: async () => {
      keys.clear();
      pin = undefined;
      failed = 0;
    },
  };
}

const OBJECT_STORE = "se";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function createIndexedDbStore(dbName: string): Promise<SeStore> {
  const open = indexedDB.open(dbName, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(OBJECT_STORE);
  const db = await requestToPromise(open);

  const get = async <T>(key: string): Promise<T | undefined> =>
    requestToPromise(db.transaction(OBJECT_STORE, "readonly").objectStore(OBJECT_STORE).get(key)) as Promise<T | undefined>;

  const write = (fn: (store: IDBObjectStore) => void): Promise<void> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(OBJECT_STORE, "readwrite");
      fn(tx.objectStore(OBJECT_STORE));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

  return {
    getKey: (slot) => get<KeyRecord>(`key:${slot}`),
    putKey: (slot, record) => write((s) => s.put(record, `key:${slot}`)),
    getPin: () => get<PinRecord>("pin"),
    putPin: (record) => write((s) => s.put(record, "pin")),
    getFailedAttempts: async () => (await get<number>("failedAttempts")) ?? 0,
    putFailedAttempts: (count) => write((s) => s.put(count, "failedAttempts")),
    clear: () => write((s) => s.clear()),
  };
}

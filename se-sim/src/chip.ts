import {
  APPROVE_TOKEN_TTL_MS,
  MAX_MESSAGE_BYTES,
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  SeError,
  bytesEqual,
  randomBytes,
  toBase64,
  type ApproveToken,
  type PinResult,
  type SeProfile,
  type SeState,
} from "@sekund/protocol";
import type { SeStore } from "./store.ts";

/**
 * The simulated chip's command surface. Public keys and signatures are in the profile's
 * native wire byte order: RFC 8032 for TROPIC01, big-endian halves for SE050E. Only
 * `seDriver` (driver.ts) may consume this interface.
 */
export interface RawSecureElement {
  readonly profile: SeProfile;
  readonly maxMessageBytes: number;
  getState(): Promise<SeState>;
  setPin(pin: string): Promise<void>;
  generateKey(slot: number): Promise<void>;
  getPublicKeyWire(slot: number): Promise<Uint8Array>;
  verifyPin(pin: string): Promise<PinResult>;
  endSession(): Promise<void>;
  issueApproveToken(slot: number, message: Uint8Array): Promise<ApproveToken>;
  eddsaSignWire(slot: number, message: Uint8Array, approveToken: ApproveToken): Promise<Uint8Array>;
  /**
   * Test-vector key import (SE050E `WriteECKey`, TROPIC01 `ECC_Key_Store`), wire order.
   * Refused unless the chip was created with `allowTestKeyImport`.
   */
  importTestKeyWire(slot: number, privateKeyWire: Uint8Array): Promise<void>;
}

export interface ChipOptions {
  profile: SeProfile;
  store: SeStore;
  /** Only the RFC 8032 test harness sets this. The browser Worker never does. */
  allowTestKeyImport?: boolean;
  now?: () => number;
}

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);
const PBKDF2_ITERATIONS = 100_000;
const PKCS8_ED25519_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

/**
 * SE050E silicon is big-endian for Ed25519 parameters (AN12543 section 7). This models the
 * chip's native order so the driver wrapper has real work to do; it is not part of the
 * host-side stack.
 */
function se050eNative(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes.slice().reverse();
  if (bytes.length === 64) {
    const out = new Uint8Array(64);
    out.set(bytes.slice(0, 32).reverse(), 0);
    out.set(bytes.slice(32).reverse(), 32);
    return out;
  }
  throw new SeError("INTERNAL", "unexpected parameter length");
}

interface PendingApproval {
  slot: number;
  message: Uint8Array;
  expiresAt: number;
}

async function hashPin(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    material,
    256,
  );
  return new Uint8Array(bits);
}

function checkSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot > 7) throw new SeError("INVALID_ARGUMENT", "slot out of range");
}

function checkPinFormat(pin: string): void {
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) throw new SeError("INVALID_ARGUMENT", `PIN must be ${PIN_LENGTH} digits`);
}

export class SimulatedSeChip implements RawSecureElement {
  readonly profile: SeProfile;
  readonly maxMessageBytes: number;
  private readonly store: SeStore;
  private readonly allowTestKeyImport: boolean;
  private readonly now: () => number;
  private sessionOpen = false;
  private readonly approvals = new Map<string, PendingApproval>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: ChipOptions) {
    this.profile = options.profile;
    this.maxMessageBytes = MAX_MESSAGE_BYTES[options.profile];
    this.store = options.store;
    this.allowTestKeyImport = options.allowTestKeyImport ?? false;
    this.now = options.now ?? Date.now;
  }

  /** Commands run one at a time, like a single-threaded SE. */
  private run<T>(command: () => Promise<T>): Promise<T> {
    const next = this.queue.then(command, command);
    this.queue = next.catch(() => {});
    return next;
  }

  private closeSession(): void {
    this.sessionOpen = false;
    this.approvals.clear();
  }

  private requireSession(): void {
    if (!this.sessionOpen) throw new SeError("NO_SESSION", "PIN session required");
  }

  getState(): Promise<SeState> {
    return this.run(async () => {
      const [pin, key, failed] = await Promise.all([this.store.getPin(), this.store.getKey(0), this.store.getFailedAttempts()]);
      return {
        profile: this.profile,
        maxMessageBytes: this.maxMessageBytes,
        hasPin: pin !== undefined,
        hasKey: key !== undefined,
        sessionOpen: this.sessionOpen,
        attemptsRemaining: MAX_PIN_ATTEMPTS - failed,
      };
    });
  }

  setPin(pin: string): Promise<void> {
    return this.run(async () => {
      checkPinFormat(pin);
      if (await this.store.getPin()) throw new SeError("PIN_ALREADY_SET");
      const salt = randomBytes(16);
      await this.store.putPin({ salt, hash: await hashPin(pin, salt) });
      await this.store.putFailedAttempts(0);
      this.sessionOpen = true;
    });
  }

  verifyPin(pin: string): Promise<PinResult> {
    return this.run(async (): Promise<PinResult> => {
      checkPinFormat(pin);
      const record = await this.store.getPin();
      if (!record) return { status: "NO_PIN" };
      this.closeSession();

      // Count the attempt before checking it, so a reload mid-check cannot skip the counter.
      const failed = (await this.store.getFailedAttempts()) + 1;
      await this.store.putFailedAttempts(failed);

      if (bytesEqual(await hashPin(pin, record.salt), record.hash)) {
        await this.store.putFailedAttempts(0);
        this.sessionOpen = true;
        return { status: "OK" };
      }
      if (failed >= MAX_PIN_ATTEMPTS) {
        await this.store.clear();
        return { status: "WIPED" };
      }
      return { status: "WRONG_PIN", attemptsRemaining: MAX_PIN_ATTEMPTS - failed };
    });
  }

  endSession(): Promise<void> {
    return this.run(async () => this.closeSession());
  }

  generateKey(slot: number): Promise<void> {
    return this.run(async () => {
      checkSlot(slot);
      this.requireSession();
      if (await this.store.getKey(slot)) throw new SeError("KEY_EXISTS");
      const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
      const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
      await this.store.putKey(slot, { privateKey: pair.privateKey, publicKey });
    });
  }

  importTestKeyWire(slot: number, privateKeyWire: Uint8Array): Promise<void> {
    return this.run(async () => {
      if (!this.allowTestKeyImport) throw new SeError("NOT_ALLOWED", "test key import is disabled");
      checkSlot(slot);
      if (!(privateKeyWire instanceof Uint8Array) || privateKeyWire.length !== 32) throw new SeError("INVALID_ARGUMENT");
      const seed = this.profile === "SE050E" ? se050eNative(privateKeyWire) : privateKeyWire;
      const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + 32);
      pkcs8.set(PKCS8_ED25519_PREFIX);
      pkcs8.set(seed, PKCS8_ED25519_PREFIX.length);
      // The SE derives the public key itself. WebCrypto can only do that through a JWK
      // export, so the transient key is extractable; the stored key is not.
      const transient = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
      const jwk = await crypto.subtle.exportKey("jwk", transient);
      pkcs8.fill(0);
      const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
      const publicKey = Uint8Array.from(atob(jwk.x!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      jwk.d = "";
      await this.store.putKey(slot, { privateKey, publicKey });
    });
  }

  getPublicKeyWire(slot: number): Promise<Uint8Array> {
    return this.run(async () => {
      checkSlot(slot);
      const record = await this.store.getKey(slot);
      if (!record) throw new SeError("NO_KEY");
      return this.profile === "SE050E" ? se050eNative(record.publicKey) : record.publicKey.slice();
    });
  }

  issueApproveToken(slot: number, message: Uint8Array): Promise<ApproveToken> {
    return this.run(async () => {
      checkSlot(slot);
      this.requireSession();
      if (!(message instanceof Uint8Array)) throw new SeError("INVALID_ARGUMENT");
      if (message.length > this.maxMessageBytes) throw new SeError("TOO_LARGE");
      if (!(await this.store.getKey(slot))) throw new SeError("NO_KEY");
      const token = toBase64(randomBytes(16));
      this.approvals.set(token, { slot, message: message.slice(), expiresAt: this.now() + APPROVE_TOKEN_TTL_MS });
      return token;
    });
  }

  eddsaSignWire(slot: number, message: Uint8Array, approveToken: ApproveToken): Promise<Uint8Array> {
    return this.run(async () => {
      checkSlot(slot);
      if (!(message instanceof Uint8Array)) throw new SeError("INVALID_ARGUMENT");
      const approval = typeof approveToken === "string" ? this.approvals.get(approveToken) : undefined;
      // Single use: the token is spent by any signing attempt, successful or not.
      if (approval) this.approvals.delete(approveToken);
      this.requireSession();
      if (message.length > this.maxMessageBytes) throw new SeError("TOO_LARGE");
      if (!approval || approval.expiresAt < this.now() || approval.slot !== slot || !bytesEqual(approval.message, message)) {
        throw new SeError("BAD_TOKEN", "approve token missing, used, expired or bound to other bytes");
      }
      const record = await this.store.getKey(slot);
      if (!record) throw new SeError("NO_KEY");
      // Pure Ed25519: the exact message bytes, no pre-hash.
      const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, record.privateKey, message as BufferSource));
      return this.profile === "SE050E" ? se050eNative(signature) : signature;
    });
  }
}

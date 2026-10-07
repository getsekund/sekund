import {
  PUBLIC_KEY_BYTES,
  SIGNATURE_BYTES,
  SeError,
  type ApproveToken,
  type PinResult,
  type SecureElement,
  type SeProfile,
  type SeState,
} from "@sekund/protocol";
import type { RawSecureElement } from "./chip.ts";

/** A SecureElement backed by the simulator, with the test-vector import hook exposed. */
export interface SimulatedSecureElement extends SecureElement {
  /** RFC 8032 secret key (32-byte seed). Rejected unless the chip allows test imports. */
  importTestKey(slot: number, secretKey: Uint8Array): Promise<void>;
}

function reverse32(bytes: Uint8Array): Uint8Array {
  return bytes.slice().reverse();
}

/** R and S are reversed separately; reversing all 64 bytes as one block would be wrong. */
function reverseSignatureHalves(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(SIGNATURE_BYTES);
  out.set(reverse32(bytes.subarray(0, 32)), 0);
  out.set(reverse32(bytes.subarray(32, 64)), 32);
  return out;
}

interface WireOrder {
  publicKey(wire: Uint8Array): Uint8Array;
  signature(wire: Uint8Array): Uint8Array;
  privateKeyToWire(rfc: Uint8Array): Uint8Array;
}

const WIRE_ORDER: Record<SeProfile, WireOrder> = {
  // Datasheet section 7.3.1: little-endian on all multi-byte fields; RFC 8032 output as is.
  TROPIC01: {
    publicKey: (wire) => wire.slice(),
    signature: (wire) => wire.slice(),
    privateKeyToWire: (rfc) => rfc.slice(),
  },
  // AN12543 section 7: reverse the public key, and r and s separately. The private-key
  // reversal for WriteECKey follows NXP's Plug&Trust middleware; verify on silicon (M1).
  SE050E: {
    publicKey: reverse32,
    signature: reverseSignatureHalves,
    privateKeyToWire: reverse32,
  },
};

/**
 * Mirrors the firmware `se_driver`: the one place where byte order is converted, and the
 * host-side length check before any command reaches the chip.
 */
export function seDriver(raw: RawSecureElement): SimulatedSecureElement {
  const order = WIRE_ORDER[raw.profile];

  const checkLength = (message: Uint8Array) => {
    if (!(message instanceof Uint8Array)) throw new SeError("INVALID_ARGUMENT", "message must be bytes");
    if (message.length > raw.maxMessageBytes) {
      throw new SeError("TOO_LARGE", `${message.length} bytes exceeds ${raw.profile} limit of ${raw.maxMessageBytes}`);
    }
  };

  return {
    profile: raw.profile,
    maxMessageBytes: raw.maxMessageBytes,
    getState: (): Promise<SeState> => raw.getState(),
    setPin: (pin) => raw.setPin(pin),
    generateKey: (slot) => raw.generateKey(slot),
    verifyPin: (pin): Promise<PinResult> => raw.verifyPin(pin),
    endSession: () => raw.endSession(),

    async getPublicKey(slot) {
      const wire = await raw.getPublicKeyWire(slot);
      if (wire.length !== PUBLIC_KEY_BYTES) throw new SeError("INTERNAL", "bad public key length");
      return order.publicKey(wire);
    },

    async issueApproveToken(slot, message): Promise<ApproveToken> {
      checkLength(message);
      return raw.issueApproveToken(slot, message);
    },

    async eddsaSign(slot, message, approveToken) {
      checkLength(message);
      const wire = await raw.eddsaSignWire(slot, message, approveToken);
      if (wire.length !== SIGNATURE_BYTES) throw new SeError("INTERNAL", "bad signature length");
      return order.signature(wire);
    },

    async importTestKey(slot, secretKey) {
      if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) throw new SeError("INVALID_ARGUMENT");
      await raw.importTestKeyWire(slot, order.privateKeyToWire(secretKey));
    },
  };
}

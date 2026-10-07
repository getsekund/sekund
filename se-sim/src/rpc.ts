import { MAX_MESSAGE_BYTES, SeError, type SeErrorCode, type SeProfile } from "@sekund/protocol";
import type { RawSecureElement } from "./chip.ts";

/** The subset of Worker / MessagePort used here. */
export interface RpcPort {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  start?: () => void;
}

const METHODS = [
  "getState",
  "setPin",
  "generateKey",
  "getPublicKeyWire",
  "verifyPin",
  "endSession",
  "issueApproveToken",
  "eddsaSignWire",
  "importTestKeyWire",
] as const satisfies readonly (keyof RawSecureElement)[];

type Method = (typeof METHODS)[number];

interface RpcRequest {
  id: number;
  method: Method;
  args: unknown[];
}

type RpcResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; code: SeErrorCode; message: string };

/** Worker side: serves chip commands over the port. Errors cross as codes only. */
export function serveSecureElement(port: RpcPort, chip: RawSecureElement): void {
  port.addEventListener("message", async (event: MessageEvent) => {
    const request = event.data as RpcRequest;
    if (!request || typeof request.id !== "number" || !METHODS.includes(request.method) || !Array.isArray(request.args)) return;
    let response: RpcResponse;
    try {
      const fn = chip[request.method] as (...args: unknown[]) => Promise<unknown>;
      response = { id: request.id, ok: true, result: await fn.apply(chip, request.args) };
    } catch (error) {
      response =
        error instanceof SeError
          ? { id: request.id, ok: false, code: error.code, message: error.message }
          : { id: request.id, ok: false, code: "INTERNAL", message: "internal error" };
    }
    port.postMessage(response);
  });
  port.start?.();
}

/** Page side: a RawSecureElement whose commands run in the Worker. */
export function connectSecureElement(port: RpcPort, profile: SeProfile): RawSecureElement {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

  port.addEventListener("message", (event: MessageEvent) => {
    const response = event.data as RpcResponse;
    const entry = response && pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(new SeError(response.code, response.message));
  });
  port.start?.();

  const call = <T>(method: Method, ...args: unknown[]): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      port.postMessage({ id, method, args } satisfies RpcRequest);
    });

  return {
    profile,
    maxMessageBytes: MAX_MESSAGE_BYTES[profile],
    getState: () => call("getState"),
    setPin: (pin) => call("setPin", pin),
    generateKey: (slot) => call("generateKey", slot),
    getPublicKeyWire: (slot) => call("getPublicKeyWire", slot),
    verifyPin: (pin) => call("verifyPin", pin),
    endSession: () => call("endSession"),
    issueApproveToken: (slot, message) => call("issueApproveToken", slot, message),
    eddsaSignWire: (slot, message, token) => call("eddsaSignWire", slot, message, token),
    importTestKeyWire: (slot, key) => call("importTestKeyWire", slot, key),
  };
}

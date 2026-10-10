/**
 * Facts the deck shows. Every value here was read back from devnet
 * (getTransaction, jsonParsed) before it went on a slide.
 */

export const PROOF_TX = {
  signature: "AaqyPdeFKNRWiq5Ghb9jYnpy1MXYeciPwdXwBZNk4aJkqse5h6wpBq3FmdkMeNG1qbo54GfJc7CgRHGZbUVbDNi",
  signer: "Gv61osw6fZdJTXy6By7qS84hrJ3ZrBLJ3VBQcBPETb4x",
  destination: "5awdRY3zVWWNZXmHH955bDxdUoZ7aFqjKKaCeCeBuAbg",
  amountSol: "0.01",
  slot: 508_817_262,
  blockTimeUtc: "2026-10-08 12:30:34 UTC",
  cluster: "devnet",
} as const;

/** The earlier proof, kept for Q&A. */
export const EARLIER_TX = {
  signature: "4rZ5vcBJkaNUxHzK22tmy9opuZQzQJqmwR7RVc1cNLV8AT8XGnCFjXCJNCyrMxEtXtqA9C1FyrgTar85oX92ghHX",
  signer: "H74UTC7MPe4yvRMQhZ6VwW9hoMkaeMX9FxeSLAGgbb9E",
  amountSol: "0.001",
} as const;

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function shortKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export const REPO_URL = "https://github.com/getsekund/sekund";

/** The public site. Registered, not deployed: a scan does not open a page yet. */
export const SITE_URL = "https://getsekund.com";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampIndex, hashFor, indexFromHash } from "./route";

const CHANNEL = "sekund-deck";

/**
 * The current slide lives in the URL hash. Every open window of the deck (the show on the
 * projector, the notes on the laptop) follows the same index over a BroadcastChannel, so
 * arrow keys in either window move both.
 */
export function useDeck(ids: readonly string[]) {
  const count = ids.length;
  const [index, setIndexState] = useState(() => indexFromHash(window.location.hash, ids));
  const quiet = useRef(false);
  const current = useRef(index);

  const setIndex = useCallback(
    (next: number | ((current: number) => number), broadcast = true) => {
      const resolved = clampIndex(typeof next === "function" ? next(current.current) : next, count);
      if (resolved === current.current) return;
      quiet.current = !broadcast;
      current.current = resolved;
      setIndexState(resolved);
    },
    [count],
  );

  // The hash follows the index (and `#3` is normalised to the slide id so copied links read well).
  useEffect(() => {
    current.current = index;
    const hash = hashFor(index, ids);
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
    if (quiet.current || !("BroadcastChannel" in window)) {
      quiet.current = false;
      return;
    }
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ index });
    channel.close();
  }, [index, ids]);

  useEffect(() => {
    const onHash = () => setIndex(indexFromHash(window.location.hash, ids));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [ids, setIndex]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<{ index?: number }>) => {
      if (typeof event.data?.index === "number") setIndex(event.data.index, false);
    };
    return () => channel.close();
  }, [setIndex]);

  const next = useCallback(() => setIndex((i) => i + 1), [setIndex]);
  const prev = useCallback(() => setIndex((i) => i - 1), [setIndex]);
  const first = useCallback(() => setIndex(0), [setIndex]);
  const last = useCallback(() => setIndex(count - 1), [count, setIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
        case "n":
        case "j":
        case "l":
          event.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
        case "p":
        case "k":
        case "h":
          event.preventDefault();
          prev();
          break;
        case "Home":
          event.preventDefault();
          first();
          break;
        case "End":
          event.preventDefault();
          last();
          break;
        default:
          if (/^[1-9]$/.test(event.key)) {
            setIndex(Number(event.key) - 1);
          } else if (event.key === "0") {
            setIndex(9);
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, last, next, prev, setIndex]);

  return { index, count, setIndex, next, prev, first, last };
}

/** Scale that fits the 1920 × 1080 stage inside the window. */
export function useStageScale(): number {
  const compute = () => Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

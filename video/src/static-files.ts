import { getStaticFiles } from "remotion";

/** Whether a file is in public/: the optional voice-over and founder clip are used only when present. */
export function hasStatic(name: string): boolean {
  return getStaticFiles().some((file) => file.name === name);
}

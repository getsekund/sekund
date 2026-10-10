import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { SLIDES } from "@/deck/slides";

export interface Founder {
  name: string;
  /** The line under the name, as the slide sets it. */
  line: string;
}

type Props = { children?: ReactNode };

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<Props>(node)) return node.type === "br" ? " " : text(node.props.children);
  return "";
}

function isName(node: ReactNode): node is ReactElement<Props> {
  return isValidElement<Props>(node) && node.type === "h3";
}

/**
 * Walks a slide's elements and tags every block that holds a founder's name (an h3) with
 * `data-founder`, in order. The copy and the layout stay the deck's; the video only learns which
 * block is whose, so the team beat follows whatever the team slide says.
 */
export function markFounders(root: ReactNode): { node: ReactNode; founders: Founder[] } {
  const founders: Founder[] = [];
  const walk = (n: ReactNode): ReactNode => {
    if (!isValidElement<Props>(n) || n.props.children === undefined) return n;
    const kids = Children.toArray(n.props.children);
    const name = kids.find(isName);
    const extra: Record<string, string> = {};
    if (name) {
      extra["data-founder"] = String(founders.length);
      const lines = kids.filter((k) => isValidElement(k) && k.type === "p");
      founders.push({ name: text(name).trim(), line: lines.map(text).join(" ").trim() });
    }
    return cloneElement(n, extra, ...kids.map(walk));
  };
  return { node: walk(root), founders };
}

export function teamSlide() {
  const slide = SLIDES.find((s) => s.id === "team");
  if (!slide) throw new Error('the deck has no "team" slide');
  return slide;
}

export function teamFounders(): Founder[] {
  return markFounders(teamSlide().render({ active: true })).founders;
}

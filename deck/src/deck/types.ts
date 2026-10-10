import type { ReactNode } from "react";

export interface SlideContext {
  /** True for the slide on screen in the show. Drives dissolve-in and field motion. */
  active: boolean;
}

export interface Slide {
  /** URL hash and file name. */
  id: string;
  /** Short name for the presenter view and the contact sheet. */
  title: string;
  /** Speaker notes in Serbian. Paragraphs; a paragraph starting with "!" is a flag. */
  notes: readonly string[];
  render: (ctx: SlideContext) => ReactNode;
  /** Hide the wordmark chrome on slides that carry it themselves. */
  bareMark?: boolean;
}

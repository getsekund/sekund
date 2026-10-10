import { DeckSlide } from "../deck";
import { riseAll, type Build } from "../slides";
import { cueAt } from "../script";

export function TitleScene() {
  return <DeckSlide id="claim" />;
}

export function ProblemScene() {
  const builds: Build[] = [
    { selector: ".slide__body > :nth-child(1)", at: cueAt("problem", 0) },
    { selector: ".slide__body > .list > li:nth-child(1)", at: cueAt("problem", 1) },
    { selector: ".slide__body > .list > li:nth-child(2)", at: cueAt("problem", 2) },
    { selector: ".slide__body > :nth-child(3)", at: cueAt("problem", 3) },
  ];
  return <DeckSlide id="problem" builds={builds} />;
}

export function HowScene() {
  const builds: Build[] = [
    { selector: ".slide__body > :nth-child(1)", at: 0.15 },
    ...[0, 1, 2, 3].map((i) => ({ selector: `.cols > :nth-child(${i + 1})`, at: cueAt("how", i) })),
    // "The key never reaches the phone app." is the second sentence of the last line.
    { selector: ".foot", at: cueAt("how", 3, 1.9) },
  ];
  return <DeckSlide id="how" builds={builds} />;
}

/** The ask is timed to the words: a place in the accelerator, a hardware partner, Solana Mobile. */
const ASK_WORDS = [1.3, 3.4, 5.1];

export function PlanScene() {
  const plan = ".slide__body > .col:nth-child(1)";
  const ask = ".slide__body > .col:nth-child(2)";
  const builds: Build[] = [
    { selector: `${plan} > :nth-child(1)`, at: cueAt("plan", 0) },
    { selector: `${plan} li:nth-child(1)`, at: cueAt("plan", 1) },
    { selector: `${plan} li:nth-child(2)`, at: cueAt("plan", 1, 1.9) },
    { selector: `${plan} li:nth-child(3)`, at: cueAt("plan", 1, 4.4) },
    { selector: `${plan} li:nth-child(4)`, at: cueAt("plan", 1, 4.8) },
    { selector: `${ask} > :nth-child(1)`, at: cueAt("plan", 2) },
    ...ASK_WORDS.map((offset, i) => ({ selector: `${ask} li:nth-child(${i + 1})`, at: cueAt("plan", 2, offset) })),
  ];
  return <DeckSlide id="next" builds={builds} />;
}

export function CloseScene() {
  return <DeckSlide id="close" builds={riseAll(0.15, 2)} />;
}

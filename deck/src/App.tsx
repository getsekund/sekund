import { HeroLcdVariants, IllustrationOptions, LogoOptions } from "./deck/Options";
import { Presenter } from "./deck/Presenter";
import { PrintView } from "./deck/PrintView";
import { Sheet } from "./deck/Sheet";
import { Show } from "./deck/Show";
import { modeFrom } from "./deck/route";

export default function App() {
  const mode = modeFrom(window.location.search);
  if (mode === "notes") return <Presenter />;
  if (mode === "print") return <PrintView />;
  if (mode === "sheet") return <Sheet />;
  if (mode === "logos") return <LogoOptions />;
  if (mode === "illustrations") return <IllustrationOptions />;
  if (mode === "hero") return <HeroLcdVariants />;
  return <Show />;
}

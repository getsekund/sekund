import { useEffect, useRef } from "react";
import { createDotField, fitCanvas } from "@/lib/sekund-dots.js";

/** 22 px paper loader. DESIGN.md §10: beside words, never alone, still under reduced motion. */
export function DotLoader() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    fitCanvas(canvas, 22, 22);
    const field = createDotField(canvas, { variant: "loader", background: null });
    field.start();
    return () => field.destroy();
  }, []);

  return (
    <canvas
      ref={ref}
      width={22}
      height={22}
      className="size-[22px] shrink-0"
      aria-hidden
      data-testid="dot-loader"
    />
  );
}

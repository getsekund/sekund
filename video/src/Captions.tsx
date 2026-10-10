import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { captionAt, captionChunks } from "./captions";

/** The voice-over, burned in: one line, centred under the slide's bottom margin, on a ground-coloured plate. */
export function Captions() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chunks = useMemo(() => captionChunks(), []);
  const chunk = captionAt(frame / fps, chunks);
  if (!chunk) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
      <p
        style={{
          margin: 0,
          padding: "6px 18px 9px",
          background: "rgba(0, 0, 0, 0.86)",
          color: "var(--d-ink)",
          fontFamily: "var(--d-font-ui)",
          fontSize: 38,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: "-0.005em",
          whiteSpace: "nowrap",
        }}
      >
        {chunk.text}
      </p>
    </div>
  );
}

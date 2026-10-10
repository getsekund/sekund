import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted Inter SemiBold: the wordmark is set in it (as outlines in src/brand/wordmark-inter.ts);
// the face itself is only drawn live on the ?logos sheet, as the reference the outlines are checked against.
import "@fontsource/inter/latin-600.css";
import "./styles/deck.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

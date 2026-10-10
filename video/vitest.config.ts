import { fileURLToPath, URL } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  resolve: {
    alias: { "@": fileURLToPath(new URL("../deck/src", import.meta.url)) },
  },
  test: {
    name: "video",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});

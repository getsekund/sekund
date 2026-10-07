import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "se-sim",
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["fake-indexeddb/auto"],
  },
});

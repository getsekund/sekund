import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

const packages = ["protocol", "se-sim", "companion", "watch-sim", "deck", "video"];

export default defineConfig({
  test: {
    projects: packages.filter((dir) => existsSync(new URL(`./${dir}/package.json`, import.meta.url))),
  },
});

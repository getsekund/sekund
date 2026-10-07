import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

const packages = ["protocol", "se-sim", "companion", "watch-sim"];

export default defineConfig({
  test: {
    projects: packages.filter((dir) => existsSync(new URL(`./${dir}/package.json`, import.meta.url))),
  },
});

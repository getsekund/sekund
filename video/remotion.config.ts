import { Config } from "@remotion/cli/config";
import { deckWebpackOverride } from "./webpack-override";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// The Remotion CLI evaluates this file from the package root, as CommonJS (no import.meta).
Config.overrideWebpackConfig(deckWebpackOverride(process.cwd()));

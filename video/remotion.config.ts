import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./webpack-override";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(webpackOverride);

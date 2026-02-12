import esbuild from "esbuild";
import { existsSync, readFileSync } from "fs";

const isWatch = process.argv.includes("--watch");

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: false,
  treeShaking: true,
  define: {
    "process.env.PLUGIN_VERSION": JSON.stringify(manifest.version),
  },
  logLevel: "info",
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
}

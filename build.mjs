// Bundles an entry and inlines it into a single self-contained HTML page.
// node build.mjs game 1   -> dist/mb2-build-1.html
// node build.mjs lab 2    -> dist/mb2-lab-2.html
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const [what = "game", n = "dev"] = process.argv.slice(2);
const entry = what === "lab" ? "src/lab.ts" : "src/main.ts";
const tpl = what === "lab" ? "web/lab.html" : "web/index.html";
const out = await build({ entryPoints: [entry], bundle: true, minify: true, format: "iife", target: "es2020", write: false });
const js = out.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
let html = readFileSync(tpl, "utf8").replace(/build 1/g, `build ${n}`).replace("<script>/*GAME*/</script>", () => `<script>${js}</script>`);
mkdirSync("dist", { recursive: true });
const file = `dist/mb2-${what === "lab" ? "lab" : "build"}-${n}.html`;
writeFileSync(file, html);
console.log(file, (html.length / 1024).toFixed(0) + " KB");

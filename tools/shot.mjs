// Headless smoke test: loads the build, reports console errors, takes screenshots.
import { chromium } from "playwright";
const file = process.argv[2], script = process.argv[3] || "";
import { existsSync } from "node:fs";
const exe = process.env.CHROME || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const b = await chromium.launch({ executablePath: exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await p.route("**/fonts.googleapis.com/**", (r) => r.abort());
await p.goto("file://" + process.cwd() + "/" + file);
await p.waitForTimeout(1500);
const steps = (await import(process.cwd() + "/" + script)).default;
await steps(p);
console.log(errs.length ? errs.join("\n") : "no console errors");
await b.close();

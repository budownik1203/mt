// Model lab: turntable for the base human and gear across render styles.
import { m4, mul, perspective, lookAt, trs, clamp } from "./core/math.ts";
import { PSX, GMesh, Light } from "./char/psx.ts";
import { paintAtlas, downsample, REG } from "./char/atlas.ts";
import { paintGear, paintMailTile, buildGear, LOADOUTS, Loadout } from "./char/gear.ts";
import { TMesh } from "./char/tmesh.ts";
import { LEVELS, Level, buildHuman, solve, poseIdle, poseT, poseWalk, Joint, Pose } from "./char/human.ts";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("view") as HTMLCanvasElement;
const R = new PSX(canvas);
const atlas = paintAtlas(), gearAtlas = paintGear(), mailTile = paintMailTile();

type View = "front" | "q" | "side" | "back" | "face" | "bust";
type PoseName = "idle" | "t" | "walk";
type LightName = "day" | "dusk" | "torch";
const S = { level: "ps1b" as Level, loadout: "sergeant" as Loadout, view: "q" as View, pose: "idle" as PoseName, light: "day" as LightName, wire: false, spin: true, yaw: 0.7, pitch: 0.12, dist: 3.2, time: -1 };

const LIGHTS: Record<LightName, Light & { bg: number[] }> = {
  day: { dir: norm([0.45, 0.8, 0.55]), col: [0.92, 0.88, 0.8], amb: [0.5, 0.51, 0.55], rim: [0.14, 0.15, 0.18], fog: [0.44, 0.46, 0.49], bg: [0.44, 0.46, 0.49], sky: [[0.55, 0.6, 0.68], [0.95, 0.95, 0.92], [0.2, 0.17, 0.13]] },
  dusk: { dir: norm([-0.75, 0.3, 0.45]), col: [1.15, 0.56, 0.3], amb: [0.22, 0.2, 0.27], rim: [0.35, 0.16, 0.1], fog: [0.3, 0.2, 0.19], bg: [0.3, 0.2, 0.19], sky: [[0.2, 0.2, 0.32], [1.1, 0.55, 0.3], [0.1, 0.07, 0.06]] },
  torch: { dir: norm([0.3, 0.7, 0.2]), col: [0.07, 0.09, 0.15], amb: [0.07, 0.08, 0.12], rim: [0.06, 0.07, 0.12], fog: [0.035, 0.04, 0.06], bg: [0.035, 0.04, 0.06], sky: [[0.03, 0.04, 0.07], [0.12, 0.1, 0.12], [0.02, 0.02, 0.02]], point: { pos: [0.7, 1.55, 0.9], col: [2.3, 1.15, 0.45], rad: 4.2 } },
};
function norm(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l); }

let parts: { joint: Joint; mesh: GMesh }[] = [];
let tris = 0;
const ground = (() => {
  const t = new TMesh(256), up = [0, 1, 0], g = REG.ground;
  for (let x = -9; x < 9; x++) for (let z = -9; z < 9; z++) {
    if (Math.hypot(x + 0.5, z + 0.5) > 9.5) continue;
    const A = [x, 0, z], B = [x + 1, 0, z], C = [x + 1, 0, z + 1], D = [x, 0, z + 1];
    t.tri([A, C, B], [up, up, up], [t.uvOf(g, 0, 0), t.uvOf(g, 1, 1), t.uvOf(g, 1, 0)]);
    t.tri([A, D, C], [up, up, up], [t.uvOf(g, 0, 0), t.uvOf(g, 0, 1), t.uvOf(g, 1, 1)]);
  }
  return t;
})();
const blob = (() => { const t = new TMesh(256); t.box(trs(m4(), 0, 0.004, 0), 0.75, 0.001, 0.62, REG.blob); return t; })();
let groundG: GMesh, blobG: GMesh;

function rebuild() {
  const L = LEVELS[S.level];
  R.setTexture(0, downsample(atlas, L.tex), L.bilinear);
  R.setTexture(1, downsample(gearAtlas, L.tex), L.bilinear);
  R.setTexture(2, mailTile, L.bilinear, true);
  const h = buildHuman(L);
  const g = buildGear(L, S.loadout);
  parts = h.parts.map((p) => ({ joint: p.joint, mesh: R.upload(p.mesh, 0) })).concat(g.map((p) => ({ joint: p.joint, mesh: R.upload(p.mesh, p.tex) })));
  tris = h.tris + g.reduce((a, p) => a + p.mesh.tris, 0);
  groundG = R.upload(ground, 0); groundG.wcount = 0;
  blobG = R.upload(blob, 0); blobG.wcount = 0;
  $("sTris").textContent = String(tris);
  $("sTex").textContent = `${256 / L.tex}×${256 / L.tex} ×2`;
  rebuildRes();
  $("sFx").textContent = [L.smooth ? "gładkie cieniowanie" : "płaskie fasety", L.snap ? "drgające wierzchołki" : null, L.affine ? "afiniczne tekstury" : null, L.dither ? "dithering" : null, L.bilinear ? "filtr dwuliniowy" : "ostre piksele", L.outline ? "kontur" : null, L.vertexSpec ? "połysk na wierzchołkach" : "połysk na pikselach"].filter(Boolean).join(", ");
  $("eraName").textContent = L.name; $("eraYear").textContent = L.era;
  $("origin").textContent = L.origin;
  $("kit").textContent = LOADOUTS[S.loadout].desc;
  syncButtons();
}

function applyView(v: View) {
  S.view = v;
  const p: Record<View, [number, number, number]> = { front: [0, 0.06, 2.35], q: [0.65, 0.1, 2.45], side: [Math.PI / 2, 0.06, 2.35], back: [Math.PI, 0.08, 2.35], face: [0.35, 0.02, 0.72], bust: [0.55, 0.05, 1.25] };
  [S.yaw, S.pitch, S.dist] = p[v];
  syncButtons();
}

let drag = false, lx = 0, ly = 0;
canvas.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; S.spin = false; canvas.setPointerCapture(e.pointerId); syncButtons(); });
canvas.addEventListener("pointermove", (e) => { if (!drag) return; S.yaw -= (e.clientX - lx) * 0.01; S.pitch = clamp(S.pitch + (e.clientY - ly) * 0.006, -0.4, 1.0); lx = e.clientX; ly = e.clientY; });
canvas.addEventListener("pointerup", () => { drag = false; });
canvas.addEventListener("wheel", (e) => { e.preventDefault(); S.dist = clamp(S.dist * (1 + Math.sign(e.deltaY) * 0.1), 0.5, 7); }, { passive: false });

function bindGroup(id: string, key: "level" | "view" | "pose" | "light" | "loadout") {
  $(id).addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    const v = b.dataset.v!;
    if (key === "level") { S.level = v as Level; rebuild(); }
    else if (key === "loadout") { S.loadout = v as Loadout; rebuild(); }
    else if (key === "view") applyView(v as View);
    else { (S as Record<string, unknown>)[key] = v; syncButtons(); }
  });
}
bindGroup("gLevel", "level"); bindGroup("gKit", "loadout"); bindGroup("gView", "view"); bindGroup("gPose", "pose"); bindGroup("gLight", "light");
$("bWire").addEventListener("click", () => { S.wire = !S.wire; syncButtons(); });
$("bSpin").addEventListener("click", () => { S.spin = !S.spin; syncButtons(); });
function syncButtons() {
  for (const [g, k] of [["gLevel", S.level], ["gKit", S.loadout], ["gView", S.view], ["gPose", S.pose], ["gLight", S.light]] as const)
    $(g).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.v === k)));
  $("bWire").setAttribute("aria-pressed", String(S.wire));
  $("bSpin").setAttribute("aria-pressed", String(S.spin));
}

const vp = m4(), view = m4(), proj = m4();
let last = performance.now(), clock = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  clock = S.time >= 0 ? S.time : clock + dt;
  if (S.spin) S.yaw += dt * 0.45;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.floor(canvas.clientWidth * dpr), ch = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; rebuildRes(); }
  const L = LEVELS[S.level];
  const ty = S.view === "face" ? 1.6 : S.view === "bust" ? 1.38 : 0.92;
  const cp = Math.cos(S.pitch);
  const eye = [Math.sin(S.yaw) * cp * S.dist, ty + Math.sin(S.pitch) * S.dist, Math.cos(S.yaw) * cp * S.dist];
  const near = 0.05, far = 40;
  perspective(proj, (S.view === "face" ? 40 : 45) * Math.PI / 180, canvas.width / Math.max(1, canvas.height), near, far);
  lookAt(view, eye as never, [0, ty, 0]);
  mul(vp, proj, view);
  const pose: Pose = S.pose === "t" ? poseT() : S.pose === "walk" ? poseWalk(clock) : poseIdle(clock);
  const J = solve(m4(), pose);
  const items = parts.map((p) => ({ mesh: p.mesh, model: J[p.joint] }));
  items.sort((a, b) => a.mesh.tex - b.mesh.tex);
  items.unshift({ mesh: blobG, model: m4() }, { mesh: groundG, model: m4() });
  const lt = LIGHTS[S.light];
  if (lt.point) lt.point.pos[1] = 1.55 + Math.sin(now * 0.013) * 0.03;
  R.render(L, vp, eye, lt, items, S.wire, lt.bg, near, far);
  requestAnimationFrame(frame);
}
function rebuildRes() { const [w, h] = R.size(LEVELS[S.level]); $("sRes").textContent = `${w}×${h}`; }

(window as unknown as { lab: unknown }).lab = {
  set(o: Partial<typeof S>) { const re = (o.level && o.level !== S.level) || (o.loadout && o.loadout !== S.loadout); Object.assign(S, o); if (o.view) applyView(o.view); if (o.yaw !== undefined) S.yaw = o.yaw; if (re) rebuild(); syncButtons(); },
  get tris() { return tris; },
};

rebuild(); applyView("q"); S.spin = true; syncButtons();
requestAnimationFrame(frame);

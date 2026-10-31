// mb2 build 1 — Gallows Field: a melee proving ground for Montablate 2.0.
import { m4, perspective, lookAt, trs, clamp, lerp, V3, rng } from "./core/math.ts";
import { Renderer, DrawItem, Mesh } from "./gfx/renderer.ts";
import { MeshBuilder, T, hex } from "./gfx/meshbuilder.ts";
import { buildTerrain, height, WORLD } from "./world/terrain.ts";
import { buildScenery, Collider } from "./world/props.ts";
import { lighting, Weather } from "./world/atmosphere.ts";
import { Fighter, Kit } from "./game/fighter.ts";
import { Brain } from "./game/ai.ts";
import { WEAPONS, ARMOURS, DIR, Dir, attackOf, damage, hitPart, blockMatches, shieldCovers, dirFromMouse, mirror } from "./game/combat.ts";
import { Audio } from "./core/audio.ts";
import { t, lang, setLang, helpRows } from "./core/i18n.ts";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("c") as HTMLCanvasElement;
let R: Renderer;
try { R = new Renderer(canvas); } catch (e) {
  $("title").innerHTML = `<h1>WebGL2</h1><p>${String(e)}</p>`;
  throw e;
}
const audio = new Audio();

// ---------- world ----------
const terrainMesh = R.upload(buildTerrain());
const scen = buildScenery();
const sceneryMesh = R.upload(scen.mesh);
const colliders: Collider[] = scen.colliders;
const ground = (x: number, z: number) => height(x, z);
const flameMesh = (() => { const b = new MeshBuilder(); b.cyl(T(0, 0, 0), 0.32, 0, 0.9, 5, [1, 1, 1], false); b.cyl(T(0.12, 0, 0.05, 1), 0.18, 0, 0.55, 4, [1, 1, 1], false); return R.upload(b); })();
const cubeMesh = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(), 1, 1, 1, [1, 1, 1]); return R.upload(b); })();
const decalMesh = (() => { const b = new MeshBuilder(); b.jitter = 0.2; for (let i = 0; i < 5; i++) { const a = i * 1.3; b.box(T(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, a), 0.6 - i * 0.07, 0.02, 0.45 - i * 0.05, hex(0x3d0a08)); } return R.upload(b); })();

// ---------- kits ----------
const KITS: Record<string, Kit> = {
  bandit: { name: { pl: "Rozbójnik", en: "Brigand" }, weapon: WEAPONS.hatchet, armour: ARMOURS.gambeson, shield: false, helm: "hood", hp: 80, skill: 0.3,
    colors: { skin: 0xa58468, cloth: 0x4b4234, armour: 0x6a5c45, legs: 0x3e382f, helm: 0x444444, trim: 0x2c2620 } },
  cutthroat: { name: { pl: "Rzezimieszek", en: "Cutthroat" }, weapon: WEAPONS.spear, armour: ARMOURS.rags, shield: false, helm: "bare", hp: 70, skill: 0.4,
    colors: { skin: 0x9c7a5e, cloth: 0x3d3a2e, armour: 0x55503f, legs: 0x35302a, helm: 0x444444, trim: 0x5a2420 } },
  merc: { name: { pl: "Najemnik", en: "Sellsword" }, weapon: WEAPONS.sword, armour: ARMOURS.mail, shield: true, helm: "kettle", hp: 100, skill: 0.55,
    colors: { skin: 0xa88a6c, cloth: 0x6e5a2a, armour: 0x6f7173, legs: 0x3c3a36, helm: 0x5b5d60, trim: 0x2f2a20 } },
  maa: { name: { pl: "Zbrojny Pana Kruczego", en: "Raven Lord's man-at-arms" }, weapon: WEAPONS.mace, armour: ARMOURS.plate, shield: true, helm: "greathelm", hp: 110, skill: 0.72,
    colors: { skin: 0xa88a6c, cloth: 0x1d1c20, armour: 0x7d8186, legs: 0x5a5d61, helm: 0x6d7175, trim: 0x8a1f1a } },
  headsman: { name: { pl: "Kat", en: "Headsman" }, weapon: WEAPONS.greataxe, armour: ARMOURS.gambeson, shield: false, helm: "hood", hp: 130, skill: 0.5,
    colors: { skin: 0x9c7a5e, cloth: 0x1a1717, armour: 0x2e2a28, legs: 0x26221f, helm: 0x111111, trim: 0x111111 } },
};
const PLAYER_WEAPONS = ["sword", "greataxe", "mace", "spear"] as const;
let weaponSlot = 0;
function playerKit(): Kit {
  const w = WEAPONS[PLAYER_WEAPONS[weaponSlot]];
  return { name: { pl: t("you"), en: t("you") }, weapon: w, armour: ARMOURS.mail, shield: w.shield, helm: "nasal", hp: 120, skill: 1,
    colors: { skin: 0xb08f72, cloth: 0x5a1d18, armour: 0x6a6c70, legs: 0x3a3430, helm: 0x7a7d82, trim: 0xa08a52 } };
}

// ---------- state ----------
let player!: Fighter;
let fighters: Fighter[] = [];
let brains = new Map<number, Brain>();
const tokens = { used: 0, max: 2 };
let wave = 0, kills = 0, waveBreak = 0, started = false;
let hour = 17.6;
const weather: Weather = { rain: 0, target: 0 };
let firstPerson = false, hints = true, helpOpen = false;
let camYaw = Math.PI, camPitch = -0.12;
let lightning = 0;
let paused = false;
let debugCam: [V3, V3] | null = null;

interface Blood { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; s: number; spark?: boolean }
const blood: Blood[] = [];
const decals: { x: number; y: number; z: number; r: number; s: number }[] = [];

function reset() {
  fighters = []; brains.clear(); tokens.used = 0; blood.length = 0; decals.length = 0;
  wave = 0; kills = 0; waveBreak = 2.5;
  player = new Fighter(R, playerKit(), 0, 4, 0);
  player.yaw = camYaw;
  fighters.push(player);
  setFirstPerson(firstPerson);
  $("dead").hidden = true;
  log.length = 0; renderLog();
}

function setFirstPerson(v: boolean) {
  firstPerson = v;
  player.hidden.clear();
  if (v) { player.hidden.add("head"); player.hidden.add("torso"); player.hidden.add("pelvis"); player.hidden.add("legs"); }
}

function spawnWave() {
  wave++;
  const r = rng(wave * 31 + 7);
  const plan: string[] =
    wave === 1 ? ["bandit", "bandit"] :
    wave === 2 ? ["bandit", "cutthroat", "merc"] :
    wave === 3 ? ["merc", "bandit", "cutthroat", "bandit"] :
    wave === 4 ? ["maa", "merc", "bandit"] :
    wave === 5 ? ["headsman", "cutthroat", "cutthroat", "merc"] :
    Array.from({ length: Math.min(7, 2 + Math.floor(wave / 1.5)) }, () => ["bandit", "cutthroat", "merc", "maa", "headsman"][Math.floor(r() * (wave > 7 ? 5 : 4))]);
  tokens.max = wave < 3 ? 1 : 2;
  const base = r() * Math.PI * 2;
  plan.forEach((k, i) => {
    const a = base + (i - plan.length / 2) * 0.35;
    const d = 22 + r() * 6;
    const x = clamp(player.x + Math.cos(a) * d, -60, 60), z = clamp(player.z + Math.sin(a) * d, -60, 60);
    const f = new Fighter(R, KITS[k], x, z, 1);
    f.yaw = Math.atan2(player.x - x, player.z - z);
    fighters.push(f);
    brains.set(f.id, new Brain(f));
  });
  banner(`${t("wave")} ${wave}`, plan.map((k) => KITS[k].name[lang]).join(" · "));
  // clear old corpses so the field stays readable
  fighters = fighters.filter((f) => f.alive || f.deadT < 40);
}

// ---------- input ----------
const keys = new Set<string>();
let lmb = false, rmb = false;
let intentX = 0, intentY = 0;
let curDir: Dir = DIR.OVER;
const SENS = 0.0024;

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if (e.code === "F1") { e.preventDefault(); toggleHelp(); return; }
  keys.add(e.code);
  if (!started) return;
  if (e.code === "KeyV") setFirstPerson(!firstPerson);
  if (e.code === "KeyT") hour = (hour + 1) % 24;
  if (e.code === "KeyY") weather.target = weather.target > 0.5 ? 0 : 1;
  if (e.code === "KeyH") { hints = !hints; pushLog(hints ? t("hintsOn") : t("hintsOff"), "sys"); }
  if (e.code === "KeyL") { setLang(lang === "pl" ? "en" : "pl"); applyLang(); }
  if (e.code === "KeyR" && !player.alive) reset();
  if (/^Digit[1-4]$/.test(e.code) && player.alive && player.state === "idle") {
    weaponSlot = Number(e.code.slice(5)) - 1;
    player.kit = playerKit(); player.buildMeshes(R); setFirstPerson(firstPerson);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => { keys.clear(); lmb = rmb = false; });

window.addEventListener("mousemove", (e) => {
  if (!started) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && e.buttons === 0 && !dragLook) return;
  const dx = e.movementX || 0, dy = e.movementY || 0;
  camYaw -= dx * SENS; camPitch = clamp(camPitch - dy * SENS, -1.1, 0.9);
  intentX = intentX * 0.55 + dx; intentY = intentY * 0.55 + dy;
  if (Math.hypot(intentX, intentY) > 2) curDir = dirFromMouse(intentX, intentY);
  if (rmb && player.state === "block") player.block(curDir);
});
let dragLook = false;
canvas.addEventListener("mousedown", (e) => {
  if (!started) return;
  audio.start();
  if (document.pointerLockElement !== canvas) { tryLock(); }
  if (e.button === 0) { lmb = true; if (player.alive) { if (player.attack(curDir)) audio.swing(0.4); } }
  if (e.button === 2) { rmb = true; if (player.state === "windup" || player.state === "hold") player.feint(curDir); else player.block(curDir); }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) lmb = false;
  if (e.button === 2) { rmb = false; player?.unblock(); }
});
function tryLock() {
  try {
    const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => { dragLook = true; });
  } catch { dragLook = true; }
}
document.addEventListener("pointerlockerror", () => { dragLook = true; });

$("title").addEventListener("click", () => {
  started = true; $("title").hidden = true; audio.start(); tryLock(); reset();
});

// ---------- HUD ----------
const log: { s: string; k: string; t: number }[] = [];
function pushLog(s: string, k = "") { log.unshift({ s, k, t: performance.now() }); log.length = Math.min(log.length, 6); renderLog(); }
function renderLog() { $("log").innerHTML = log.map((l) => `<div class="${l.k}">${l.s}</div>`).join(""); }
let bannerT = 0;
function banner(a: string, b = "") { $("banner").innerHTML = `<b>${a}</b><span>${b}</span>`; $("banner").hidden = false; bannerT = 3.2; }
function toggleHelp() { helpOpen = !helpOpen; $("help").hidden = !helpOpen; }
function applyLang() {
  $("help").innerHTML = `<h3>${t("help")}</h3>` + helpRows().map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join("");
  $("deadT").textContent = t("dead"); $("tstart").textContent = t("start"); $("tsub").textContent = t("subtitle");
  player && (player.kit.name = { pl: t("you"), en: t("you") });
}
applyLang();

// ---------- combat resolution ----------
const name = (f: Fighter) => f.kit.name[lang];
function resolve(att: Fighter) {
  att.hitDone = true;
  const fx = Math.sin(att.yaw), fz = Math.cos(att.yaw);
  const a = attackOf(att.weapon, att.dir);
  const cone = a.dir === DIR.THRUST ? 0.82 : 0.4;
  let best: Fighter | null = null, bd = 1e9;
  for (const o of fighters) {
    if (o === att || !o.alive) continue;
    const dx = o.x - att.x, dz = o.z - att.z, d = Math.hypot(dx, dz);
    if (d > att.weapon.reach + 0.8 || d < 0.01) continue;
    if ((dx * fx + dz * fz) / d < cone) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  const o = best;
  const dx = (o.x - att.x) / bd, dz = (o.z - att.z) / bd;
  const ofx = Math.sin(o.yaw), ofz = Math.cos(o.yaw);
  const facing = -(ofx * dx + ofz * dz);  // 1 = defender faces attacker
  const isP = att === player || o === player;
  const vol = isP ? 1 : 0.6;
  if (o.state === "block" && facing > 0.25 && (blockMatches(a.dir, o.dir) || (o.kit.shield && shieldCovers(facing)))) {
    const shield = o.kit.shield && !blockMatches(a.dir, o.dir) ? true : o.kit.shield;
    if (shield) audio.shieldThud(vol); else audio.clang(vol);
    att.enter("blockstun");
    sparks(att.bladeTip, shield ? 4 : 12);
    if (o === player) pushLog(shield ? t("shieldBlock") : t("youBlocked"), "good");
    else if (att === player) pushLog(t("blocked", { who: name(o) }), "warn");
    return;
  }
  if (att.team === o.team && att !== player && o !== player) {
    if (Math.random() < 0.5) return;   // allies mostly pull their blows
  }
  const part = hitPart(a.dir, Math.random());
  const closing = (att.vx - o.vx) * dx + (att.vz - o.vz) * dz;
  const arm = o.kit.armour[part];
  let dmg = damage(a.dmg, a.type, arm, part, closing);
  if (att.team === o.team) dmg = Math.round(dmg * 0.5);
  o.hp -= dmg;
  o.flash = 1;
  o.lastHitBy = att.id;
  audio.hit(a.type === "blunt", vol);
  if (Math.random() < 0.5) audio.grunt(vol * 0.8);
  const hy = o.y + (part === "head" ? 1.72 : part === "body" ? 1.3 : 0.6);
  bleed([o.x - dx * 0.2, hy, o.z - dz * 0.2], dx, dz, 8 + Math.min(20, dmg / 2));
  if (o.hp <= 0) {
    o.hp = 0; o.enter("dead");
    decals.push({ x: o.x + dx * 0.6, y: ground(o.x + dx * 0.6, o.z + dz * 0.6) + 0.02, z: o.z + dz * 0.6, r: Math.random() * 6, s: 1.4 + Math.random() * 0.6 });
    if (o.aiToken) { o.aiToken = false; tokens.used = Math.max(0, tokens.used - 1); }
    if (o !== player) { if (att === player) kills++; pushLog(t("killed", { who: name(o) }), att === player ? "good" : ""); }
    else { $("dead").hidden = false; $("deadSub").textContent = t("deadSub", { n: Math.max(0, wave - 1) }); try { document.exitPointerLock(); } catch { /* */ } }
  } else if (dmg >= 7 || o.attacking) o.stagger();
  if (att === player) pushLog(t("youHit", { who: name(o), part: t(part), dmg, type: t(a.type), arm: o.kit.armour.name[lang] }), "good");
  else if (o === player) pushLog(t("hitYou", { who: name(att), part: t(part), dmg, type: t(a.type) }), "bad");
  else if (att.team === o.team) pushLog(t("friendly", { a: name(att) }), "");
  if (dmg > 2) decals.push({ x: o.x, y: ground(o.x, o.z) + 0.02, z: o.z, r: Math.random() * 6, s: 0.5 + Math.random() * 0.4 });
  if (decals.length > 60) decals.shift();
}

function bleed(p: V3, dx: number, dz: number, n: number) {
  for (let i = 0; i < n; i++) blood.push({ x: p[0], y: p[1], z: p[2], vx: dx * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2, vy: Math.random() * 2.5, vz: dz * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2, life: 0.6 + Math.random() * 0.6, s: 0.04 + Math.random() * 0.05 });
}
function sparks(p: V3, n: number) {
  for (let i = 0; i < n; i++) blood.push({ x: p[0], y: p[1], z: p[2], vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 6, life: 0.25 + Math.random() * 0.25, s: 0.025, spark: true });
}

// ---------- simulation ----------
function collide(f: Fighter) {
  for (const c of colliders) {
    const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz), m = c.r + f.radius;
    if (d < m && d > 0.0001) { f.x = c.x + (dx / d) * m; f.z = c.z + (dz / d) * m; }
  }
  for (const o of fighters) {
    if (o === f || !o.alive || !f.alive) continue;
    const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz), m = f.radius + o.radius;
    if (d < m && d > 0.0001) { const p = (m - d) / 2; f.x += (dx / d) * p; f.z += (dz / d) * p; o.x -= (dx / d) * p; o.z -= (dz / d) * p; }
  }
  const lim = WORLD / 2 - 20;
  f.x = clamp(f.x, -lim, lim); f.z = clamp(f.z, -lim, lim);
}

function step(dt: number) {
  hour = (hour + dt / 60) % 24;
  weather.rain = lerp(weather.rain, weather.target, clamp(dt * 0.35, 0, 1));
  if (weather.rain > 0.7 && Math.random() < dt * 0.04) { lightning = 1; setTimeout(() => audio.thunder(), 600 + Math.random() * 1800); }
  lightning = Math.max(0, lightning - dt * 3);

  if (player.alive && started) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    let mx = 0, mz = 0;
    if (keys.has("KeyW")) { mx += fx; mz += fz; }
    if (keys.has("KeyS")) { mx -= fx; mz -= fz; }
    if (keys.has("KeyA")) { mx += fz; mz -= fx; }
    if (keys.has("KeyD")) { mx -= fz; mz += fx; }
    const l = Math.hypot(mx, mz) || 1;
    player.wish.x = mx / l; player.wish.z = mz / l;
    player.wish.run = keys.has("ShiftLeft") || keys.has("ShiftRight");
    player.yaw = camYaw;
  } else player.wish.x = player.wish.z = 0;

  for (const f of fighters) {
    const b = brains.get(f.id);
    if (b) b.update(dt, player, fighters, tokens);
    const hold = f === player ? lmb : (f.state === "hold" ? false : true);
    const before = f.state;
    f.update(dt, hold);
    if (before !== "release" && f.state === "release" && f !== player) audio.swing(0.5);
    if (before === "hold" && f.state === "release" && f === player) audio.swing(0.6);
    f.move(dt, ground);
    collide(f);
  }
  for (const f of fighters) if (f.impactNow) resolve(f);

  for (const b of blood) {
    b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
    const g = ground(b.x, b.z);
    if (b.y < g) { b.y = g + 0.01; b.vx *= 0.3; b.vz *= 0.3; b.vy = 0; }
  }
  for (let i = blood.length - 1; i >= 0; i--) if (blood[i].life <= 0) blood.splice(i, 1);

  // waves
  const alive = fighters.filter((f) => f.team === 1 && f.alive).length;
  if (player.alive && started) {
    if (alive === 0) {
      if (waveBreak <= 0 && wave > 0) {
        waveBreak = 7; banner(t("cleared"), `${t("kills")}: ${kills}`);
        player.hp = Math.min(player.maxHp, player.hp + 45);
      }
      waveBreak -= dt;
      if (waveBreak <= 0) spawnWave();
    }
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").hidden = true; }
}

// ---------- rain ----------
const DROPS = 1600;
const drops = new Float32Array(DROPS * 3);
for (let i = 0; i < DROPS; i++) { drops[i * 3] = (Math.random() - 0.5) * 50; drops[i * 3 + 1] = Math.random() * 20; drops[i * 3 + 2] = (Math.random() - 0.5) * 50; }
const rainLines = new Float32Array(DROPS * 6);
function updateRain(dt: number, c: V3): number {
  const n = Math.floor(DROPS * weather.rain);
  let k = 0;
  for (let i = 0; i < n; i++) {
    let x = drops[i * 3], y = drops[i * 3 + 1] - dt * 17, z = drops[i * 3 + 2];
    if (y < -2) y += 22;
    drops[i * 3 + 1] = y;
    const wx = c[0] + x, wz = c[2] + z, wy = c[1] + y - 4;
    rainLines[k++] = wx; rainLines[k++] = wy; rainLines[k++] = wz;
    rainLines[k++] = wx + 0.08; rainLines[k++] = wy + 0.55; rainLines[k++] = wz + 0.03;
  }
  return k;
}

// ---------- render ----------
const view = m4(), proj = m4();
function render(dt: number, now: number) {
  R.resize();
  const aspect = canvas.width / Math.max(1, canvas.height);
  let eye: V3, target: V3;
  const cp = Math.cos(camPitch), fx = Math.sin(camYaw) * cp, fy = Math.sin(camPitch), fz = Math.cos(camYaw) * cp;
  if (firstPerson && player.alive) {
    eye = player.eye;
    target = [eye[0] + fx, eye[1] + fy, eye[2] + fz];
  } else {
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const piv: V3 = [player.x + rx * 0.45, player.y + 1.7, player.z + rz * 0.45];
    const dist = player.alive ? 3.1 : 5;
    eye = [piv[0] - fx * dist, piv[1] - fy * dist, piv[2] - fz * dist];
    eye[1] = Math.max(eye[1], ground(eye[0], eye[2]) + 0.35);
    target = [piv[0] + fx, piv[1] + fy, piv[2] + fz];
  }
  if (debugCam) { eye = debugCam[0]; target = debugCam[1]; }
  perspective(proj, (firstPerson ? 75 : 68) * Math.PI / 180, aspect, firstPerson ? 0.06 : 0.12, 700);
  lookAt(view, eye, target);
  R.setCamera(view, proj, eye);

  const L = lighting(hour, weather);
  if (lightning > 0) { L.exposure *= 1 + lightning * 2.5; L.skyColor = L.skyColor.map((v) => v + lightning * 0.6) as V3; }
  const night = clamp(1 - L.sunColor[1] * 1.4, 0, 1);
  const items: DrawItem[] = [
    { mesh: terrainMesh, model: m4() },
    { mesh: sceneryMesh, model: m4() },
  ];
  // fires: flicker + point lights
  scen.fires.forEach((f, i) => {
    const fl = 0.85 + Math.sin(now * 0.011 + i * 3) * 0.08 + Math.sin(now * 0.037 + i) * 0.07;
    const fireK = (1 - weather.rain * 0.4);
    L.points.push({ pos: [f[0], f[1] + 0.4, f[2]], color: [2.6 * fl * fireK, 1.15 * fl * fireK, 0.4 * fl * fireK], radius: 9 + night * 6 });
    const s = 0.8 + Math.sin(now * 0.02 + i) * 0.12;
    items.push({ mesh: flameMesh, model: trs(m4(), f[0], f[1] - 0.45, f[2], now * 0.003 + i, 0, 0, s, s * (0.9 + fl * 0.3), s), tint: [1.6, 0.62, 0.16, -1.4], noShadow: true });
  });
  for (const d of decals) items.push({ mesh: decalMesh, model: trs(m4(), d.x, d.y, d.z, d.r, 0, 0, d.s, 1, d.s), noShadow: true });
  for (const f of fighters) f.draw(items);
  for (const b of blood) {
    const tint: [number, number, number, number] = b.spark ? [2.2, 1.4, 0.6, -1.5] : [0.28, 0.02, 0.02, 1];
    items.push({ mesh: cubeMesh, model: trs(m4(), b.x, b.y, b.z, b.life * 9, b.life * 7, 0, b.s, b.s, b.s), tint, noShadow: true });
  }
  const n = updateRain(dt, eye);
  R.frame(items, L, [player.x, player.y, player.z], n ? { data: rainLines.subarray(0, n), color: [0.62, 0.66, 0.72, 0.28] } : undefined);

  // audio beds
  let fireNear = 0;
  for (const f of scen.fires) fireNear = Math.max(fireNear, clamp(1 - Math.hypot(f[0] - player.x, f[2] - player.z) / 14, 0, 1));
  audio.setBeds(weather.rain, fireNear);

  hud();
}

const chev = { [DIR.OVER]: $("dU"), [DIR.RIGHT]: $("dR"), [DIR.LEFT]: $("dL"), [DIR.THRUST]: $("dD") } as Record<Dir, HTMLElement>;
function hud() {
  const hpP = clamp(player.hp / player.maxHp, 0, 1);
  ($("hpfill") as HTMLElement).style.width = `${hpP * 100}%`;
  $("hptext").textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  const w = player.weapon;
  const types = [w.swing ? t(w.swing.type) : null, w.thrust ? t(w.thrust.type) : null].filter(Boolean).join(" / ");
  $("weapon").innerHTML = `<b>${w.name[lang]}</b><span>${types}${player.kit.shield ? " · " + (lang === "pl" ? "tarcza" : "shield") : ""}</span>`;
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  $("clock").textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} · ${weather.target > 0.5 ? t("rain") : t("clear")} · ${t("wave")} ${wave} · ${t("kills")} ${kills}`;
  // direction chevrons
  let incoming: Dir | -1 = -1;
  if (hints) {
    let bd = 1e9;
    for (const f of fighters) {
      if (f.team === 0 || !f.alive || !(f.state === "windup" || f.state === "hold")) continue;
      const d = Math.hypot(f.x - player.x, f.z - player.z);
      if (d < f.weapon.reach + 2 && d < bd) { bd = d; incoming = mirror(f.dir); }
    }
  }
  for (const k of [0, 1, 2, 3] as Dir[]) {
    const el = chev[k];
    const isCur = k === curDir;
    let cls = "chev";
    if (player.attacking && player.dir === k) cls += " atk";
    else if (player.state === "block" && player.dir === k) cls += " blk";
    else if (isCur) cls += " cur";
    if (incoming === k) cls += " inc";
    el.className = cls;
  }
}

// ---------- loop ----------
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (started && player && !paused) step(dt);
  if (player) render(dt, now);
  else renderIdle(now);
  requestAnimationFrame(loop);
}
// title screen: slow orbit over the field
function renderIdle(now: number) {
  R.resize();
  const a = now * 0.00005;
  const eye: V3 = [Math.sin(a) * 26, height(Math.sin(a) * 26, Math.cos(a) * 26) + 6, Math.cos(a) * 26];
  perspective(proj, 60 * Math.PI / 180, canvas.width / Math.max(1, canvas.height), 0.1, 700);
  lookAt(view, eye, [0, 2, 0]);
  R.setCamera(view, proj, eye);
  const L = lighting(hour, weather);
  for (const f of scen.fires) L.points.push({ pos: f, color: [2.4, 1.05, 0.35], radius: 12 });
  const items: DrawItem[] = [{ mesh: terrainMesh, model: m4() }, { mesh: sceneryMesh, model: m4() }];
  scen.fires.forEach((f, i) => items.push({ mesh: flameMesh, model: trs(m4(), f[0], f[1] - 0.45, f[2], now * 0.003 + i, 0, 0, 0.8, 0.85, 0.8), tint: [1.6, 0.62, 0.16, -1.4], noShadow: true }));
  R.frame(items, L, [0, 0, 0]);
}

// test hooks for the automated smoke test
(window as unknown as { mb2: unknown }).mb2 = {
  get player() { return player; }, get fighters() { return fighters; },
  start() { $("title").click(); },
  setHour(h: number) { hour = h; }, setRain(r: number) { weather.rain = weather.target = r; },
  look(yaw: number, pitch: number) { camYaw = yaw; camPitch = pitch; },
  attack(d: Dir) { player.attack(d); }, block(d: Dir) { player.block(d); },
  fp(v: boolean) { setFirstPerson(v); }, pause(v: boolean) { paused = v; }, cam(e: V3 | null, tg?: V3) { debugCam = e ? [e, tg!] : null; }, spawn() { spawnWave(); },
  freeze(f: Fighter, s: string, d: Dir, tt: number) { f.state = s as never; f.dir = d; f.t = tt; const a = f as unknown as { pose: unknown; targetPose(): unknown }; a.pose = a.targetPose(); },
};
void (null as unknown as Mesh);
requestAnimationFrame(loop);

// mb2 build 1 — "Walka": Warband-style melee on the Gallows Field, rendered in
// the house style (hybrid PS1/PS2 with faceted lighting) using the new
// character rig, gear and combat animations.
import { m4, mul, perspective, lookAt, trs, clamp, lerp, rng, V3 } from "./core/math.ts";
import { PSX, GMesh, Light } from "./char/psx.ts";
import { paintAtlas, downsample, REG } from "./char/atlas.ts";
import { paintGear, paintMailTile } from "./char/gear.ts";
import { LEVELS } from "./char/human.ts";
import { TMesh } from "./char/tmesh.ts";
import { WeaponId, WEAPONS } from "./char/weapons.ts";
import { MeshBuilder, T, hex } from "./gfx/meshbuilder.ts";
import { buildTerrain, height, WORLD } from "./world/terrain.ts";
import { buildScenery, Collider } from "./world/props.ts";
import { Warrior, Kit, WSTATS } from "./game/warrior.ts";
import { Brain } from "./game/ai.ts";
import { locateHit, SEVER, Gib, Zone } from "./game/gore.ts";
import { Joint } from "./char/human.ts";
import { xform } from "./core/math.ts";
import { ARMOURS, DIR, Dir, damage, hitPart, blockMatches, shieldCovers, dirFromMouse, mirror } from "./game/combat.ts";
import { Audio } from "./core/audio.ts";
import { t, lang, setLang, helpRows } from "./core/i18n.ts";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("c") as HTMLCanvasElement;
let R: PSX;
try { R = new PSX(canvas); } catch (e) { $("title").innerHTML = `<h1>WebGL2</h1><p>${String(e)}</p>`; throw e; }
const audio = new Audio();

// ---------- render style: the project standard (hybrid PS1+PS2, faceted light) ----------
const MODE = { ...LEVELS.hfa, fog: [24, 150] as [number, number] };
R.setTexture(0, downsample(paintAtlas(), MODE.tex), MODE.bilinear, false, true);
R.setTexture(1, downsample(paintGear(), MODE.tex), MODE.bilinear, false, true);
R.setTexture(2, paintMailTile(), MODE.bilinear, true);
const white = new ImageData(4, 4); white.data.fill(255);
R.setTexture(3, white, false);

/** Vertex-coloured scenery → retro renderer mesh (white texture, colour from vertices). */
function fromBuilder(b: MeshBuilder, mat = 0) {
  const n = b.pos.length / 3;
  return { pos: b.pos, nor: b.nor, col: b.col, uv: new Array(n * 2).fill(0.5), mats: new Array(n).fill(mat) };
}

// ---------- world ----------
const terrainG = R.upload(fromBuilder(buildTerrain()), 3, false);
const scen = buildScenery();
const sceneryG = R.upload(fromBuilder(scen.mesh), 3, false);
const colliders: Collider[] = scen.colliders;
const ground = (x: number, z: number) => height(x, z);
const flameG = (() => { const b = new MeshBuilder(); b.jitter = 0.15; b.cyl(T(0, 0, 0), 0.3, 0, 0.85, 5, hex(0xe0782a), false); b.cyl(T(0.1, 0, 0.05, 1), 0.17, 0, 0.55, 4, hex(0xf2c24a), false); return R.upload(fromBuilder(b, 3), 3, false); })();
const bloodG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(), 1, 1, 1, hex(0x6a0c08)); return R.upload(fromBuilder(b), 3, false); })();
const sparkG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(), 1, 1, 1, hex(0xffd27a)); return R.upload(fromBuilder(b, 3), 3, false); })();
const decalG = (() => { const b = new MeshBuilder(); b.jitter = 0.25; for (let i = 0; i < 5; i++) { const a = i * 1.3; b.box(T(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, a), 0.6 - i * 0.07, 0.015, 0.45 - i * 0.05, hex(0x3d0a08)); } return R.upload(fromBuilder(b), 3, false); })();
const blobG = (() => { const t = new TMesh(256); t.box(trs(m4(), 0, 0.02, 0), 0.8, 0.001, 0.66, REG.blob); return R.upload(t, 0, false); })();

// ---------- kits ----------
const K = (pl: string, en: string, loadout: Kit["loadout"], weapon: WeaponId, shield: boolean, armour: keyof typeof ARMOURS, hp: number, skill: number): Kit =>
  ({ name: { pl, en }, loadout, weapon, shield, armour: ARMOURS[armour], hp, skill });
const KITS: Record<string, Kit> = {
  bandit: K("Rozbójnik", "Brigand", "base", "hatchet", false, "rags", 80, 0.3),
  levy: K("Pachołek z włócznią", "Spear levy", "levy", "spear", false, "gambeson", 85, 0.4),
  sergeant: K("Zbrojny", "Sergeant", "sergeant", "sword", true, "mail", 100, 0.55),
  plate: K("Zbrojny w płytach", "Plated man-at-arms", "plate", "mace", false, "plate", 110, 0.68),
  glaive: K("Halabardnik", "Glaiveman", "levy", "glaive", false, "gambeson", 95, 0.55),
  knight: K("Rycerz Kruka", "Raven knight", "knight", "longsword", false, "plate", 125, 0.78),
};
const PLAYER_WEAPONS: WeaponId[] = ["sword", "kord", "hatchet", "mace", "longsword", "greataxe", "spear", "glaive"];
let weaponSlot = 0;
const playerKit = (): Kit => ({ name: { pl: t("you"), en: t("you") }, loadout: "knight", weapon: PLAYER_WEAPONS[weaponSlot], shield: true, armour: ARMOURS.mail, hp: 130, skill: 1 });
const wName = (w: WeaponId) => WEAPONS[w].name;

// ---------- state ----------
let player!: Warrior;
let fighters: Warrior[] = [];
const brains = new Map<number, Brain>();
const tokens = { used: 0, max: 1 };
let wave = 0, kills = 0, waveBreak = 0, started = false, paused = false;
let hour = 16.8;
let firstPerson = false, hints = true, autoBlock = false, helpOpen = false;
let camYaw = Math.PI, camPitch = -0.1;
let botWish: [number, number] | null = null;
let noAI = false;   // test hook   // test hook: drive the player without a keyboard

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; s: number; spark: boolean }
const parts: Particle[] = [];
const decals: { x: number; y: number; z: number; r: number; s: number; s1: number }[] = [];
let hurt = 0;

function reset() {
  fighters = []; brains.clear(); tokens.used = 0; parts.length = 0; decals.length = 0; gibs.length = 0; spurts.length = 0; hurt = 0;
  wave = 0; kills = 0; waveBreak = 2.5;
  player = new Warrior(R, playerKit(), 0, 4, 0);
  player.yaw = camYaw;
  fighters.push(player);
  player.hideHead = firstPerson;
  $("dead").hidden = true;
  log.length = 0; renderLog();
}

function spawnWave() {
  wave++;
  const r = rng(wave * 31 + 7);
  const plan: string[] =
    wave === 1 ? ["bandit"] :
    wave === 2 ? ["bandit", "levy"] :
    wave === 3 ? ["sergeant", "bandit"] :
    wave === 4 ? ["plate", "levy", "bandit"] :
    wave === 5 ? ["glaive", "sergeant", "bandit"] :
    wave === 6 ? ["knight", "levy", "sergeant"] :
    Array.from({ length: Math.min(6, 2 + Math.floor(wave / 2)) }, () => ["bandit", "levy", "sergeant", "plate", "glaive", "knight"][Math.floor(r() * 6)]);
  tokens.max = wave < 4 ? 1 : 2;
  const base = r() * Math.PI * 2;
  plan.forEach((k, i) => {
    const a = base + (i - plan.length / 2) * 0.4, d = 20 + r() * 6;
    const x = clamp(player.x + Math.cos(a) * d, -60, 60), z = clamp(player.z + Math.sin(a) * d, -60, 60);
    const f = new Warrior(R, KITS[k], x, z, 1);
    f.yaw = Math.atan2(player.x - x, player.z - z);
    fighters.push(f); brains.set(f.id, new Brain(f));
  });
  banner(`${t("wave")} ${wave}`, plan.map((k) => KITS[k].name[lang]).join(" · "));
  fighters = fighters.filter((f) => f.alive || f.deadT < 40);
}

// ---------- input ----------
const keys = new Set<string>();
let lmb = false, rmb = false, dragLook = false;
let intentX = 0, intentY = 0;
let curDir: Dir = DIR.OVER;
const SENS = 0.0024;

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if (e.code === "F1") { e.preventDefault(); toggleHelp(); return; }
  keys.add(e.code);
  if (!started) return;
  if (e.code === "KeyV") { firstPerson = !firstPerson; player.hideHead = firstPerson; }
  if (e.code === "KeyT") hour = (hour + 1) % 24;
  if (e.code === "KeyH") { hints = !hints; pushLog(hints ? t("hintsOn") : t("hintsOff"), "sys"); }
  if (e.code === "KeyB") { autoBlock = !autoBlock; pushLog(autoBlock ? t("autoOn") : t("autoOff"), "sys"); }
  if (e.code === "KeyL") { setLang(lang === "pl" ? "en" : "pl"); applyLang(); }
  if (e.code === "KeyR" && !player.alive) reset();
  if (/^Digit[1-8]$/.test(e.code) && player.alive && player.state === "idle") {
    weaponSlot = Number(e.code.slice(5)) - 1;
    player.setKit(R, playerKit());
    pushLog(wName(player.weaponId), "sys");
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
});
canvas.addEventListener("mousedown", (e) => {
  if (!started) return;
  audio.start();
  if (document.pointerLockElement !== canvas) tryLock();
  if (!player.alive) return;
  if (e.button === 0) { lmb = true; if (player.attack(curDir)) audio.swing(0.35); }
  if (e.button === 2) { rmb = true; const d = blockDir(); if (player.state === "windup" || player.state === "hold") player.feint(d); else player.block(d); }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) lmb = false;
  if (e.button === 2) { rmb = false; player?.unblock(); }
});
function tryLock() {
  try { const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined; if (p && typeof p.catch === "function") p.catch(() => { dragLook = true; }); } catch { dragLook = true; }
}
document.addEventListener("pointerlockerror", () => { dragLook = true; });
$("title").addEventListener("click", () => { started = true; $("title").hidden = true; audio.start(); tryLock(); reset(); });

/** Direction of the most threatening enemy wind-up, from the player's side. */
function threat(): Dir | -1 {
  let bd = 1e9, d: Dir | -1 = -1;
  for (const f of fighters) {
    if (f.team === player.team || !f.alive || !f.attacking) continue;
    const dist = Math.hypot(f.x - player.x, f.z - player.z);
    if (dist < f.weapon.reach + 2.2 && dist < bd) { bd = dist; d = mirror(f.dir); }
  }
  return d;
}
function blockDir(): Dir { if (autoBlock) { const d = threat(); if (d !== -1) return d; } return curDir; }

// ---------- HUD ----------
const log: { s: string; k: string }[] = [];
function pushLog(s: string, k = "") { log.unshift({ s, k }); log.length = Math.min(log.length, 6); renderLog(); }
function renderLog() { $("log").innerHTML = log.map((l) => `<div class="${l.k}">${l.s}</div>`).join(""); }
let bannerT = 0;
function banner(a: string, b = "") { $("banner").innerHTML = `<b>${a}</b><span>${b}</span>`; $("banner").hidden = false; bannerT = 3.2; }
function toggleHelp() { helpOpen = !helpOpen; $("help").hidden = !helpOpen; }
function applyLang() {
  $("help").innerHTML = `<h3>${t("help")}</h3>` + helpRows().map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join("");
  $("deadT").textContent = t("dead"); $("tstart").textContent = t("start"); $("tsub").textContent = t("subtitle");
}
applyLang();

// ---------- combat resolution (at the impact moment of release_) ----------
const nm = (f: Warrior) => f === player ? t("you") : f.kit.name[lang];
function resolve(att: Warrior) {
  att.hitDone = true;
  const ws = att.weapon, dir = att.dir;
  const atk = dir === DIR.THRUST ? ws.thrust! : ws.swing!;
  const raw = atk.dmg * (dir === DIR.OVER ? 1.08 : 1);
  const fx = Math.sin(att.yaw), fz = Math.cos(att.yaw);
  const cone = dir === DIR.THRUST ? 0.8 : 0.3;
  let best: Warrior | null = null, bd = 1e9;
  for (const o of fighters) {
    if (o === att || !o.alive) continue;
    const dx = o.x - att.x, dz = o.z - att.z, d = Math.hypot(dx, dz);
    if (d > ws.reach + 0.75 || d < 0.01) continue;
    if ((dx * fx + dz * fz) / d < cone) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  const o = best;
  const dx = (o.x - att.x) / bd, dz = (o.z - att.z) / bd;
  const facing = -(Math.sin(o.yaw) * dx + Math.cos(o.yaw) * dz);
  const near = att === player || o === player, vol = near ? 1 : 0.55;
  if (o.state === "block" && facing > 0.2) {
    const shield = o.hasShield && shieldCovers(facing);
    if (shield || blockMatches(dir, o.dir)) {
      att.bounce(shield);
      if (shield) audio.shieldThud(vol); else audio.clang(vol);
      sparks(att.tip(), shield ? 4 : 14);
      if (o === player) pushLog(shield ? t("shieldBlock") : t("youBlocked"), "good");
      else if (att === player) pushLog(t("blocked", { who: nm(o) }), "warn");
      return;
    }
  }
  if (att.team === o.team && Math.random() < 0.5) return;
  // where does the blade land? (from the attacker's actual weapon pose)
  const aimY = att === player ? camPitch * 0.9 : (Math.random() - 0.6) * 0.5;
  let zone: Zone = "body", joint: Joint = "torso", hp: V3 = o.chest;
  if (att.weaponMat && o.lastJ) {
    const h = locateHit(att.weaponMat, WEAPONS[att.weaponId].tip, [fx, 0, fz], [att.x, att.y, att.z], o.lastJ, [o.x, o.y, o.z], aimY);
    zone = h.zone; joint = h.joint; hp = h.point;
  }
  const part = zone === "arm" ? "body" : zone;
  const closing = (att.vx - o.vx) * dx + (att.vz - o.vz) * dz;
  const tooClose = dir !== DIR.THRUST && bd < 0.55 ? 0.55 : 1;
  const zoneMult = zone === "arm" ? 0.72 : 1;
  let dmg = Math.round(damage(raw * zoneMult, atk.type, o.kit.armour[part], part, closing) * tooClose);
  if (att.team === o.team) dmg = Math.round(dmg * 0.5);
  o.hp -= dmg; o.flash = 1; o.lastHitBy = att.id;
  audio.hit(atk.type === "blunt", vol);
  if (Math.random() < 0.6) audio.grunt(vol * 0.8);
  bleed(hp, dx, dz, 16 + Math.min(40, dmg));
  if (o === player) hurt = Math.min(1, hurt + 0.35 + dmg / 80);
  const lethal = o.hp <= 0;
  // dismemberment: cutting blows that kill, or heavy cuts to limbs
  let gore: string | null = null;
  if (atk.type === "cut") {
    if (zone === "head" && lethal) gore = "head";
    else if (zone === "arm" && (lethal || dmg >= 30) && SEVER[joint]) gore = joint;
    else if (zone === "legs" && (lethal || dmg >= 34) && SEVER[joint]) gore = joint;
  }
  if (gore) sever(o, gore as Joint, dx, dz, att);
  if (lethal || gore) {
    o.hp = 0;
    if (o.alive) o.die();
    decals.push({ x: o.x + dx * 0.5, y: ground(o.x + dx * 0.5, o.z + dz * 0.5) + 0.02, z: o.z + dz * 0.5, r: Math.random() * 6, s: 0.4, s1: 1.8 + Math.random() * 0.8 });
    if (atk.type === "blunt" && zone === "head") bleed(hp, dx, dz, 50);
    if (o.aiToken) { o.aiToken = false; tokens.used = Math.max(0, tokens.used - 1); }
    if (o !== player) { if (att === player) kills++; pushLog(goreText(gore, att, o) ?? t("killed", { who: nm(o) }), att === player ? "good" : ""); }
    else { $("dead").hidden = false; $("deadSub").textContent = t("deadSub", { n: Math.max(0, wave - 1) }); try { document.exitPointerLock(); } catch { /* */ } }
  } else if (dmg >= 6 || o.attacking) o.stagger();
  const zn = zone === "arm" ? (lang === "pl" ? "ręka" : "arm") : t(zone);
  if (att === player) pushLog(t("youHit", { who: nm(o), part: zn, dmg, type: t(atk.type), arm: o.kit.armour.name[lang] }), "good");
  else if (o === player) pushLog(t("hitYou", { who: nm(att), part: zn, dmg, type: t(atk.type) }), "bad");
  if (dmg > 2) decals.push({ x: hp[0], y: ground(hp[0], hp[2]) + 0.02, z: hp[2], r: Math.random() * 6, s: 0.3, s1: 0.5 + Math.random() * 0.5 });
  while (decals.length > 160) decals.shift();
}
function goreText(g: string | null, a: Warrior, o: Warrior) {
  if (!g) return null;
  const pl = lang === "pl";
  if (g === "head") return pl ? `${nm(a)} ścina głowę: ${nm(o)}` : `${nm(a)} beheads ${nm(o)}`;
  if (g.startsWith("uarm") || g.startsWith("farm")) return pl ? `${nm(a)} odrąbuje rękę: ${nm(o)}` : `${nm(a)} hacks off an arm: ${nm(o)}`;
  return pl ? `${nm(a)} odcina nogę: ${nm(o)}` : `${nm(a)} cuts off a leg: ${nm(o)}`;
}

// ---------- dismemberment ----------
const gibs: Gib[] = [];
const spurts: { w: Warrior; parent: Joint; at: V3; dir: V3; t: number }[] = [];
function sever(o: Warrior, joint: Joint, dx: number, dz: number, att: Warrior) {
  const info = SEVER[joint]; const J = o.lastJ;
  if (!info || !J || o.severed.has(joint)) return;
  const pieces: { mesh: GMesh; M0: Float32Array }[] = [];
  for (const p of o.mesh.parts) if (info.chain.includes(p.joint)) pieces.push({ mesh: p.mesh, M0: J[p.joint] });
  if (info.chain.includes("handR") && o.weaponMat) pieces.push({ mesh: o.mesh.weapon, M0: o.weaponMat });
  if (info.chain.includes("farmL") && o.shieldMat && o.mesh.shield && o.hasShield) pieces.push({ mesh: o.mesh.shield, M0: o.shieldMat });
  const c = xform(J[joint], 0, joint === "head" ? 0.14 : -0.16, 0) as V3;
  const side = (Math.random() - 0.5) * 1.5;
  const up = joint === "head" ? 3.4 : 2.2;
  const vel: V3 = [dx * 2.4 - dz * side + att.vx * 0.3, up + Math.random() * 1.2, dz * 2.4 + dx * side + att.vz * 0.3];
  gibs.push(new Gib(pieces, c, vel));
  while (gibs.length > 40) gibs.shift();
  for (const j of info.chain) o.severed.add(j);
  spurts.push({ w: o, parent: info.parent, at: info.at, dir: info.dir, t: 0 });
  const P = xform(J[info.parent], ...info.at) as V3;
  bleed(P, dx, dz, 60);
}
function bleed(p: V3, dx: number, dz: number, n: number) {
  for (let i = 0; i < n && parts.length < 900; i++) {
    const sp = 1 + Math.random() * 3.2;
    parts.push({ x: p[0], y: p[1], z: p[2], vx: dx * sp + (Math.random() - 0.5) * 2.6, vy: Math.random() * 3.2 - 0.3, vz: dz * sp + (Math.random() - 0.5) * 2.6, life: 0.7 + Math.random() * 0.9, s: 0.03 + Math.random() * 0.06, spark: false });
  }
}
function sparks(p: V3, n: number) {
  for (let i = 0; i < n; i++) parts.push({ x: p[0], y: p[1], z: p[2], vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 6, life: 0.2 + Math.random() * 0.25, s: 0.022, spark: true });
}

// ---------- simulation ----------
function collide(f: Warrior) {
  for (const c of colliders) {
    const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz), m = c.r + f.radius;
    if (d < m && d > 1e-4) { f.x = c.x + (dx / d) * m; f.z = c.z + (dz / d) * m; }
  }
  for (const o of fighters) {
    if (o === f || !o.alive || !f.alive) continue;
    const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz), m = f.radius + o.radius;
    if (d < m && d > 1e-4) { const p = (m - d) / 2; f.x += (dx / d) * p; f.z += (dz / d) * p; o.x -= (dx / d) * p; o.z -= (dz / d) * p; }
  }
  const lim = WORLD / 2 - 20;
  f.x = clamp(f.x, -lim, lim); f.z = clamp(f.z, -lim, lim);
}

function step(dt: number) {
  hour = (hour + dt / 60) % 24;
  if (player.alive && started) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    let mx = 0, mz = 0;
    if (keys.has("KeyW")) { mx += fx; mz += fz; }
    if (keys.has("KeyS")) { mx -= fx; mz -= fz; }
    if (keys.has("KeyA")) { mx += fz; mz -= fx; }
    if (keys.has("KeyD")) { mx -= fz; mz += fx; }
    if (botWish) { mx = botWish[0]; mz = botWish[1]; }
    const l = Math.hypot(mx, mz) || 1;
    player.wish.x = mx / l; player.wish.z = mz / l;
    player.wish.run = keys.has("ShiftLeft") || keys.has("ShiftRight");
    player.yaw = camYaw;
    if (rmb && player.state === "block") { const d = blockDir(); if (d !== player.dir) player.block(d); }
    if (rmb && player.state === "idle") player.block(blockDir());
  } else player.wish.x = player.wish.z = 0;

  for (const f of fighters) {
    const b = brains.get(f.id);
    if (b && !noAI) b.update(dt, player, fighters, tokens);
    let hold: boolean;
    if (f === player) hold = lmb;
    else { f.aiHold -= dt; hold = f.aiHold > 0; }
    const before = f.state;
    f.update(dt, hold);
    if (before !== "release" && f.state === "release") audio.swing(f === player ? 0.6 : 0.4);
    f.move(dt, ground);
    collide(f);
  }
  for (const f of fighters) if (f.impactNow) resolve(f);

  for (const p of parts) {
    p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
    const g = ground(p.x, p.z);
    if (p.y < g) {
      if (!p.spark && p.vy < -1 && Math.random() < 0.12) decals.push({ x: p.x, y: g + 0.015, z: p.z, r: Math.random() * 6, s: 0.12, s1: 0.18 + Math.random() * 0.3 });
      p.y = g + 0.01; p.vx *= 0.3; p.vz *= 0.3; p.vy = 0;
    }
  }
  while (decals.length > 160) decals.shift();
  for (const d of decals) d.s = Math.min(d.s1, d.s + dt * 0.35);
  // gibs fly and bleed; stumps pump blood for a few seconds
  for (const g of gibs) {
    g.step(dt, ground);
    if (g.moving && Math.random() < 0.8) bleed(g.pos, 0, 0, 1);
  }
  for (let i = spurts.length - 1; i >= 0; i--) {
    const sp = spurts[i]; sp.t += dt;
    const J = sp.w.lastJ; if (!J || sp.t > 4) { spurts.splice(i, 1); continue; }
    const M = J[sp.parent], P = xform(M, ...sp.at) as V3;
    const D = [M[0] * sp.dir[0] + M[4] * sp.dir[1] + M[8] * sp.dir[2], M[1] * sp.dir[0] + M[5] * sp.dir[1] + M[9] * sp.dir[2], M[2] * sp.dir[0] + M[6] * sp.dir[1] + M[10] * sp.dir[2]];
    const pulse = 0.5 + 0.5 * Math.sin(sp.t * 11), rate = (1 - sp.t / 4) * (2 + pulse * 6);
    for (let k = 0; k < rate && parts.length < 900; k++) {
      const v = 1.5 + pulse * 2.5;
      parts.push({ x: P[0], y: P[1], z: P[2], vx: D[0] * v + (Math.random() - 0.5) * 0.8, vy: D[1] * v + 0.8 + Math.random(), vz: D[2] * v + (Math.random() - 0.5) * 0.8, life: 0.8 + Math.random() * 0.6, s: 0.03 + Math.random() * 0.04, spark: false });
    }
  }
  hurt = Math.max(0, hurt - dt * 0.9);
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);

  const alive = fighters.filter((f) => f.team === 1 && f.alive).length;
  if (player.alive && started && alive === 0) {
    if (waveBreak <= 0 && wave > 0) { waveBreak = 6; banner(t("cleared"), `${t("kills")}: ${kills}`); player.hp = Math.min(player.maxHp, player.hp + 45); }
    waveBreak -= dt;
    if (waveBreak <= 0) spawnWave();
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").hidden = true; }
}

// ---------- lighting by hour (tuned for the retro renderer) ----------
type LP = { col: number[]; amb: number[]; rim: number[]; fog: number[]; sky: number[][] };
const DAY: LP = { col: [0.95, 0.9, 0.8], amb: [0.5, 0.51, 0.56], rim: [0.14, 0.15, 0.18], fog: [0.56, 0.6, 0.66], sky: [[0.55, 0.6, 0.68], [0.95, 0.95, 0.92], [0.2, 0.17, 0.13]] };
const DUSK: LP = { col: [1.15, 0.56, 0.3], amb: [0.24, 0.21, 0.28], rim: [0.35, 0.16, 0.1], fog: [0.42, 0.26, 0.22], sky: [[0.2, 0.2, 0.32], [1.1, 0.55, 0.3], [0.1, 0.07, 0.06]] };
const NIGHT: LP = { col: [0.13, 0.16, 0.26], amb: [0.1, 0.11, 0.16], rim: [0.06, 0.07, 0.12], fog: [0.05, 0.06, 0.09], sky: [[0.03, 0.04, 0.07], [0.12, 0.1, 0.12], [0.02, 0.02, 0.02]] };
const mixLP = (a: LP, b: LP, k: number): LP => ({
  col: a.col.map((v, i) => lerp(v, b.col[i], k)), amb: a.amb.map((v, i) => lerp(v, b.amb[i], k)), rim: a.rim.map((v, i) => lerp(v, b.rim[i], k)),
  fog: a.fog.map((v, i) => lerp(v, b.fog[i], k)), sky: a.sky.map((r, j) => r.map((v, i) => lerp(v, b.sky[j][i], k))),
});
function lightAt(h: number, focus: V3): Light & { bg: number[] } {
  let p: LP;
  if (h >= 8 && h < 16.5) p = DAY;
  else if (h >= 16.5 && h < 18.5) p = mixLP(DAY, DUSK, (h - 16.5) / 2);
  else if (h >= 18.5 && h < 20) p = mixLP(DUSK, NIGHT, (h - 18.5) / 1.5);
  else if (h >= 20 || h < 5) p = NIGHT;
  else if (h < 6.5) p = mixLP(NIGHT, DUSK, (h - 5) / 1.5);
  else p = mixLP(DUSK, DAY, (h - 6.5) / 1.5);
  const ang = ((h - 6) / 12) * Math.PI;
  let sd = [Math.cos(ang), Math.max(0.25, Math.abs(Math.sin(ang))), -0.45];
  const l = Math.hypot(sd[0], sd[1], sd[2]); sd = sd.map((v) => v / l);
  // nearest fire becomes the point light
  let best: number[] | null = null, bd = 1e9;
  for (const f of scen.fires) { const d = Math.hypot(f[0] - focus[0], f[2] - focus[2]); if (d < bd) { bd = d; best = f; } }
  const night = clamp(1 - p.col[1] * 1.2, 0, 1);
  const point = best && bd < 22 ? { pos: [best[0], best[1] + 0.4, best[2]], col: [2.2 * (0.35 + night), 1.05 * (0.35 + night), 0.38 * (0.35 + night)], rad: 9 + night * 5 } : undefined;
  return { dir: sd, col: p.col, amb: p.amb, rim: p.rim, fog: p.fog, sky: p.sky, bg: p.fog, point };
}

// ---------- render ----------
const view = m4(), proj = m4(), vp = m4();
let lastPhase = 0;
function render(now: number) {
  resize();
  const aspect = canvas.width / Math.max(1, canvas.height);
  let eye: V3, target: V3;
  const cp = Math.cos(camPitch), fx = Math.sin(camYaw) * cp, fy = Math.sin(camPitch), fz = Math.cos(camYaw) * cp;
  if (firstPerson && player.alive) {
    eye = player.eye; target = [eye[0] + fx, eye[1] + fy, eye[2] + fz];
  } else {
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const piv: V3 = [player.x + rx * 0.55, player.y + 1.82, player.z + rz * 0.55];
    const dist = player.alive ? 3.3 : 4.8;
    eye = [piv[0] - fx * dist, piv[1] - fy * dist, piv[2] - fz * dist];
    eye[1] = Math.max(eye[1], ground(eye[0], eye[2]) + 0.35);
    target = [piv[0] + fx, piv[1] + fy, piv[2] + fz];
  }
  const near = firstPerson ? 0.05 : 0.1, far = 260;
  perspective(proj, (firstPerson ? 74 : 66) * Math.PI / 180, aspect, near, far);
  lookAt(view, eye, target); mul(vp, proj, view);
  const L = lightAt(hour, [player.x, player.y, player.z]);
  const items: { mesh: GMesh; model: Float32Array }[] = [{ mesh: terrainG, model: m4() }, { mesh: sceneryG, model: m4() }];
  scen.fires.forEach((f, i) => {
    const fl = 0.85 + Math.sin(now * 0.011 + i * 3) * 0.1 + Math.sin(now * 0.037 + i) * 0.08;
    items.push({ mesh: flameG, model: trs(m4(), f[0], f[1] - 0.45, f[2], now * 0.003 + i, 0, 0, 0.85, 0.75 + fl * 0.35, 0.85) });
  });
  for (const d of decals) items.push({ mesh: decalG, model: trs(m4(), d.x, d.y, d.z, d.r, 0, 0, d.s, 1, d.s) });
  for (const g of gibs) g.draw(items);
  for (const sp of spurts) { const J = sp.w.lastJ; if (J) items.push({ mesh: bloodG, model: mul(m4(), J[sp.parent], trs(m4(), sp.at[0], sp.at[1], sp.at[2], 0, 0, 0, 0.1, 0.035, 0.1)) }); }
  for (const f of fighters) for (const j of f.severed) { const info = SEVER[j]; if (info && !f.severed.has(info.parent) && f.lastJ) items.push({ mesh: bloodG, model: mul(m4(), f.lastJ[info.parent], trs(m4(), info.at[0], info.at[1], info.at[2], 0, 0, 0, 0.11, 0.04, 0.11)) }); }
  for (const f of fighters) {
    items.push({ mesh: blobG, model: trs(m4(), f.x, f.y, f.z, f.yaw) });
    f.draw(items);
  }
  for (const p of parts) items.push({ mesh: p.spark ? sparkG : bloodG, model: trs(m4(), p.x, p.y, p.z, p.life * 9, p.life * 7, 0, p.s, p.s, p.s) });
  if (L.point) L.point.pos[1] += Math.sin(now * 0.013) * 0.04;
  items.sort((a, b) => a.mesh.tex - b.mesh.tex);
  R.render(MODE, vp, eye, L, items, false, L.bg, near, far);
  ($("hurt") as HTMLElement).style.opacity = String(hurt);
  hud();
  void lastPhase;
}
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

const chev = { [DIR.OVER]: $("dU"), [DIR.RIGHT]: $("dR"), [DIR.LEFT]: $("dL"), [DIR.THRUST]: $("dD") } as Record<Dir, HTMLElement>;
function hud() {
  const hpP = clamp(player.hp / player.maxHp, 0, 1);
  ($("hpfill") as HTMLElement).style.width = `${hpP * 100}%`;
  $("hptext").textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  const ws = WSTATS[player.weaponId];
  const types = [ws.swing ? t(ws.swing.type) : null, ws.thrust ? t(ws.thrust.type) : null].filter(Boolean).join(" / ");
  $("weapon").innerHTML = `<b>${wName(player.weaponId)}</b><span>${types}${player.hasShield ? " · " + (lang === "pl" ? "tarcza" : "shield") : ""}${autoBlock ? " · auto-blok" : ""}</span>`;
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  $("clock").textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} · ${t("wave")} ${wave} · ${t("kills")} ${kills}`;
  const incoming = hints ? threat() : -1;
  for (const k of [0, 1, 2, 3] as Dir[]) {
    let cls = "chev";
    if (player.attacking && player.dir === k) cls += " atk";
    else if (player.state === "block" && player.dir === k) cls += " blk";
    else if (k === curDir) cls += " cur";
    if (incoming === k) cls += " inc";
    chev[k].className = cls;
  }
}

// ---------- title screen: slow orbit ----------
function renderIdle(now: number) {
  resize();
  const a = now * 0.00005;
  const eye: V3 = [Math.sin(a) * 26, height(Math.sin(a) * 26, Math.cos(a) * 26) + 6, Math.cos(a) * 26];
  perspective(proj, 60 * Math.PI / 180, canvas.width / Math.max(1, canvas.height), 0.1, 260);
  lookAt(view, eye, [0, 2, 0]); mul(vp, proj, view);
  const L = lightAt(hour, [0, 0, 0]);
  const items: { mesh: GMesh; model: Float32Array }[] = [{ mesh: terrainG, model: m4() }, { mesh: sceneryG, model: m4() }];
  scen.fires.forEach((f, i) => items.push({ mesh: flameG, model: trs(m4(), f[0], f[1] - 0.45, f[2], now * 0.003 + i, 0, 0, 0.85, 0.9, 0.85) }));
  R.render(MODE, vp, eye, L, items, false, L.bg, 0.1, 260);
}

// ---------- loop ----------
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started && player && !paused) step(dt);
  if (player) render(now); else renderIdle(now);
  requestAnimationFrame(loop);
}

// hooks for automated tests
(window as unknown as { mb2: unknown }).mb2 = {
  get player() { return player; }, get fighters() { return fighters; },
  start() { $("title").click(); }, setHour(h: number) { hour = h; }, pause(v: boolean) { paused = v; },
  look(yaw: number, pitch: number) { camYaw = yaw; camPitch = pitch; },
  attack(d: Dir) { player.attack(d); }, block(d: Dir) { player.block(d); }, unblock() { player.unblock(); }, spawn() { spawnWave(); },
  setLmb(v: boolean) { lmb = v; }, tick(sec: number) { for (let i = 0; i < sec * 60; i++) step(1 / 60); }, noAI(v: boolean) { noAI = v; }, gibs: () => gibs.length, bot(x: number, z: number) { botWish = [x, z]; }, weapon(i: number) { weaponSlot = i; player.setKit(R, playerKit()); },
};
requestAnimationFrame(loop);

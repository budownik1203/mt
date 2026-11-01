// mb2 build 1 — "Walka": Warband-style melee on the Gallows Field, rendered in
// the house style (hybrid PS1/PS2 with faceted lighting) using the new
// character rig, gear and combat animations.
import { m4, mul, perspective, lookAt, trs, clamp, lerp, rng, V3 } from "./core/math.ts";
import { PSX, GMesh, Light } from "./char/psx.ts";
import { paintAtlas, downsample, REG, grime } from "./char/atlas.ts";
import { paintGear, paintMailTile } from "./char/gear.ts";
import { LEVELS } from "./char/human.ts";
import { TMesh } from "./char/tmesh.ts";
import { WeaponId, WEAPONS } from "./char/weapons.ts";
import { MeshBuilder, T, hex } from "./gfx/meshbuilder.ts";
import { buildTerrain, height, WORLD, setBattlefield, setClassicField, BattleBiome } from "./world/terrain.ts";
import { Campaign, Party } from "./map/campaign.ts";
import { MapUI } from "./map/ui.ts";
import { buildMapTerrain, buildMapFeatures, settlementModel, partyFigure } from "./map/mapmesh.ts";
import { biomeAt, cellOf, cellIndex, MAP } from "./map/world.ts";
import { TroopId, kitOf, TROOPS, DEFAULT_GROUP } from "./map/troops.ts";
import { invert } from "./core/math.ts";
import { settings, saveSettings, RES } from "./core/settings.ts";
import { openOptions } from "./core/optionsui.ts";
import { heroHp, profOf, undeadLimit } from "./map/hero.ts";
import { undeadCount, corrupt, spawnHunters } from "./map/necro.ts";
import { FACTIONS, FIDS, spawnLord } from "./map/factions.ts";
import { spawnMonster } from "./map/monsters.ts";
import { boon, troopFaith } from "./map/faith.ts";
import { EVENTS } from "./map/events.ts";
import { Group, Order, newGroups, slotWorld, engageRadius, FORMATIONS, ORDER_NAMES, FORM_NAMES, ROUT, RALLY, FIRE_NAMES } from "./game/tactics.ts";
import { buildScenery, Collider } from "./world/props.ts";
import { Warrior, Kit, WSTATS } from "./game/warrior.ts";
import { Brain } from "./game/ai.ts";
import { locateHit, SEVER, Gib, Zone } from "./game/gore.ts";
import { Joint } from "./char/human.ts";
import { xform } from "./core/math.ts";
import { DmgType, ARMOURS, DIR, Dir, damage, hitPart, blockMatches, shieldCovers, dirFromMouse, mirror } from "./game/combat.ts";
import { Audio } from "./core/audio.ts";
import { t, lang, setLang, helpRows } from "./core/i18n.ts";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("c") as HTMLCanvasElement;
let R: PSX;
try { R = new PSX(canvas); } catch (e) { $("title").innerHTML = `<h1>WebGL2</h1><p>${String(e)}</p>`; throw e; }
const audio = new Audio();

// ---------- render style: the project standard (hybrid PS1+PS2, faceted light) ----------
const MODE = { ...LEVELS.hfa, fog: [12, 105] as [number, number], post: 3 };   // grimdark grade, closer murk
R.setTexture(0, downsample(grime(paintAtlas(), 3, 0.35), MODE.tex), MODE.bilinear, false, true);
R.setTexture(1, downsample(grime(paintGear(), 8, 0.9), MODE.tex), MODE.bilinear, false, true);
R.setTexture(2, paintMailTile(), MODE.bilinear, true);
const white = new ImageData(4, 4); white.data.fill(255);
R.setTexture(3, white, false);

/** Vertex-coloured scenery → retro renderer mesh (white texture, colour from vertices). */
function fromBuilder(b: MeshBuilder, mat = 0) {
  const n = b.pos.length / 3;
  return { pos: b.pos, nor: b.nor, col: b.col, uv: new Array(n * 2).fill(0.5), mats: new Array(n).fill(mat) };
}

// ---------- world ----------
let terrainG = R.upload(fromBuilder(buildTerrain()), 3, false);
let scen = buildScenery();
let sceneryG = R.upload(fromBuilder(scen.mesh), 3, false);
let colliders: Collider[] = scen.colliders;
/** Rebuild the battle scene for the current battlefield setup (biome, season, road). */
function rebuildField() {
  R.free(terrainG); R.free(sceneryG);
  terrainG = R.upload(fromBuilder(buildTerrain()), 3, false);
  scen = buildScenery();
  sceneryG = R.upload(fromBuilder(scen.mesh), 3, false);
  colliders = scen.colliders;
}
const ground = (x: number, z: number) => height(x, z);
const flameG = (() => { const b = new MeshBuilder(); b.jitter = 0.15; b.cyl(T(0, 0, 0), 0.3, 0, 0.85, 5, hex(0xe0782a), false); b.cyl(T(0.1, 0, 0.05, 1), 0.17, 0, 0.55, 4, hex(0xf2c24a), false); return R.upload(fromBuilder(b, 3), 3, false); })();
const bloodG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(), 1, 1, 1, hex(0x6a0c08)); return R.upload(fromBuilder(b), 3, false); })();
const sparkG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(), 1, 1, 1, hex(0xffd27a)); return R.upload(fromBuilder(b, 3), 3, false); })();
const decalG = (() => { const b = new MeshBuilder(); b.jitter = 0.25; for (let i = 0; i < 5; i++) { const a = i * 1.3; b.box(T(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, a), 0.6 - i * 0.07, 0.015, 0.45 - i * 0.05, hex(0x3d0a08)); } return R.upload(fromBuilder(b), 3, false); })();
const crowG = (() => { const b = new MeshBuilder(); b.jitter = 0; const K = hex(0x0e0d0f);
  b.tri([0, 0, 0.25], [-0.55, 0.08, -0.05], [0, 0, -0.15], K); b.tri([0, 0, 0.25], [0, 0, -0.15], [0.55, 0.08, -0.05], K); b.box(T(0, 0, 0.05), 0.09, 0.08, 0.38, K);
  return R.upload(fromBuilder(b), 3, false); })();
const ashG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(), 1, 0.25, 1, hex(0x8f8a84)); return R.upload(fromBuilder(b), 3, false); })();
// crows wheel over the gallows and the killing field; ash drifts down everywhere
const crows = Array.from({ length: 14 }, (_, i) => ({ cx: i < 6 ? 14 : (Math.random() - 0.5) * 50, cz: i < 6 ? -16 : (Math.random() - 0.5) * 50, r: 4 + Math.random() * 9, h: 9 + Math.random() * 12, sp: (0.25 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1), ph: Math.random() * 7 }));
const ash = Array.from({ length: 260 }, () => ({ x: (Math.random() - 0.5) * 40, y: Math.random() * 14, z: (Math.random() - 0.5) * 40, ph: Math.random() * 7 }));
const flagG = (col: number) => { const b = new MeshBuilder(); b.jitter = 0.04; b.box(T(0, 1.15, 0), 0.04, 2.6, 0.04, hex(0x2d241d)); b.box(T(0.33, 2.15, 0), 0.62, 0.55, 0.025, hex(col)); b.box(T(0.33, 1.82, 0), 0.62, 0.1, 0.03, hex(0x111111)); return R.upload(fromBuilder(b), 3, false); };
const bannerG = [flagG(0x7a1a14), flagG(0x1e1c1a)];
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
const PLAYER_WEAPONS: WeaponId[] = ["sword", "kord", "hatchet", "mace", "longsword", "greataxe", "spear", "glaive", "bow", "crossbow", "arquebus"];
let weaponSlot = 0;
const ARMOUR_OF: Record<string, keyof typeof ARMOURS> = { base: "rags", levy: "gambeson", sergeant: "mail", knight: "plate", plate: "plate" };
/** The player's kit: the test set in the trial battle, the hero's own gear in the campaign. */
function playerKit(): Kit {
  const h = camp && battleKind === "encounter" ? camp.co.hero : null;
  if (!h) return { name: { pl: t("you"), en: t("you") }, loadout: "knight", weapon: PLAYER_WEAPONS[weaponSlot % PLAYER_WEAPONS.length], shield: true, armour: ARMOURS.mail, hp: 130, skill: 1 };
  const w = h.weapons[weaponSlot % h.weapons.length] ?? "kord";
  return { name: { pl: t("you"), en: t("you") }, loadout: h.armour, weapon: w, shield: h.shield, armour: ARMOURS[ARMOUR_OF[h.armour]], hp: heroHp(h), skill: clamp(0.55 + h.prof[profOf(w)] / 250, 0.6, 1.5) };
}
function weaponCount() { return camp && battleKind === "encounter" ? camp.co.hero.weapons.length : PLAYER_WEAPONS.length; }
const wName = (w: WeaponId) => WEAPONS[w].name;

// ---------- state ----------
let player!: Warrior;
let fighters: Warrior[] = [];
const brains = new Map<number, Brain>();
const tokens = { used: 0, max: 1 };
const freeTok = { used: 0, max: 999 };
const targets = new Map<number, Warrior>();      // AI: whom each fighter is after
let targetT = 0;
// ---------- campaign ----------
type Mode = "title" | "map" | "battle";
let mode: Mode = "title";
let battleKind: "waves" | "encounter" = "waves";
let camp: Campaign | null = null;
let ui: MapUI | null = null;
interface Enc { enemy: Party; allyQ: { t: TroopId; g: number }[]; enemyQ: { t: TroopId; g: number }[]; reserveQ: { t: TroopId; g: number }[]; troopOf: Map<number, TroopId>; groups: Group[]; sel: Set<number>; menu: null | "move" | "form" | "fire"; deploy: boolean; cryCD: number; routed: { 0: TroopId[]; 1: TroopId[] }; startHour: number; startDay: number; done: boolean; moraleT: number; raiseCD: number; raised: Set<number>; risen: Set<number>; weak?: boolean }
let enc: Enc | null = null;
let wave = 0, kills = 0, waveBreak = 0, started = false, paused = false;
let hour = 16.8;
let firstPerson = false, hints = settings.hints, autoBlock = settings.autoBlock, helpOpen = false;
let camYaw = Math.PI, camPitch = -0.1;
let botWish: [number, number] | null = null;
let noAI = false, botRun = false;   // test hook   // test hook: drive the player without a keyboard

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; s: number; spark: boolean }
const parts: Particle[] = [];

// ---------- missiles (build 11): arrows, bolts and lead balls fly as real projectiles ----------
interface Proj { x: number; y: number; z: number; vx: number; vy: number; vz: number; owner: Warrior; w: WeaponId; life: number; stuck: number; gone?: boolean }
const projs: Proj[] = [];
const smokes: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; s: number }[] = [];
let flashT = 0, flashAt: V3 = [0, 0, 0];
const arrowG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(0, 0, -0.35), 0.012, 0.012, 0.75, hex(0x6b5236)); b.box(T(0, 0, 0.04), 0.02, 0.02, 0.06, hex(0x2a2826)); b.box(T(0, 0.015, -0.68), 0.004, 0.035, 0.1, hex(0x8a8070)); return R.upload(fromBuilder(b), 3, false); })();
const boltG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(0, 0, -0.17), 0.018, 0.018, 0.36, hex(0x4e3c28)); b.box(T(0, 0, 0.03), 0.03, 0.03, 0.05, hex(0x2a2826)); return R.upload(fromBuilder(b), 3, false); })();
const ballG = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(0, 0, -0.3), 0.012, 0.012, 0.6, hex(0xd8c890)); return R.upload(fromBuilder(b), 3, false); })();
const smokeG = (() => { const b = new MeshBuilder(); b.jitter = 0.2; b.rock(T(), 0.5, hex(0x6e6a64), 0.3, 3); return R.upload(fromBuilder(b), 3, false); })();
const flashG = (() => { const b = new MeshBuilder(); b.jitter = 0.1; b.rock(T(), 0.18, hex(0xffb040), 0.5, 2); return R.upload(fromBuilder(b), 3, false); })();
const projMesh = (w: WeaponId) => w === "arquebus" ? ballG : w === "crossbow" ? boltG : arrowG;

/** f has just loosed: spawn the missile. The player aims with the camera; the AI leads its target and arcs for range. */
function fire(f: Warrior) {
  f.shot = false;
  const r = WEAPONS[f.weaponId].ranged!;
  let yaw = f.yaw, pitch = 0;
  if (f === player) {
    // the crosshair: march the camera ray to the first body or the ground, then aim the shot at that point
    const cp = Math.cos(camPitch), fx = Math.sin(camYaw) * cp, fy = Math.sin(camPitch), fz = Math.cos(camYaw) * cp;
    let ex: number, ey: number, ez: number;
    if (firstPerson) { [ex, ey, ez] = player.eye; }
    else { const rx = -Math.cos(camYaw), rz = Math.sin(camYaw); ex = player.x + rx * 0.55 - fx * 3.3; ey = player.y + 1.82 - fy * 3.3; ez = player.z + rz * 0.55 - fz * 3.3; }
    let ax = ex + fx * 80, ay = ey + fy * 80, az = ez + fz * 80;
    for (let d = 3.5; d < 80; d += 0.25) {
      const x = ex + fx * d, y = ey + fy * d, z = ez + fz * d;
      if (y < ground(x, z) || fighters.some((o) => o !== player && o.alive && Math.hypot(o.x - x, o.z - z) < 0.35 && y > o.y && y < o.y + 1.85)) { ax = x; ay = y; az = z; break; }
    }
    const lx = f.x + Math.sin(f.yaw) * 0.45, lz = f.z + Math.cos(f.yaw) * 0.45, hd = Math.hypot(ax - lx, az - lz);
    yaw = Math.atan2(ax - lx, az - lz);
    pitch = Math.atan2(ay - (f.y + 1.48), hd) + 0.5 * Math.asin(Math.min(1, r.grav * hd / (r.speed * r.speed)));
  }
  else {
    const tg = targets.get(f.id);
    if (tg) {
      const dx = tg.x - f.x, dz = tg.z - f.z, d = Math.hypot(dx, dz);
      const tof = d / r.speed;
      const lx = dx + tg.vx * tof, lz = dz + tg.vz * tof, ld = Math.hypot(lx, lz);
      yaw = Math.atan2(lx, lz);
      const k = Math.min(1, r.grav * ld / (r.speed * r.speed));
      pitch = 0.5 * Math.asin(k) + Math.atan2((tg.y + 1.15) - (f.y + 1.5), ld);
    }
  }
  // spread: weapon, skill, and a held bow that starts to shake
  let sp = r.spread * (1.6 - Math.min(1.2, f.kit.skill)) * (f === player ? 0.6 : 1);
  if (r.kind === "bow" && f.heldT > 2.5) sp *= 1 + (f.heldT - 2.5);
  if (Math.hypot(f.vx, f.vz) > 0.5) sp *= 1.8;
  yaw += (Math.random() - 0.5) * 2 * sp; pitch += (Math.random() - 0.5) * 2 * sp;
  const fx = Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = Math.cos(yaw) * Math.cos(pitch);
  const x = f.x + Math.sin(f.yaw) * 0.45, y = f.y + 1.48, z = f.z + Math.cos(f.yaw) * 0.45;
  projs.push({ x, y, z, vx: fx * r.speed, vy: fy * r.speed, vz: fz * r.speed, owner: f, w: f.weaponId, life: 6, stuck: 0 });
  const near = Math.hypot(f.x - player.x, f.z - player.z) < 25 ? 1 : 0.4;
  if (r.kind === "arquebus") {
    audio.shot(near);
    flashT = 0.06; flashAt = [x + fx * 1.1, y + fy * 1.1, z + fz * 1.1];
    for (let i = 0; i < 9; i++) smokes.push({ x: x + fx * (0.9 + i * 0.25), y: y + fy * 0.9, z: z + fz * (0.9 + i * 0.25), vx: fx * (1.6 - i * 0.12) + (Math.random() - 0.5) * 0.4, vy: 0.25 + Math.random() * 0.3, vz: fz * (1.6 - i * 0.12) + (Math.random() - 0.5) * 0.4, t: 0, life: 5 + Math.random() * 3, s: 0.22 + Math.random() * 0.2 });
    if (f === player) shake = Math.max(shake, 0.18);
  } else audio.loose(r.kind === "crossbow", near);
  if (f === player && camp && battleKind === "encounter") { const h = camp.co.hero; h.prof.rg = Math.min(400, h.prof.rg + 0.6 * (1 - h.prof.rg / 450)); }
}
function projStep(dt: number) {
  for (const p of projs) {
    if (p.stuck > 0) { p.stuck -= dt; continue; }
    const r = WEAPONS[p.w].ranged!;
    const ox = p.x, oy = p.y, oz = p.z;
    p.vy -= r.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
    // who is on the path this frame (sampled segment vs a body cylinder)
    let hit: Warrior | null = null, hy = 0;
    for (let k = 1; k <= 4 && !hit; k++) {
      const t = k / 4, x = ox + (p.x - ox) * t, y = oy + (p.y - oy) * t, z = oz + (p.z - oz) * t;
      for (const o of fighters) {
        if (o === p.owner || !o.alive) continue;
        if (Math.hypot(o.x - x, o.z - z) < 0.3 && y > o.y && y < o.y + 1.82) { hit = o; hy = y - o.y; break; }
      }
    }
    if (hit) { missileHit(p, hit, hy); continue; }
    if (p.y < ground(p.x, p.z)) { p.y = ground(p.x, p.z) + 0.05; p.stuck = p.w === "arquebus" ? 0 : 25; p.gone = p.w === "arquebus"; if (p.gone && Math.random() < 0.5) parts.push({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 1.5, vz: 0, life: 0.3, s: 0.05, spark: true }); }
    else if (p.life <= 0) p.gone = true;
  }
  for (let i = projs.length - 1; i >= 0; i--) if (projs[i].gone || (projs[i].stuck <= 0 && projs[i].life <= 0)) projs.splice(i, 1);
  while (projs.length > 260) projs.shift();
  for (const m of smokes) { m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt; m.vx *= 1 - dt * 0.8; m.vz *= 1 - dt * 0.8; m.vy *= 1 - dt * 0.3; }
  for (let i = smokes.length - 1; i >= 0; i--) if (smokes[i].t > smokes[i].life) smokes.splice(i, 1);
  flashT = Math.max(0, flashT - dt);
}
function missileHit(p: Proj, o: Warrior, hy: number) {
  const r = WEAPONS[p.w].ranged!, att = p.owner;
  const v = Math.hypot(p.vx, p.vy, p.vz), dx = p.vx / v, dz = p.vz / v;
  const facing = -(Math.sin(o.yaw) * dx + Math.cos(o.yaw) * dz);
  const near = att === player || o === player, vol = near ? 1 : 0.5;
  // a shield turned toward the missile catches it (always when blocking, mostly when just carried in front)
  if (o.hasShield && facing > 0.35 && (o.state === "block" || Math.random() < 0.7) && hy > 0.55) {
    audio.shieldThud(vol * 0.8); p.gone = true;
    if (o === player) pushLog(L("Pocisk wbija się w tarczę", "A missile thuds into your shield"), "good");
    return;
  }
  const zone: Zone = hy > 1.52 ? "head" : hy < 0.88 ? "legs" : "body";
  const part = zone;
  const arm = o.kit.armour[part] * r.armourK;
  let dmg = Math.round(damage(r.dmg * (0.6 + 0.4 * v / r.speed), "pierce", arm, part, 0));
  if (att === player && camp && battleKind === "encounter") dmg = Math.round(dmg * (0.85 + camp.co.hero.prof.rg / 600));
  if (o === player) dmg = Math.round(dmg * [0.6, 1, 1.3][settings.difficulty]);
  if (att.team === o.team) dmg = Math.round(dmg * 0.6);
  if (att.team === 0 && o.team !== 0 && camp && battleKind === "encounter" && boon(camp, "perun")) dmg = Math.round(dmg * 1.1);
  const joint: Joint = zone === "head" ? "head" : zone === "legs" ? "thighR" : "torso";
  const hp: V3 = [p.x, o.y + hy, p.z];
  p.gone = true;
  applyHit(att, o, dmg, "pierce", DIR.THRUST, zone, joint, hp, dx, dz, vol, near, p.w === "arquebus" ? 1.3 : 0.6, true);
}
const decals: { x: number; y: number; z: number; r: number; s: number; s1: number }[] = [];
let hurt = 0, shake = 0;
let camOverride: [V3, V3] | null = null;   // test hook

function reset() {
  fighters = []; brains.clear(); tokens.used = 0; parts.length = 0; projs.length = 0; smokes.length = 0; decals.length = 0; gibs.length = 0; spurts.length = 0; hurt = 0;
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
  if (e.code === "F1" && !(mode === "battle" && battleKind === "encounter")) { e.preventDefault(); toggleHelp(); return; }
  keys.add(e.code);
  if (!started || mode !== "battle") return;
  if (e.code === "KeyV") { firstPerson = !firstPerson; player.hideHead = firstPerson; }
  if (e.code === "KeyT") hour = (hour + 1) % 24;
  if (e.code === "KeyH") { hints = !hints; pushLog(hints ? t("hintsOn") : t("hintsOff"), "sys"); }
  if (e.code === "KeyB") { autoBlock = !autoBlock; settings.autoBlock = autoBlock; saveSettings(); pushLog(autoBlock ? t("autoOn") : t("autoOff"), "sys"); }
  if (e.code === "KeyL") { setLang(lang === "pl" ? "en" : "pl"); applyLang(); }
  if (e.code === "KeyR" && !player.alive) reset();
  if (battleKind === "waves" && /^Digit[1-9]$/.test(e.code) && player.alive && player.state === "idle") {
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
  const sens = SENS * settings.sens;
  camYaw -= dx * sens; camPitch = clamp(camPitch - (settings.invertY ? -dy : dy) * sens, -1.1, 0.9);
  intentX = intentX * 0.55 + dx; intentY = intentY * 0.55 + dy;
  if (Math.hypot(intentX, intentY) > 2) curDir = dirFromMouse(intentX, intentY);
});
canvas.addEventListener("mousedown", (e) => {
  if (!started) return;
  audio.start();
  if (document.pointerLockElement !== canvas) tryLock();
  if (!player.alive) return;
  if (e.button === 0) { lmb = true; if (player.ranged) { if (!player.startAim() && player.ammo <= 0) pushLog(L("Pusto: nie ma czym strzelać. Kółko: zmień broń.", "Empty: nothing to shoot. Wheel: switch weapon."), "warn"); } else if (player.attack(curDir)) audio.swing(0.35); }
  if (e.button === 2) { rmb = true; const d = blockDir(); if (player.state === "windup" || player.state === "hold") player.feint(d); else player.block(d); }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) { lmb = false; if (player?.ranged) player.loose(); }
  if (e.button === 2) { rmb = false; player?.unblock(); }
});
function tryLock() {
  try { const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined; if (p && typeof p.catch === "function") p.catch(() => { dragLook = true; }); } catch { dragLook = true; }
}
document.addEventListener("pointerlockerror", () => { dragLook = true; });
$("tstart").addEventListener("click", (e) => { e.stopPropagation(); startWaves(); });
$("tcamp").addEventListener("click", (e) => { e.stopPropagation(); startCampaign(); });
$("tnew").addEventListener("click", (e) => { e.stopPropagation(); try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } camp = null; startCampaign(true); });
if (hasSave()) { $("tcamp").textContent = "Kontynuuj kampanię"; $("tnew").hidden = false; }
function startWaves() {
  mode = "battle"; battleKind = "waves"; enc = null; started = true; $("title").hidden = true; $("mapHud").hidden = true; $("labels").hidden = true; setBattleHud(true);
  setClassicField(); rebuildField(); audio.start(); tryLock(); reset();
}
function setBattleHud(on: boolean) { for (const id of ["hp", "weapon", "dirs", "clock", "log"]) ($(id) as HTMLElement).hidden = !on; }

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
      att.bounce(shield); o.blocked();
      // steel on steel: both jar to a stop, the attacker's arm is thrown back
      att.freeze = o.freeze = 0.07 + att.weapon.mass * 0.03;
      att.impact(-dx, -dz, 0.35 * att.weapon.mass, 0, 0.5); o.impact(dx, dz, 0.22 * att.weapon.mass, 0, 0.2);
      if (near) shake = Math.max(shake, 0.18 + att.weapon.mass * 0.08);
      if (shield) audio.shieldThud(vol); else audio.clang(vol);
      sparks(att.tip(), shield ? 4 : 14);
      if (o === player) pushLog(shield ? t("shieldBlock") : t("youBlocked"), "good");
      else if (att === player) pushLog(t("blocked", { who: nm(o) }), "warn");
      return;
    }
  }
  if (att.team === o.team && Math.random() < 0.5) return;
  // where does the blade land? (from the attacker's actual weapon pose)
  const aimY = att.lean * 0.1;   // the lean itself moves the blade up or down
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
  // the hero's strength and practice; how hard the world hits back
  if (att === player && camp && battleKind === "encounter") {
    const h = camp.co.hero, pf = profOf(att.weaponId);
    dmg = Math.round(dmg * (1 + 0.08 * h.skills.sila) * (0.85 + h.prof[pf] / 600));
    h.prof[pf] = Math.min(400, h.prof[pf] + 1.6 * (1 - h.prof[pf] / 450));
  }
  if (o === player) dmg = Math.round(dmg * [0.6, 1, 1.3][settings.difficulty]);
  if (att.team === o.team) dmg = Math.round(dmg * 0.5);
  if (att.team === 0 && o.team !== 0 && camp && battleKind === "encounter" && boon(camp, "perun")) dmg = Math.round(dmg * 1.1);
  applyHit(att, o, dmg, atk.type, dir, zone, joint, hp, dx, dz, vol, near, att.weapon.mass);
}
function applyHit(att: Warrior, o: Warrior, dmg: number, type: DmgType, dir: Dir, zone: Zone, joint: Joint, hp: V3, dx: number, dz: number, vol: number, near: boolean, massK: number, ranged = false) {
  o.hp -= dmg; o.flash = 1; o.lastHitBy = att.id; o.morale -= dmg * 0.35; (o as Warrior & { lastType?: string }).lastType = type;
  // weight of the blow: hit-stop on both, the victim is shoved and twisted by it
  const mass = massK, force = Math.min(1.4, (0.35 + dmg / 45) * (0.7 + mass * 0.3));
  if (!ranged) att.freeze = Math.max(att.freeze, 0.05 + mass * 0.035 + Math.min(0.06, dmg / 700));
  o.freeze = Math.max(o.freeze, ranged ? 0.05 : att.freeze * 0.8);
  const side = dir === DIR.RIGHT ? 1 : dir === DIR.LEFT ? -1 : 0;
  o.impact(dx, dz, force * (dir === DIR.THRUST ? 1.2 : 1), side, zone === "head" ? 1 : zone === "legs" ? -0.6 : 0);
  if (att === player) shake = Math.max(shake, 0.12 + force * 0.18);
  if (o === player) shake = Math.max(shake, 0.25 + force * 0.3);
  audio.hit(type === "blunt", vol);
  if (Math.random() < 0.6) audio.grunt(vol * 0.8);
  bleed(hp, dx, dz, settings.gore ? 16 + Math.min(40, dmg) : 4);
  if (o === player) hurt = Math.min(1, hurt + 0.35 + dmg / 80);
  const lethal = o.hp <= 0;
  // dismemberment: cutting blows that kill, or heavy cuts to limbs
  let gore: string | null = null;
  if (type === "cut" && settings.gore) {
    if (zone === "head" && lethal) gore = "head";
    else if (zone === "arm" && (lethal || dmg >= 30) && SEVER[joint]) gore = joint;
    else if (zone === "legs" && (lethal || dmg >= 34) && SEVER[joint]) gore = joint;
  }
  if (gore) sever(o, gore as Joint, dx, dz, att);
  if ((lethal || gore) && enc) {
    moraleShock(o.x, o.z, o.team, gore ? 16 : 7, gore ? 10 : 7, 3);
    if (o.bearer) { moraleShock(o.x, o.z, o.team, 14, 80); pushLog(o.team === 0 ? L("Sztandar pada!", "The standard falls!") : L("Sztandar wroga pada!", "The enemy standard falls!"), o.team === 0 ? "bad" : "good"); }
    if (o.leader && o !== player) moraleShock(o.x, o.z, o.team, 12, 80);
    if (enc.troopOf.get(o.id) === "nekromanta" || enc.troopOf.get(o.id) === "strzyga") collapseUndead(o.team);
  }
  if (lethal || gore) {
    o.hp = 0;
    if (o.alive) o.die();
    decals.push({ x: o.x + dx * 0.5, y: ground(o.x + dx * 0.5, o.z + dz * 0.5) + 0.02, z: o.z + dz * 0.5, r: Math.random() * 6, s: 0.4, s1: 1.8 + Math.random() * 0.8 });
    if (type === "blunt" && zone === "head") bleed(hp, dx, dz, 50);
    if (o.aiToken) { o.aiToken = false; tokens.used = Math.max(0, tokens.used - 1); }
    if (o !== player) { if (att === player) kills++; pushLog(goreText(gore, att, o) ?? t("killed", { who: nm(o) }), att === player ? "good" : ""); }
    else if (battleKind === "encounter") { pushLog(lang === "pl" ? "Padasz ogłuszony. Bitwa toczy się bez ciebie." : "You go down, stunned. The battle goes on without you.", "bad"); }
    else { $("dead").hidden = false; $("deadSub").textContent = t("deadSub", { n: Math.max(0, wave - 1) }); try { document.exitPointerLock(); } catch { /* */ } }
  } else if (dmg >= 6 || o.attacking) o.stagger();
  const zn = zone === "arm" ? (lang === "pl" ? "ręka" : "arm") : t(zone);
  if (att === player) pushLog(t("youHit", { who: nm(o), part: zn, dmg, type: t(type), arm: o.kit.armour.name[lang] }), "good");
  else if (o === player) pushLog(t("hitYou", { who: nm(att), part: zn, dmg, type: t(type) }), "bad");
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
  if (enc?.deploy) { placeDeployed(); for (const f of fighters) f.update(0, false); return; }
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
    player.wish.run = keys.has("ShiftLeft") || keys.has("ShiftRight") || botRun;
    player.yaw = camYaw;
    player.aim = clamp((camPitch + 0.1) * 1.1, -0.9, 0.7);
    if (rmb && player.state === "block") { const d = blockDir(); if (d !== player.dir) player.block(d); }
    if (rmb && player.state === "idle") player.block(blockDir());
  } else player.wish.x = player.wish.z = 0;

  // pick targets: each AI goes for the nearest living enemy (refreshed a few times a second)
  targetT -= dt;
  if (targetT <= 0) {
    targetT = 0.35;
    for (const f of fighters) {
      if (f === player || !f.alive) continue;
      let best: Warrior | null = null, bd = 1e9;
      for (const o of fighters) { if (o.team === f.team || !o.alive) continue; const d = Math.hypot(o.x - f.x, o.z - f.z) - (o === player ? 1.5 : 0); if (d < bd) { bd = d; best = o; } }
      if (best) targets.set(f.id, best); else targets.delete(f.id);
    }
  }
  tokens.used = fighters.filter((f) => f.alive && f.aiToken && targets.get(f.id) === player).length;
  freeTok.used = 0;
  for (const f of fighters) {
    const b = brains.get(f.id);
    const tg = targets.get(f.id);
    if (b && !noAI && tg && !f.fleeing) {
      b.update(dt, tg, fighters, tg === player ? tokens : freeTok);
    } else if (b && !tg && f !== player) { f.wish.x = f.wish.z = 0; }
  }
  if (enc) { commandStep(dt); moraleStep(dt); }
  for (const f of fighters) {
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
  for (const f of fighters) if (f.shot) fire(f);
  projStep(dt);
  shooterStep(dt);

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
  shake = Math.max(0, shake - dt * 2.2);
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);

  if (battleKind === "encounter") { encounterTick(); }
  const alive = fighters.filter((f) => f.team === 1 && f.alive).length;
  if (battleKind === "waves" && player.alive && started && alive === 0) {
    if (waveBreak <= 0 && wave > 0) { waveBreak = 6; banner(t("cleared"), `${t("kills")}: ${kills}`); player.hp = Math.min(player.maxHp, player.hp + 45); }
    waveBreak -= dt;
    if (waveBreak <= 0) spawnWave();
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").hidden = true; }
}

// ---------- lighting by hour (tuned for the retro renderer) ----------
type LP = { col: number[]; amb: number[]; rim: number[]; fog: number[]; sky: number[][] };
// grimdark: a sun that never quite breaks the overcast, ash-grey murk, a dusk like an old wound
const DAY: LP = { col: [0.9, 0.86, 0.76], amb: [0.5, 0.52, 0.54], rim: [0.12, 0.13, 0.14], fog: [0.5, 0.52, 0.5], sky: [[0.4, 0.42, 0.44], [0.72, 0.71, 0.66], [0.15, 0.13, 0.1]] };
const DUSK: LP = { col: [1.15, 0.48, 0.24], amb: [0.27, 0.22, 0.25], rim: [0.36, 0.14, 0.08], fog: [0.36, 0.2, 0.16], sky: [[0.12, 0.1, 0.14], [0.86, 0.3, 0.15], [0.07, 0.05, 0.04]] };
const NIGHT: LP = { col: [0.24, 0.27, 0.38], amb: [0.17, 0.18, 0.23], rim: [0.07, 0.08, 0.12], fog: [0.06, 0.065, 0.085], sky: [[0.04, 0.05, 0.08], [0.13, 0.12, 0.14], [0.02, 0.02, 0.02]] };
const mixLP = (a: LP, b: LP, k: number): LP => ({
  col: a.col.map((v, i) => lerp(v, b.col[i], k)), amb: a.amb.map((v, i) => lerp(v, b.amb[i], k)), rim: a.rim.map((v, i) => lerp(v, b.rim[i], k)),
  fog: a.fog.map((v, i) => lerp(v, b.fog[i], k)), sky: a.sky.map((r, j) => r.map((v, i) => lerp(v, b.sky[j][i], k))),
});
function lightAt(h: number, focus: V3, fires: [number, number, number][] = scen.fires): Light & { bg: number[] } {
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
  for (const f of fires) { const d = Math.hypot(f[0] - focus[0], f[2] - focus[2]); if (d < bd) { bd = d; best = f; } }
  const night = clamp(1 - p.col[1] * 1.2, 0, 1);
  const point = best && bd < 22 ? { pos: [best[0], best[1] + 0.4, best[2]], col: [2.2 * (0.35 + night), 1.05 * (0.35 + night), 0.38 * (0.35 + night)], rad: 9 + night * 5 } : undefined;
  // at night, with no fire near, the company fights by torchlight (around the player)
  if (!point && night > 0.45 && mode === "battle" && player?.alive) return { dir: sd, col: p.col, amb: p.amb.map((v) => v * 1.3), rim: p.rim, fog: p.fog, sky: p.sky, bg: p.fog, point: { pos: [player.x, player.y + 2.6, player.z], col: [1.6 * night, 0.85 * night, 0.35 * night], rad: 16 } };
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
  if (camOverride) { eye = camOverride[0]; target = camOverride[1]; }
  if (shake > 0) {
    const k = shake * shake * 0.09, ph = now * 0.06;
    const o: V3 = [Math.sin(ph * 1.3) * k, Math.sin(ph * 1.9 + 1) * k, Math.cos(ph * 1.7) * k];
    eye = [eye[0] + o[0], eye[1] + o[1], eye[2] + o[2]]; target = [target[0] + o[0] * 0.4, target[1] + o[1] * 0.4, target[2] + o[2] * 0.4];
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
  for (const p of projs) { const h = Math.hypot(p.vx, p.vz); items.push({ mesh: projMesh(p.w), model: trs(m4(), p.x, p.y, p.z, Math.atan2(p.vx, p.vz), -Math.atan2(p.vy, h)) }); }
  for (const m of smokes) { const k = m.t / m.life, sc = m.s * (1 + m.t * 0.9); if (k < 1) items.push({ mesh: smokeG, model: trs(m4(), m.x, m.y, m.z, m.t * 0.3, 0, 0, sc, sc * 0.8, sc) }); }
  if (flashT > 0) items.push({ mesh: flashG, model: trs(m4(), flashAt[0], flashAt[1], flashAt[2]) });
  for (const g of gibs) g.draw(items);
  for (const sp of spurts) { const J = sp.w.lastJ; if (J) items.push({ mesh: bloodG, model: mul(m4(), J[sp.parent], trs(m4(), sp.at[0], sp.at[1], sp.at[2], 0, 0, 0, 0.1, 0.035, 0.1)) }); }
  for (const f of fighters) for (const j of f.severed) { const info = SEVER[j]; if (info && !f.severed.has(info.parent) && f.lastJ) items.push({ mesh: bloodG, model: mul(m4(), f.lastJ[info.parent], trs(m4(), info.at[0], info.at[1], info.at[2], 0, 0, 0, 0.11, 0.04, 0.11)) }); }
  for (const f of fighters) {
    if (enc?.raised.has(f.id)) continue;
    items.push({ mesh: blobG, model: trs(m4(), f.x, f.y, f.z, f.yaw) });
    if (f.bearer && f.alive && f.lastJ) items.push({ mesh: bannerG[f.team === 0 ? 0 : 1], model: mul(m4(), f.lastJ.torso, trs(m4(), 0.06, -0.2, -0.2)) });
    f.draw(items);
  }
  const tt = now / 1000;
  for (const c of crows) {
    const a = c.ph + tt * c.sp, flap = Math.sin(tt * 9 + c.ph) * 0.35;
    const x = c.cx + Math.cos(a) * c.r, z = c.cz + Math.sin(a) * c.r, y = ground(c.cx, c.cz) + c.h + Math.sin(tt * 0.7 + c.ph) * 1.2;
    items.push({ mesh: crowG, model: trs(m4(), x, y, z, -a + (c.sp > 0 ? 0 : Math.PI), 0, flap * 0.3, 1, 1 + flap, 1) });
  }
  for (const f of ash) {
    // flakes live in a box that follows the camera; they fall slowly and sway
    const bx = eye[0] - 20, bz = eye[2] - 20;
    const fy = 14 - ((f.y + tt * 0.45) % 14);
    const x = bx + (((f.x + 20 - eye[0]) % 40) + 40) % 40 + Math.sin(tt * 0.8 + f.ph) * 0.4;
    const z = bz + (((f.z + 20 - eye[2]) % 40) + 40) % 40 + Math.cos(tt * 0.6 + f.ph) * 0.4;
    items.push({ mesh: ashG, model: trs(m4(), x, eye[1] - 5 + fy, z, f.ph + tt, f.ph, tt * 0.7, 0.035, 0.035, 0.035) });
  }
  for (const p of parts) items.push({ mesh: p.spark ? sparkG : bloodG, model: trs(m4(), p.x, p.y, p.z, p.life * 9, p.life * 7, 0, p.s, p.s, p.s) });
  if (L.point) L.point.pos[1] += Math.sin(now * 0.013) * 0.04;
  items.sort((a, b) => a.mesh.tex - b.mesh.tex);
  R.render(MODE, vp, eye, L, items, false, L.bg, near, far);
  ($("hurt") as HTMLElement).style.opacity = String(hurt);
  if (enc) groupLabels();
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
  orderHud();
  const hpP = clamp(player.hp / player.maxHp, 0, 1);
  ($("hpfill") as HTMLElement).style.width = `${hpP * 100}%`;
  $("hptext").textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  const ws = WSTATS[player.weaponId];
  const types = [ws.swing ? t(ws.swing.type) : null, ws.thrust ? t(ws.thrust.type) : null].filter(Boolean).join(" / ");
  const rg = player.ranged;
  $("weapon").innerHTML = rg ? `<b>${wName(player.weaponId)}</b><span>${player.ammo} ${rg.ammoName} · ${player.rs === "reload" ? L("ładowanie…", "reloading…") : player.rs === "ready" ? L("gotów: puść", "ready: release") : player.rs === "draw" ? L("naciąganie…", "drawing…") : L("LPM: celuj", "LMB: aim")}</span>` : `<b>${wName(player.weaponId)}</b><span>${types}${player.hasShield ? " · " + (lang === "pl" ? "tarcza" : "shield") : ""}${autoBlock ? " · auto-blok" : ""}</span>`;
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  if (enc) {
    const mine = fighters.filter((f) => f.team === 0 && f.alive && f !== player).length, foe = fighters.filter((f) => f.team === 1 && f.alive).length;
    $("clock").textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} · ${lang === "pl" ? "twoi" : "yours"} ${mine}${enc.allyQ.length ? "+" + enc.allyQ.length : ""} · ${lang === "pl" ? "wróg" : "enemy"} ${foe}${enc.enemyQ.length ? "+" + enc.enemyQ.length : ""} · ${enc.deploy ? L("rozstawienie", "deployment") : ""}`;
  } else
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
  // locked out after a parried blow: dim; riposte window: glowing dot; dot height = aim (head / torso / legs)
  const locked = player.cd > 0 || player.state === "blockstun" || player.state === "stagger";
  dirsEl.style.opacity = locked ? "0.35" : "1";
  dotEl.style.top = `${40 - player.aim * 30}px`;
  dotEl.style.background = player.riposte > 0 ? "var(--ember)" : "";
  dotEl.style.boxShadow = player.riposte > 0 ? "0 0 6px var(--ember)" : "";
}
const dirsEl = $("dirs") as HTMLElement, dotEl = document.querySelector("#dirs .dot") as HTMLElement;

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

// ======================= campaign map =======================
const MAP_MODE = { ...MODE, fog: [70, 260] as [number, number] };
/** Apply the options screen: image quality, battle size, volume, toggles, language. */
function applySettings() {
  MODE.res = RES[settings.quality] ?? 360; MAP_MODE.res = MODE.res;
  CAP = settings.battleSize;
  hints = settings.hints; autoBlock = settings.autoBlock;
  try { if (audio.master) audio.master.gain.value = settings.volume; } catch { /* audio not started */ }
  applyLang(); ui?.hud();
}
function showOptions() { openOptions(applySettings, () => {}); }
$("topts").addEventListener("click", (e) => { e.stopPropagation(); showOptions(); });
$("thelp").addEventListener("click", (e) => { e.stopPropagation(); toggleHelp(); });
queueMicrotask(applySettings);
let mapG: { terr: GMesh[]; feat: GMesh[]; sett: Map<string, { ok: GMesh; burned: GMesh }>; figs: Record<string, GMesh>; mark: GMesh; ring: GMesh } | null = null;
let mapYaw = 0.6, mapPitch = 0.95, mapDist = 62;
const mapCenter: V3 = [0, 0, 0];
let mapDrag = false, mapLX = 0, mapLY = 0, mapMoved = 0, hudT = 0;
const labelEls = new Map<string, HTMLElement>();

const SAVE_KEY = "mb2.campaign";
function saveCampaign() { try { if (camp) localStorage.setItem(SAVE_KEY, camp.save()); } catch { /* storage blocked */ } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
function startCampaign(fresh = false) {
  let created = false;
  if (!camp) {
    camp = new Campaign(37);
    let loaded = false;
    if (!fresh) { try { const sv = localStorage.getItem(SAVE_KEY); if (sv && camp.load(sv)) { camp.note("Wczytano zapis kampanii.", ""); loaded = true; } } catch { /* */ } }
    created = !loaded;
    camp.onDay = () => saveCampaign();
    ui = new MapUI(camp, { fight: (p) => startEncounter(p), refresh: () => ui?.hud(), snapshot: (x, z, d) => mapSnapshot(x, z, d) });
    camp.onEncounter = (p) => { ui!.encounter(p); };
    camp.enterSettlement = (id) => ui!.settlement(id);
    buildMapMeshes();
    const me = camp.co.party; mapCenter[0] = me.x; mapCenter[2] = me.z;
  }
  mode = "map"; started = false; $("title").hidden = true;
  $("mapHud").hidden = false; $("labels").hidden = false; setBattleHud(false); $("banner").hidden = true;
  try { document.exitPointerLock(); } catch { /* */ }
  audio.start(); applySettings();
  ui!.hud();
  if (created) ui!.creation(() => { ui!.hud(); saveCampaign(); });
}

function buildMapMeshes() {
  const c = camp!;
  const up = (b: MeshBuilder) => R.upload(fromBuilder(b), 3, false);
  const sett = new Map<string, { ok: GMesh; burned: GMesh }>();
  for (const s of c.w.settlements) {
    const ok = up(settlementModel(c.w, s));
    s.burned = true; const burned = up(settlementModel(c.w, s)); s.burned = false;
    sett.set(s.id, { ok, burned });
  }
  const fig = (body: number, flag: number, big: boolean) => up(partyFigure(hex(body), hex(flag), big));
  const mark = (() => { const b = new MeshBuilder(); b.jitter = 0; b.box(T(0, 0.05, 0), 0.35, 0.1, 0.35, hex(0xb4561e)); return R.upload(fromBuilder(b, 3), 3, false); })();
  const ring = (() => { const b = new MeshBuilder(); b.jitter = 0; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.box(T(Math.cos(a) * 1.3, 0.06, Math.sin(a) * 1.3, -a), 0.12, 0.06, 0.55, hex(0xc9392a)); } return R.upload(fromBuilder(b, 3), 3, false); })();
  mapG = {
    terr: [up(buildMapTerrain(c.w, false)), up(buildMapTerrain(c.w, true))],
    feat: [up(buildMapFeatures(c.w, false)), up(buildMapFeatures(c.w, true))],
    sett,
    figs: { player: fig(0x2b2f36, 0x7a1a14, true), bandits: fig(0x3b3128, 0x1a1a1a, true), deserters: fig(0x4a4436, 0x5a5440, true), caravan: fig(0x5a4a34, 0xa08a4a, true), peasants: fig(0x5d5444, 0x6b5a3a, false), undead: fig(0x6d6a5e, 0x2a3a2a, true), necro: fig(0x141214, 0x3a5a2a, true), hunters: fig(0x3a3430, 0xb8b0a0, true), garrison: fig(0x3a3632, 0x5a5040, true), monster: fig(0x1a1614, 0x5a1a10, false),
      ...Object.fromEntries(FIDS.map((f) => ["lord_" + f, fig(0x2e2a26, FACTIONS[f].color, true)])) } as Record<string, GMesh>,
    mark, ring,
  };
  // labels for settlements
  const box = $("labels"); box.textContent = "";
  for (const s of c.w.settlements) { const d = document.createElement("div"); d.className = "lbl " + s.kind; d.textContent = s.name; box.append(d); labelEls.set("s:" + s.id, d); }
}

function mapStep(dt: number) {
  const c = camp!;
  if (!ui!.open) c.step(dt);
  if (c.pendingEvent && !ui!.open) { const ev = c.pendingEvent; c.pendingEvent = null; ui!.event(ev); }
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; ui!.hud(); }
  // the camera follows the company
  const me = c.co.party, k = Math.min(1, dt * 4);
  mapCenter[0] += (me.x - mapCenter[0]) * k; mapCenter[2] += (me.z - mapCenter[2]) * k;
  mapCenter[1] = c.w.height(mapCenter[0], mapCenter[2]);
  if (keys.has("KeyQ")) mapYaw += dt * 1.4;
  if (keys.has("KeyE")) mapYaw -= dt * 1.4;
}

const mvp = m4(), mview = m4(), mproj = m4();
function mapEye(): V3 {
  const cp = Math.cos(mapPitch);
  return [mapCenter[0] + Math.sin(mapYaw) * cp * mapDist, mapCenter[1] + Math.sin(mapPitch) * mapDist, mapCenter[2] + Math.cos(mapYaw) * cp * mapDist];
}
/** Render the map from a low, close camera and return it as a picture (menu illustrations). */
function mapSnapshot(x: number, z: number, dist: number): string | null {
  if (!camp || !mapG) return null;
  const y = camp.w.height(x, z);
  const yaw = mapYaw + 0.5;
  snapCam = { eye: [x + Math.sin(yaw) * dist, y + dist * 0.42, z + Math.cos(yaw) * dist], target: [x, y + 1.2, z] };
  renderMap(performance.now());
  snapCam = null;
  try { return canvas.toDataURL("image/jpeg", 0.82); } catch { return null; }
}
let snapCam: { eye: V3; target: V3 } | null = null;
function renderMap(now: number) {
  resize();
  const c = camp!, g = mapG!;
  const eye = snapCam ? snapCam.eye : mapEye();
  perspective(mproj, (snapCam ? 50 : 45) * Math.PI / 180, canvas.width / Math.max(1, canvas.height), snapCam ? 0.3 : 1, 600);
  lookAt(mview, eye, snapCam ? snapCam.target : [mapCenter[0], mapCenter[1], mapCenter[2]]); mul(mvp, mproj, mview);
  const L0 = lightAt(c.hour, [mapCenter[0], 0, mapCenter[2]], []);
  // the map is a reading surface: brighter than the battlefield, and night stays legible
  const L = { ...L0, col: L0.col.map((v) => v * 1.25), amb: L0.amb.map((v) => Math.max(0.24, v * 1.35)), fog: L0.fog.map((v) => Math.max(0.07, v)), bg: L0.bg.map((v) => Math.max(0.07, v)) };
  const wi = c.winter ? 1 : 0;
  const items: { mesh: GMesh; model: Float32Array }[] = [{ mesh: g.terr[wi], model: m4() }, { mesh: g.feat[wi], model: m4() }];
  for (const s of c.w.settlements) { const m = g.sett.get(s.id)!; items.push({ mesh: s.burned ? m.burned : m.ok, model: m4() }); }
  const me = c.co.party, sight = c.sight(me) * 1.6;
  const tt = now / 1000;
  for (const p of c.parties) {
    const seen = p === me || Math.hypot(p.x - me.x, p.z - me.z) < sight;
    if (!seen) continue;
    const nx = p.path[0], yaw = nx ? Math.atan2(nx[0] - p.x, nx[1] - p.z) : 0;
    const bob = p.path.length && c.clockRuns ? Math.abs(Math.sin(tt * 8 + p.id)) * 0.08 : 0;
    items.push({ mesh: g.figs[p.kind === "lord" ? "lord_" + p.faction : p.kind], model: trs(m4(), p.x, c.w.height(p.x, p.z) + bob, p.z, yaw) });
  }
  items.push({ mesh: g.ring, model: trs(m4(), me.x, c.w.height(me.x, me.z), me.z, tt * 0.5) });
  // the route ahead
  if (me.path.length) { let acc = 0; let px = me.x, pz = me.z; for (const [x, z] of me.path) { acc += Math.hypot(x - px, z - pz); px = x; pz = z; if (acc > 2.2) { acc = 0; items.push({ mesh: g.mark, model: trs(m4(), x, c.w.height(x, z), z) }); } } }
  // battlefields left to the crows
  for (const f of c.fields) {
    const y = c.w.height(f.x, f.z);
    items.push({ mesh: decalG, model: trs(m4(), f.x, y + 0.05, f.z, f.id, 0, 0, 3, 1, 3) });
    for (let i = 0; i < 5; i++) { const a = tt * 0.6 + i * 1.25 + f.id; items.push({ mesh: crowG, model: trs(m4(), f.x + Math.cos(a) * 2.5, y + 4 + Math.sin(tt + i) * 0.4, f.z + Math.sin(a) * 2.5, -a, 0, 0, 0.6, 0.6, 0.6) }); }
  }
  items.sort((a, b) => a.mesh.tex - b.mesh.tex);
  R.render(MAP_MODE, mvp, eye, L, items, false, L.bg, 1, 600);
  if (!snapCam) mapLabels(sight);
}
function project(x: number, y: number, z: number): [number, number] | null {
  const m = mvp, w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (w <= 0.1) return null;
  const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  if (Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) return null;
  return [(nx * 0.5 + 0.5) * canvas.clientWidth, (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight];
}
function mapLabels(sight: number) {
  const c = camp!, me = c.co.party;
  for (const s of c.w.settlements) {
    const el = labelEls.get("s:" + s.id)!, p = project(s.x, c.w.height(s.x, s.z) + (s.kind === "town" ? 7 : 4), s.z);
    el.hidden = !p; if (p) { el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%, -100%)`; el.classList.toggle("burned", s.burned); el.style.borderBottom = `2px solid #${FACTIONS[c.fx.owner[s.id]].color.toString(16).padStart(6, "0")}`; }
  }
  const seen = new Set<string>();
  for (const p of c.parties) {
    if (p === me || Math.hypot(p.x - me.x, p.z - me.z) > sight) continue;
    const key = "p:" + p.id; seen.add(key);
    let el = labelEls.get(key);
    if (!el) { el = document.createElement("div"); el.className = "lbl party " + (c.hostile(p) ? "hostile" : ""); $("labels").append(el); labelEls.set(key, el); }
    el.textContent = `${p.name} · ${c.partySize(p)}`;
    if (p.faction) el.style.borderLeft = `3px solid #${FACTIONS[p.faction].color.toString(16).padStart(6, "0")}`;
    el.classList.toggle("hostile", c.hostile(p));
    const q = project(p.x, c.w.height(p.x, p.z) + 2.4, p.z);
    el.hidden = !q; if (q) el.style.transform = `translate(${q[0]}px, ${q[1]}px) translate(-50%, -100%)`;
  }
  for (const [k, el] of labelEls) if (k.startsWith("p:") && !seen.has(k)) { el.remove(); labelEls.delete(k); }
}
/** Mouse → point on the map terrain (ray march along the view ray). */
function mapPick(cx: number, cy: number): [number, number] | null {
  const c = camp!, inv = invert(m4(), mvp);
  const nx = (cx / canvas.clientWidth) * 2 - 1, ny = 1 - (cy / canvas.clientHeight) * 2;
  const un = (z: number): V3 => { const v = xform(inv, nx, ny, z); const w = inv[3] * nx + inv[7] * ny + inv[11] * z + inv[15]; return [v[0] / w, v[1] / w, v[2] / w]; };
  const a = un(-1), b = un(1);
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d);
  for (let t = 0; t < Math.min(len, 600); t += 0.4) {
    const x = a[0] + d[0] / len * t, y = a[1] + d[1] / len * t, z = a[2] + d[2] / len * t;
    if (y <= c.w.height(x, z)) return [x, z];
  }
  return null;
}
canvas.addEventListener("mousedown", (e) => {
  if (mode !== "map") return;
  if (e.button === 2 || e.button === 1) { mapDrag = true; mapLX = e.clientX; mapLY = e.clientY; return; }
  if (e.button !== 0 || ui!.open) return;
  const hit = mapPick(e.clientX, e.clientY); if (!hit) return;
  const c = camp!, me = c.co.party, sight = c.sight(me) * 1.6;
  const s = c.settlementAt(hit[0], hit[1], 5);
  const party = c.parties.find((p) => p !== me && Math.hypot(p.x - hit[0], p.z - hit[1]) < 2.8 && Math.hypot(p.x - me.x, p.z - me.z) < sight);
  if (party) c.orderMove(party.x, party.z, undefined, party.id);
  else if (s) c.orderMove(s.x + 1.5, s.z + 1.5, s.id);
  else c.orderMove(hit[0], hit[1]);
  if (c.speed === 0) c.speed = 1;
  c.co.inside = false;
  ui!.hud();
});
window.addEventListener("mousemove", (e) => {
  if (mode !== "map" || !mapDrag) return;
  mapYaw -= (e.clientX - mapLX) * 0.006; mapPitch = clamp(mapPitch + (e.clientY - mapLY) * 0.004, 0.45, 1.35);
  mapLX = e.clientX; mapLY = e.clientY; mapMoved++;
});
window.addEventListener("mouseup", () => { mapDrag = false; });
canvas.addEventListener("wheel", (e) => {
  if (mode === "battle" && player?.alive && player.state === "idle") { e.preventDefault(); weaponSlot = (weaponSlot + (e.deltaY > 0 ? 1 : weaponCount() - 1)) % weaponCount(); player.setKit(R, playerKit()); pushLog(wName(player.weaponId), "sys"); return; }
  if (mode !== "map") return; e.preventDefault(); mapDist = clamp(mapDist * (e.deltaY > 0 ? 1.12 : 0.89), 22, 160); }, { passive: false });
window.addEventListener("keydown", (e) => {
  if (mode === "map" && camp && ui) {
    if (e.code === "Escape" && !$("opts").hidden) { $("opts").hidden = true; return; }
    if (e.code === "Escape" && ui.open) { ui.close(); return; }
    if (e.code === "Escape") { gameMenu(); return; }
    if (ui.open) return;
    if (e.code === "Space") { e.preventDefault(); camp.speed = camp.speed === 0 ? 1 : 0; }
    if (e.code === "Digit1") camp.speed = 1;
    if (e.code === "Digit2") camp.speed = 3;
    if (e.code === "KeyO") ui.campMenu();
    if (e.code === "KeyF") ui.factionsPanel();
    if (e.code === "KeyP") ui.partyPanel();
    if (e.code === "KeyC") ui.characterPanel();
    if (e.code === "KeyI") ui.inventoryPanel(camp.co.inside ? camp.settlementAt(camp.co.party.x, camp.co.party.z, 6) : undefined);
    if (e.code === "KeyN") ui.chronicle();
    if (e.code === "KeyL") { setLang(lang === "pl" ? "en" : "pl"); applyLang(); }
    ui.hud();
  } else if (mode === "battle" && enc) {
    battleKey(e);
  }
});

/** Warband-style in-game menu (Esc on the map). */
function gameMenu() {
  if (!ui || !camp) return;
  ui.pic = null;
  ui.show(lang === "pl" ? "Menu" : "Menu", `<p class="meta">${esc2(camp.co.hero.name)} · ${camp.dateText(lang)}</p>`, [
    { label: lang === "pl" ? "Wróć do gry" : "Back to the game", on: () => ui!.close() },
    { label: lang === "pl" ? "Opcje" : "Options", on: () => { ui!.close(); showOptions(); } },
    { label: lang === "pl" ? "Zapisz teraz" : "Save now", sub: lang === "pl" ? "gra zapisuje się też sama co dobę i po bitwie" : "also autosaves daily and after battles", on: () => { saveCampaign(); camp!.note("Zapisano.", ""); ui!.close(); } },
    { label: lang === "pl" ? "Wyjdź do menu głównego" : "Quit to main menu", kind: "bad", on: () => { saveCampaign(); ui!.close(); mode = "title"; $("mapHud").hidden = true; $("labels").hidden = true; $("title").hidden = false; if (hasSave()) { $("tcamp").textContent = lang === "pl" ? "Kontynuuj kampanię" : "Continue campaign"; $("tnew").hidden = false; } } },
  ]);
}
const esc2 = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]!));
// map bottom bar
for (const [id, fn] of [["mchar", () => ui?.characterPanel()], ["minv", () => ui?.inventoryPanel(camp?.co.inside ? camp.settlementAt(camp.co.party.x, camp.co.party.z, 6) : undefined)], ["mchron", () => ui?.chronicle()], ["mmenu", () => gameMenu()]] as [string, () => void][]) $(id).addEventListener("click", fn);

// ---------- battle from an encounter on the map (build 6: groups, formations, morale) ----------
let CAP = settings.battleSize;            // fighters per side in the scene at once; the rest come as reinforcements
function groupOfTroop(t: TroopId) { return camp?.co.groups?.[t] ?? DEFAULT_GROUP[t] ?? 1; }
const L = (pl: string, en: string) => (lang === "pl" ? pl : en);

function startEncounter(p: Party) {
  const c = camp!, me = c.co.party;
  const mb = biomeAt(c.w, me.x, me.z);
  const biome: BattleBiome = mb === "edge" ? "hills" : mb;
  const [i, j] = cellOf(me.x, me.z);
  setBattlefield(biome, p.id + c.day * 7, c.winter, !!c.w.road[cellIndex(i, j)]);
  rebuildField();
  const allyQ: Q[] = [], enemyQ: Q[] = [];
  for (const s of me.troops) for (let k = 0; k < s.n - s.wounded; k++) allyQ.push({ t: s.t, g: groupOfTroop(s.t) });
  for (const s of p.troops) for (let k = 0; k < s.n - s.wounded; k++) enemyQ.push({ t: s.t, g: 1 });
  // strongest first into the scene, reserve groups stay behind
  allyQ.sort((a, b) => TROOPS[b.t].tier - TROOPS[a.t].tier);
  const groups = newGroups();
  const used = [...new Set(allyQ.map((q) => q.g))].sort();
  used.forEach((g, k) => { const G = groups[g - 1]; G.ax = (k - (used.length - 1) / 2) * 9; G.az = 6; G.ayaw = Math.PI; G.order = "hold"; G.formation = g === 2 ? "line" : "line"; });
  enc = { enemy: p, allyQ, enemyQ, reserveQ: [], troopOf: new Map(), groups, sel: new Set(used), menu: null, deploy: true, cryCD: 0, routed: { 0: [], 1: [] }, startHour: c.hour, startDay: c.day, done: false, moraleT: 0, raiseCD: 0, raised: new Set(), risen: new Set(), weak: p.kind === "monster" && c.contracts.some((k) => k.monster === p.monster && k.steps >= 3) };
  mode = "battle"; battleKind = "encounter"; started = true; hour = c.hour;
  $("mapHud").hidden = true; $("labels").hidden = true; setBattleHud(true);
  fighters = []; brains.clear(); targets.clear(); tokens.used = 0; tokens.max = 2; parts.length = 0; projs.length = 0; smokes.length = 0; decals.length = 0; gibs.length = 0; spurts.length = 0; hurt = 0; kills = 0; wave = 0;
  camYaw = Math.PI; camPitch = -0.1;
  weaponSlot = 0;
  player = new Warrior(R, playerKit(), 0, 13, 0); player.yaw = Math.PI; player.hideHead = firstPerson; player.leader = true;
  player.moveMul = 1 + 0.03 * c.co.hero.skills.atletyka;
  fighters.push(player);
  reinforce(0, true); reinforce(1, true);
  // the standard: carried by the best man of the first group; big enemy bands have one too
  const pickBearer = (team: 0 | 1) => fighters.filter((f) => f.team === team && f !== player).sort((a, b) => b.maxHp - a.maxHp)[0];
  const ab = pickBearer(0); if (ab) ab.bearer = true;
  if (p.troops.reduce((a, s) => a + s.n, 0) >= 10 && p.kind !== "undead" && p.kind !== "necro") { const eb = pickBearer(1); if (eb) eb.bearer = true; }
  for (const f of fighters) { const t = enc.troopOf.get(f.id); if (t === "herszt" || t === "nekromanta" || t === "lowca") f.leader = true; }
  if (p.kind === "lord" || p.kind === "garrison") { const cap = fighters.filter((f) => f.team === 1).sort((a, b) => b.maxHp - a.maxHp)[0]; if (cap) cap.leader = true; }
  if (p.kind === "monster") banner(p.name, enc.weak ? L("Przygotowani: bestia osłabiona o jedną czwartą", "Prepared: the beast is weakened by a quarter") : L("Bez śledztwa: bestia w pełni sił", "No investigation: the beast at full strength"));
  if (p.kind === "necro" || p.kind === "undead") banner(p.name, L("Zabij nekromantę, a jego martwi padną", "Kill the necromancer and his dead fall"));
  $("dead").hidden = true; log.length = 0; renderLog();
  $("glabels").hidden = false;
  camOverride = [[0, 19, 27], [0, 0, 3]];
  banner(p.name, L("Rozstawienie: 1–9 wybór grupy · klik: ustaw grupę · F2 formacja · R rezerwa · spacja: do boju", "Deployment: 1–9 select group · click: place · F2 formation · R reserve · space: fight"));
  try { document.exitPointerLock(); } catch { /* */ }
}
interface Q { t: TroopId; g: number }

function moraleBase(team: 0 | 1, t: TroopId): number {
  if (TROOPS[t].undead || TROOPS[t].beast) return 100;
  if (team === 0) return clamp((camp?.co.morale ?? 50) * 0.5 + 30 + TROOPS[t].tier * 6 + (camp && boon(camp, "blogoslawienstwo") && troopFaith(t) === "kosciol" ? 12 : 0), 25, 98);
  const k = enc?.enemy.kind;
  return (k === "peasants" ? 30 : k === "bandits" ? 45 : k === "caravan" ? 55 : 52) + TROOPS[t].tier * 6;
}

function reinforce(team: 0 | 1, first = false) {
  if (!enc) return;
  const q = team === 0 ? enc.allyQ : enc.enemyQ;
  const alive = fighters.filter((f) => f.team === team && f.alive && !f.fleeing && f !== player).length;
  if (!first && alive > CAP * 0.4) return;
  // reserve groups do not come in on their own
  const take: Q[] = [];
  for (let k = 0; k < q.length && take.length < CAP - alive; ) {
    if (team === 0 && enc.groups[q[k].g - 1].reserve) { k++; continue; }
    take.push(q.splice(k, 1)[0]);
  }
  if (!take.length) return;
  const z0 = team === 0 ? 15 : -16, dir = team === 0 ? 1 : -1;
  take.forEach((it, k) => {
    const row = Math.floor(k / 7), col = (k % 7) - 3;
    const x = col * 1.6 + (Math.random() - 0.5) * 0.4, z = z0 + dir * row * 1.6 + (first ? 0 : dir * 10);
    const f = new Warrior(R, kitOf(it.t), x, z, team);
    f.yaw = team === 0 ? Math.PI : 0; f.group = it.g;
    f.noMorale = !!TROOPS[it.t].undead || !!TROOPS[it.t].beast;
    if (team === 1 && TROOPS[it.t].beast && enc!.weak) { f.maxHp = Math.round(f.maxHp * 0.75); f.hp = f.maxHp; }
    f.morale = f.baseMorale = moraleBase(team, it.t);
    fighters.push(f); brains.set(f.id, new Brain(f)); enc!.troopOf.set(f.id, it.t);
    if (it.t === "nekromanta") f.leader = true;
  });
  if (!first) banner(L("Posiłki", "Reinforcements"), team === 0 ? L("twoi ludzie", "your men") : L("wroga", "the enemy's"));
  if (first && team === 0) placeDeployed();
}

/** Members of each of the player's groups, in a stable order (their slots). */
function groupMembers(): Map<number, Warrior[]> {
  const m = new Map<number, Warrior[]>();
  for (const f of fighters) if (f.team === 0 && f !== player && f.alive && !f.fleeing) { const a = m.get(f.group) ?? []; a.push(f); m.set(f.group, a); }
  for (const a of m.values()) a.sort((p, q) => p.id - q.id);
  return m;
}
function placeDeployed() {
  if (!enc) return;
  for (const [g, list] of groupMembers()) {
    const G = enc.groups[g - 1];
    list.forEach((f, i) => { const [x, z] = slotWorld(G, G.formation, i, list.length); f.x = x; f.z = z; f.yaw = G.ayaw; f.vx = f.vz = 0; f.y = ground(x, z); });
  }
}

/** Every step: soldiers keep their slots unless the enemy is close enough to fight. */
function commandStep(dt: number) {
  if (!enc) return;
  const members = groupMembers();
  for (const [g, list] of members) {
    const G = enc.groups[g - 1];
    if (G.order === "follow" && player.alive) { const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw); G.ax = player.x - fx * 4; G.az = player.z - fz * 4; G.ayaw = player.yaw; }
    if (G.order === "charge") continue;
    const R0 = engageRadius(G);
    list.forEach((f, i) => {
      const [sx, sz] = slotWorld(G, G.formation, i, list.length);
      const ds = Math.hypot(sx - f.x, sz - f.z);
      const tg = targets.get(f.id), dE = tg ? Math.hypot(tg.x - f.x, tg.z - f.z) : 999;
      if (dE < R0 && ds < 6) return;                 // fight from the formation
      if (f.attacking) return;
      if (ds > 0.5) { f.wish.x = (sx - f.x) / ds; f.wish.z = (sz - f.z) / ds; f.wish.run = ds > 5 || G.order === "fallback"; }
      else { f.wish.x = f.wish.z = 0; f.faceTo(G.formation === "hedgehog" ? Math.atan2(f.x - G.ax, f.z - G.az) : G.ayaw, dt, 4); }
      if (f.state === "block" && dE > 4) f.unblock();
    });
  }
}

/** Battle morale: neighbours, leaders, standards; rout and rally. */
function moraleStep(dt: number) {
  if (!enc) return;
  enc.cryCD = Math.max(0, enc.cryCD - dt);
  enc.raiseCD = Math.max(0, enc.raiseCD - dt);
  enc.moraleT -= dt;
  const tick = enc.moraleT <= 0; if (tick) enc.moraleT = 0.5;
  for (const f of fighters) {
    if (f === player || !f.alive || f.noMorale) continue;
    if (tick) {
      let allies = 0, foes = 0, dread = 0, lead = false, flag = false;
      for (const o of fighters) {
        if (!o.alive || o === f) continue;
        const d = Math.hypot(o.x - f.x, o.z - f.z);
        if (o.team === f.team) { if (d < 6 && !o.fleeing) allies++; if (o.leader && d < 10) lead = true; if (o.bearer && d < 12) flag = true; }
        else if (d < 6 && !o.fleeing) { foes++; if (o.noMorale && d < 4) dread++; }
      }
      if (foes > allies + 1) f.morale -= 1.6 * (foes - allies);
      if (dread) f.morale -= 0.7 * dread * (enc.enemy.kind === "hunters" && f.team === 1 ? 0.3 : 1);   // the dead frighten the living; hunters are used to it
      if (lead) f.morale += f.fleeing ? 6 : 1.5;
      if (flag) f.morale += f.fleeing ? 3 : 1;
      if (!foes) f.morale += (f.baseMorale - f.morale) * 0.04;
      f.morale = clamp(f.morale, 0, 100);
      if (!f.fleeing && f.morale < ROUT) { f.fleeing = true; if (f.state === "block") f.unblock(); if (f.team === 0) pushLog(L(`${f.kit.name[lang]} ucieka z pola`, `${f.kit.name[lang]} flees`), "bad"); }
      else if (f.fleeing && f.morale > RALLY) { f.fleeing = false; if (f.team === 0) pushLog(L(`${f.kit.name[lang]} wraca do szyku`, `${f.kit.name[lang]} rallies`), "good"); }
    }
    if (f.fleeing) {
      // run for your own edge of the field
      const ex = f.x * 0.2, ez = f.team === 0 ? 1 : -1, l = Math.hypot(ex, ez);
      f.wish.x = ex / l; f.wish.z = ez / l; f.wish.run = true;
      if (Math.abs(f.z) > 52 || Math.abs(f.x) > 52) {
        enc.routed[f.team as 0 | 1].push(enc.troopOf.get(f.id)!);
        fighters.splice(fighters.indexOf(f), 1); brains.delete(f.id);
        if (f.team === 1) pushLog(L(`${f.kit.name[lang]} uciekł z pola`, `${f.kit.name[lang]} escaped`), "warn");
        return moraleStep(0);   // array changed; finish next frame
      }
    }
  }
}
/** Something terrible happened at (x,z) to a man of `team`: those around feel it. */
function moraleShock(x: number, z: number, team: number, amount: number, radius: number, cheer = 0) {
  for (const f of fighters) {
    if (!f.alive || f.noMorale || f === player) continue;
    const d = Math.hypot(f.x - x, f.z - z); if (d > radius) continue;
    if (f.team === team) f.morale -= amount * (1 - d / radius / 2); else f.morale += cheer;
  }
}
/** The necromancer is dead: what he held up falls. */
function collapseUndead(team: number) {
  if (!enc) return;
  let n = 0;
  for (const f of fighters) if (f.team === team && f.alive && f.noMorale && f !== player) { f.hp = 0; f.die(); n++; }
  if (n) { pushLog(team === 1 ? L(`Nekromanta pada. ${n} trupów osuwa się na ziemię.`, `The necromancer falls. ${n} corpses collapse.`) : L("Twoi martwi padają.", "Your dead fall."), team === 1 ? "good" : "bad"); shake = Math.max(shake, 0.2); }
}
/** Hero ability (N): raise the fallen around you as risen corpses fighting for you. */
function raiseDead() {
  if (!enc || !camp || enc.deploy || enc.done || !player.alive) return;
  const h = camp.co.hero;
  if (!h.necro) { pushLog(L("Nie znasz słów, które budzą martwych.", "You do not know the words that wake the dead."), "warn"); return; }
  if (enc.raiseCD > 0) { pushLog(L(`Jeszcze nie (${Math.ceil(enc.raiseCD)} s)`, `Not yet (${Math.ceil(enc.raiseCD)} s)`), "warn"); return; }
  const mine = fighters.filter((f) => f.team === 0 && f.alive && f.noMorale).length + undeadCount(camp);
  const room = undeadLimit(h) - mine;
  const want = Math.min(2 + Math.floor(h.skills.nekromancja / 2), Math.max(0, room));
  const bodies = fighters.filter((f) => !f.alive && f !== player && !enc!.raised.has(f.id) && !f.severed.has("head" as Joint) && Math.hypot(f.x - player.x, f.z - player.z) < 14)
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, want);
  if (!bodies.length) { pushLog(want ? L("Nie ma tu ciał, które by wstały.", "No bodies here that could rise.") : L("Więcej martwych nie utrzymasz.", "You cannot hold more dead."), "warn"); return; }
  enc.raiseCD = 35;
  for (const b of bodies) {
    enc.raised.add(b.id);
    const f = new Warrior(R, kitOf("zywy_trup"), b.x, b.z, 0);
    f.yaw = b.yaw; f.group = 1; f.noMorale = true; f.morale = f.baseMorale = 100;
    fighters.push(f); brains.set(f.id, new Brain(f)); enc.troopOf.set(f.id, "zywy_trup"); enc.risen.add(f.id);
    bleed([f.x, f.y + 0.4, f.z], 0, 0, 6);
  }
  corrupt(camp, 2);
  moraleShock(player.x, player.z, 1, 10, 16);
  moraleShock(player.x, player.z, 0, 4, 12);
  shake = Math.max(shake, 0.25); audio.grunt(1);
  pushLog(L(`Mówisz słowa z księgi. ${bodies.length} martwych wstaje.`, `You speak the words. ${bodies.length} dead rise.`), "good");
}
/** Shooters switch to the sidearm when the enemy closes (or the quiver is empty) and back when there is room; volley clocks. */
function shooterStep(dt: number) {
  for (const f of fighters) {
    if (f === player || !f.alive || !f.primary || !f.kit.side) continue;
    const tg = targets.get(f.id), d = tg ? Math.hypot(tg.x - f.x, tg.z - f.z) : 99;
    if (f.ranged && (d < 4.5 || f.ammo <= 0) && f.state === "idle") f.setKit(R, { ...f.kit, weapon: f.kit.side });
    else if (!f.ranged && f.ammo > 0 && d > 13 && f.state === "idle") f.setKit(R, { ...f.kit, weapon: f.primary });
    f.volleyGo = false;
    if (enc && f.team === 0) { const G = enc.groups[f.group - 1]; f.fire = G.fire; }
  }
  if (!enc) return;
  for (const G of enc.groups) {
    if (G.fire !== "volley") continue;
    const mem = fighters.filter((f) => f.team === 0 && f.group === G.id && f.alive && f.ranged);
    const ready = mem.filter((f) => f.rs === "ready").length;
    G.volleyT -= dt;
    // the volley goes when most are drawn, or the sergeant loses patience
    if (mem.length && (ready >= Math.ceil(mem.length * 0.8) || G.volleyT <= 0) && ready > 0) { for (const f of mem) f.volleyGo = true; G.volleyT = 4; if (ready >= 3) pushLog(L(`Grupa ${G.id}: salwa!`, `Group ${G.id}: volley!`), "warn"); }
  }
}
function warCry() {
  if (!enc || enc.cryCD > 0 || !player.alive) return;
  enc.cryCD = 25;
  for (const f of fighters) { if (!f.alive || f.noMorale) continue; const d = Math.hypot(f.x - player.x, f.z - player.z); if (f.team === 0 && d < 14) f.morale += 18; if (f.team === 1 && d < 8) f.morale -= 6; }
  audio.grunt(1); shake = Math.max(shake, 0.15);
  pushLog(L("Twój okrzyk niesie się nad polem", "Your war cry carries over the field"), "good");
}

function battleKey(e: KeyboardEvent) {
  if (!enc) return;
  const code = e.code;
  const sel = [...enc.sel].map((g) => enc!.groups[g - 1]);
  const say = (s: string) => { pushLog(s, "warn"); audio.grunt(0.4); };
  if (/^Digit[1-9]$/.test(code)) {
    const g = Number(code.slice(5));
    if (e.shiftKey) { if (enc.sel.has(g)) enc.sel.delete(g); else enc.sel.add(g); } else enc.sel = new Set([g]);
    enc.menu = null; e.preventDefault(); return;
  }
  if (code === "Digit0" || code === "Backquote") { enc.sel = new Set(groupMembers().keys()); enc.menu = null; return; }
  if (code === "Escape") { enc.menu = null; return; }
  if (code === "KeyX") { warCry(); return; }
  if (code === "KeyN") { raiseDead(); return; }
  if (code === "Tab") {
    e.preventDefault();
    if (enc.deploy || enc.done) return;
    const near = fighters.some((f) => f.team === 1 && f.alive && !f.fleeing && Math.hypot(f.x - player.x, f.z - player.z) < 14);
    if (near && player.alive) { pushLog(L("Nie da się wycofać: wróg jest za blisko.", "You cannot retreat: the enemy is too close."), "bad"); return; }
    enc.done = true; pushLog(L("Wycofujecie się z pola.", "You retreat from the field."), "warn"); setTimeout(() => endEncounter(false), 600); return;
  }
  if (enc.deploy) {
    if (code === "KeyR") { for (const G of sel) G.reserve = !G.reserve; return; }
    if (code === "F2") { e.preventDefault(); for (const G of sel) G.formation = FORMATIONS[(FORMATIONS.indexOf(G.formation) + 1) % FORMATIONS.length]; placeDeployed(); return; }
    if (code === "Space" || code === "Enter") { e.preventDefault(); startFight(); }
    return;
  }
  if (!/^F[1-9]$/.test(code)) return;
  e.preventDefault();
  const n = Number(code.slice(1));
  if (!enc.menu) {
    if (n === 1) enc.menu = "move"; else if (n === 2) enc.menu = "form"; else if (n === 4) enc.menu = "fire";
    else if (n === 3) {
      // release the reserve
      let k = 0; for (const G of enc.groups) if (G.reserve && (enc.sel.has(G.id) || enc.sel.size === 0)) { G.reserve = false; G.order = "charge"; k++; }
      if (k) { say(L("Rezerwa rusza do boju!", "The reserve goes in!")); reinforce(0, true); }
    }
    return;
  }
  if (enc.menu === "move") {
    const ord: Order | null = n === 1 ? "hold" : n === 2 ? "follow" : n === 3 ? "charge" : n === 4 ? "fallback" : null;
    if (ord) {
      const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
      const mem = groupMembers();
      for (const G of sel) {
        G.order = ord;
        if (ord === "hold") { G.ax = player.x + fx * 5; G.az = player.z + fz * 5; G.ayaw = player.yaw; }
        if (ord === "fallback") { const list = mem.get(G.id) ?? []; const cx = list.reduce((a, f) => a + f.x, 0) / (list.length || 1), cz = list.reduce((a, f) => a + f.z, 0) / (list.length || 1); G.ax = cx; G.az = Math.min(40, cz + 12); G.ayaw = Math.PI; }
      }
      say(L(`Grupy ${[...enc.sel].join(", ")}: ${ORDER_NAMES[ord].pl}!`, `Groups ${[...enc.sel].join(", ")}: ${ORDER_NAMES[ord].en}!`));
    }
  } else if (enc.menu === "fire") {
    const m = n === 1 ? "free" : n === 2 ? "hold" : n === 3 ? "volley" : null;
    if (m) { for (const G of sel) { G.fire = m; G.volleyT = 2; } say(L(`Strzelcy: ${FIRE_NAMES[m].pl}!`, `Shooters: ${FIRE_NAMES[m].en}!`)); }
  } else if (enc.menu === "form") {
    const f = FORMATIONS[n - 1];
    if (f) { for (const G of sel) { G.formation = f; if (G.order === "charge") { G.order = "hold"; const mem = groupMembers().get(G.id) ?? []; G.ax = mem.reduce((a, q) => a + q.x, 0) / (mem.length || 1); G.az = mem.reduce((a, q) => a + q.z, 0) / (mem.length || 1); G.ayaw = player.yaw; } } say(L(`Formacja: ${FORM_NAMES[f].pl}`, `Formation: ${FORM_NAMES[f].en}`)); }
  }
  enc.menu = null;
}
function startFight() {
  if (!enc) return;
  enc.deploy = false; camOverride = null;
  banner(enc.enemy.name, L("F1 ruch · F2 formacja · F3 rezerwa · F4 ogień · 1–9 grupy · X okrzyk", "F1 move · F2 formation · F3 reserve · F4 fire · 1–9 groups · X war cry"));
  tryLock();
}
/** Mouse → point on the battlefield ground (deployment). */
function battlePick(cx: number, cy: number): [number, number] | null {
  const inv = invert(m4(), vp);
  const nx = (cx / canvas.clientWidth) * 2 - 1, ny = 1 - (cy / canvas.clientHeight) * 2;
  const un = (z: number): V3 => { const v = xform(inv, nx, ny, z); const w = inv[3] * nx + inv[7] * ny + inv[11] * z + inv[15]; return [v[0] / w, v[1] / w, v[2] / w]; };
  const a = un(-1), b = un(1), d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d);
  for (let t = 0; t < Math.min(len, 260); t += 0.3) { const x = a[0] + d[0] / len * t, y = a[1] + d[1] / len * t, z = a[2] + d[2] / len * t; if (y <= ground(x, z)) return [x, z]; }
  return null;
}
canvas.addEventListener("mousedown", (e) => {
  if (mode !== "battle" || !enc?.deploy || e.button !== 0) return;
  const hit = battlePick(e.clientX, e.clientY); if (!hit) return;
  for (const g of enc.sel) { const G = enc.groups[g - 1]; G.ax = clamp(hit[0], -30, 30); G.az = clamp(hit[1], -2, 30); G.ayaw = Math.PI; }
  placeDeployed();
});
function encounterTick() {
  if (!enc || enc.done) return;
  reinforce(0); reinforce(1);
  const foes = fighters.filter((f) => f.team === 1 && f.alive && !f.fleeing).length + enc.enemyQ.length;
  if (foes === 0) { enc.done = true; banner(L("Zwycięstwo", "Victory"), enc.routed[1].length ? L("reszta ucieka", "the rest flee") : ""); setTimeout(() => endEncounter(true), 2200); return; }
  if (!player.alive) { enc.done = true; setTimeout(() => endEncounter(null), 2500); return; }
}
function groupLabels() {
  const box = $("glabels"); const mem = groupMembers();
  const want = new Set<number>();
  for (const [g, list] of mem) {
    if (!list.length) continue; want.add(g);
    let el = box.querySelector(`[data-g="${g}"]`) as HTMLElement | null;
    if (!el) { el = document.createElement("div"); el.className = "glbl"; el.dataset.g = String(g); box.append(el); }
    const cx = list.reduce((a, f) => a + f.x, 0) / list.length, cz = list.reduce((a, f) => a + f.z, 0) / list.length;
    const m = vp, x = cx, y = ground(cx, cz) + 2.6, z = cz, w = m[3] * x + m[7] * y + m[11] * z + m[15];
    el.textContent = String(g); el.classList.toggle("sel", !!enc?.sel.has(g));
    if (w <= 0.1) { el.hidden = true; continue; }
    const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    el.hidden = Math.abs(nx) > 1 || Math.abs(ny) > 1;
    el.style.transform = `translate(${(nx * 0.5 + 0.5) * canvas.clientWidth}px, ${(1 - (ny * 0.5 + 0.5)) * canvas.clientHeight}px) translate(-50%, -100%)`;
  }
  for (const el of [...box.children] as HTMLElement[]) if (!want.has(Number(el.dataset.g))) el.remove();
}
function orderHud() {
  const el = $("orders") as HTMLElement;
  if (!enc) { el.hidden = true; return; }
  el.hidden = false;
  const mem = groupMembers();
  const rows: string[] = [];
  const counts = new Map<number, number>();
  for (const q of [...enc.allyQ]) counts.set(q.g, (counts.get(q.g) ?? 0) + 1);
  for (const G of enc.groups) {
    const n = (mem.get(G.id)?.length ?? 0), w = counts.get(G.id) ?? 0;
    if (!n && !w) continue;
    const names = [...new Set((mem.get(G.id) ?? []).map((f) => enc!.troopOf.get(f.id)!))].map((t) => TROOPS[t].name[lang].split(" ")[0]).join(", ");
    const shooters = (mem.get(G.id) ?? []).filter((f) => f.primary);
    const ammo = shooters.reduce((a, f) => a + f.ammo, 0);
    rows.push(`<div class="${enc.sel.has(G.id) ? "sel" : ""}"><b>${G.id}</b> ${names || "—"} <span>${n}${w ? "+" + w : ""} · ${G.reserve ? L("rezerwa", "reserve") : ORDER_NAMES[G.order][lang]} · ${FORM_NAMES[G.formation][lang]}${shooters.length ? ` · ${FIRE_NAMES[G.fire][lang]} · ${L("pocisków", "ammo")} ${ammo}` : ""}</span></div>`);
  }
  const fled = enc.routed[0].length;
  let menu = "";
  if (enc.deploy) menu = L("Rozstawienie · klik: ustaw · F2 formacja · R rezerwa · spacja: do boju", "Deploy · click: place · F2 formation · R reserve · space: fight");
  else if (enc.menu === "move") menu = "F1 " + L("stać tutaj", "hold here") + " · F2 " + L("za mną", "follow") + " · F3 " + L("naprzód", "charge") + " · F4 " + L("cofnąć się", "fall back");
  else if (enc.menu === "form") menu = FORMATIONS.map((f, i) => `F${i + 1} ${FORM_NAMES[f][lang]}`).join(" · ");
  else if (enc.menu === "fire") menu = "F1 " + FIRE_NAMES.free[lang] + " · F2 " + FIRE_NAMES.hold[lang] + " · F3 " + FIRE_NAMES.volley[lang];
  else menu = L("F1 ruch · F2 formacja · F3 rezerwa · F4 ogień · X okrzyk", "F1 move · F2 formation · F3 reserve · F4 fire · X war cry") + (enc.cryCD > 0 ? ` (${Math.ceil(enc.cryCD)} s)` : "") + (camp?.co.hero.necro ? " · N " + L("wskrześ", "raise") + (enc.raiseCD > 0 ? ` (${Math.ceil(enc.raiseCD)} s)` : "") : "");
  el.innerHTML = rows.join("") + (fled ? `<div class="fled">${L("uciekło", "fled")}: ${fled}</div>` : "") + `<div class="menu">${menu}</div>`;
}

/** win: true / false, or null = player knocked out → the rest is decided without him. */
function endEncounter(win: boolean | null) {
  if (!enc || !camp || !ui) return;
  const c = camp, me = c.co.party, p = enc.enemy;
  // who fell, and how: blunt wounds, blades kill, a severed limb always kills
  let myDead = 0, myWounded = 0, theirDead = 0;
  const fate = (f: Warrior): "dead" | "wounded" => { const ty = (f as Warrior & { lastType?: string }).lastType; return f.severed.size > 0 || ty !== "blunt" ? "dead" : "wounded"; };
  const lose = (party: Party, t: TroopId, how: "dead" | "wounded") => { const s = party.troops.find((x) => x.t === t); if (!s) return; if (how === "dead") { s.n--; s.wounded = Math.min(s.wounded, s.n); } else s.wounded = Math.min(s.n, s.wounded + 1); };
  const surg = c.co.hero.skills.chirurgia * 0.04;
  for (const f of fighters) {
    if (f.alive || f === player) continue;
    const t = enc.troopOf.get(f.id); if (!t || enc.risen.has(f.id)) continue;
    let how: "dead" | "wounded" = fate(f);
    if (f.team === 0 && how === "dead" && f.severed.size === 0 && Math.random() < surg) how = "wounded";   // the surgeon saves one
    if (f.team === 0) { lose(me, t, how); if (how === "dead") myDead++; else myWounded++; }
    else { lose(p, t, how); if (how === "dead") theirDead++; }
  }
  me.troops = me.troops.filter((s) => s.n > 0); p.troops = p.troops.filter((s) => s.n > 0);
  let body = "";
  const stood = fighters.filter((f) => f.alive && enc!.risen.has(f.id)).length;
  if (stood && win !== false) { c.addTroops(me, "zywy_trup", stood); body += `<p class="meta">${stood} wskrzeszonych idzie za tobą dalej (żywe trupy).</p>`; }
  if (win === null) {
    const res = c.autoResolve(p);
    win = res.win;
    myDead += res.mine.killed; myWounded += res.mine.wounded; theirDead += res.theirs.killed;
    body += `<p>Padasz ogłuszony. Gdy otwierasz oczy, ${win ? "twoi ludzie stoją nad trupami wroga" : "twoi ludzie wloką cię z pola"}.</p>`;
    c.note("Zostałeś ogłuszony w bitwie. Głowa pęka, ale żyjesz.", "warn");
  } else body += `<p>${win ? (enc.routed[1].length ? `Wróg pęka. ${enc.routed[1].length} uciekło w zarośla.` : "Ostatni z wrogów pada w błoto.") : "Wycofujecie się."}</p>`;
  body += `<p class="meta">Twoje straty: ${myDead} zabitych, ${myWounded} rannych${enc.routed[0].length ? `, ${enc.routed[0].length} uciekło z pola (wrócili po bitwie)` : ""}. Wróg: ${theirDead} zabitych.</p>`;
  if (enc.routed[0].length) c.co.morale -= enc.routed[0].length * 1.5;
  c.co.hero.kills += kills;
  const hrs = ((hour - enc.startHour) + 24) % 24;
  c.co.inside = true;
  c.passHours(Math.min(3, Math.max(0.5, hrs)));
  const e = enc; enc = null;
  mode = "map"; started = false; battleKind = "waves";
  $("mapHud").hidden = false; $("labels").hidden = false; $("glabels").hidden = true; ($("orders") as HTMLElement).hidden = true; setBattleHud(false); $("banner").hidden = true;
  try { document.exitPointerLock(); } catch { /* */ }
  fighters = []; brains.clear(); player = undefined as unknown as Warrior;
  ui.after(e.enemy, win, myDead, theirDead, 0, body);
  saveCampaign();
}

// ---------- loop ----------
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === "map") { if (!paused) mapStep(dt); renderMap(now); }
  else {
    if (started && player && !paused) step(dt);
    if (player && mode === "battle") render(now); else renderIdle(now);
  }
  requestAnimationFrame(loop);
}

// hooks for automated tests
(window as unknown as { mb2: unknown }).mb2 = {
  get player() { return player; }, get fighters() { return fighters; },
  collapse(team: number) { collapseUndead(team); }, events: EVENTS, projCount: () => projs.filter((q) => q.stuck <= 0).length, projs: () => projs.map((q) => [q.x, q.y, q.z, q.vx, q.vy, q.vz, q.stuck].map((v) => Math.round(v * 100) / 100)), aimAt(o: Warrior) { for (let i = 0; i < 4; i++) { const px = player.x - Math.cos(camYaw) * 0.55, pz = player.z + Math.sin(camYaw) * 0.55; camYaw = Math.atan2(o.x - px, o.z - pz); camPitch = Math.atan2(o.y + 1.25 - (player.y + 1.82), Math.hypot(o.x - px, o.z - pz) + 3.3); } player.yaw = camYaw; }, spawnMonster(id: string) { if (camp) spawnMonster(camp, id); }, spawnLord(id: string) { if (camp) { const q = camp.parties.find((x) => x.lord === id); if (q) return q; camp.fx.lords[id].captive = false; return spawnLord(camp, id, 0.7); } return null; }, spawnHunters() { if (camp) spawnHunters(camp); },
  get camp() { return camp; }, get ui() { return ui; }, get mode() { return mode; }, get enc() { return enc; },
  campaign() { startCampaign(); }, waves() { startWaves(); },
  mapTick(sec: number) { for (let i = 0; i < sec * 30; i++) mapStep(1 / 30); },
  mapCam(yaw: number, pitch: number, dist: number) { mapYaw = yaw; mapPitch = pitch; mapDist = dist; },
  endBattle(win: boolean | null) { endEncounter(win); },
  killFoes() { for (const f of fighters) if (f.team === 1) { f.hp = 0; f.die(); } if (enc) enc.enemyQ.length = 0; },
  start() { startWaves(); }, setHour(h: number) { hour = h; }, pause(v: boolean) { paused = v; },
  look(yaw: number, pitch: number) { camYaw = yaw; camPitch = pitch; },
  attack(d: Dir) { player.attack(d); }, block(d: Dir) { player.block(d); }, unblock() { player.unblock(); }, spawn() { spawnWave(); },
  setLmb(v: boolean) { lmb = v; }, tick(sec: number) { for (let i = 0; i < sec * 60; i++) { step(1 / 60); for (const f of fighters) f.draw([]); } }, noAI(v: boolean) { noAI = v; }, gibs: () => gibs.length, cam(e: V3 | null, t?: V3) { camOverride = e && t ? [e, t] : null; }, dbg: () => JSON.stringify({ tokens, b: [...brains.values()].map((b) => ({ cd: b.cooldown, tok: b.me.aiToken, st: b.me.state, mcd: b.me.cd })) }), bot(x: number, z: number, run = false) { botWish = x || z ? [x, z] : null; botRun = run; }, weapon(i: number) { weaponSlot = i; player.setKit(R, playerKit()); },
};
requestAnimationFrame(loop);

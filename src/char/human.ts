// Base human: render styles, rig and body meshes. Each body part is a rigid
// mesh bound to one joint (PS1-era construction). Skirts are split into
// left/right halves on their own joints that follow the thighs, so legs
// never punch through cloth when walking or fighting.
import { Mat4, m4, mul, trs } from "../core/math.ts";
import { TMesh, Ring } from "./tmesh.ts";
import { REG, Region } from "./atlas.ts";

export type Level = "ps1b" | "hybrid" | "ps2" | "n64" | "painted" | "print" | "ink" | "ps1a" | "horror" | "amiga" | "facet" | "hybridink" | "hfa" | "hfb" | "hfc";
export interface LevelSpec {
  id: Level; name: string; era: string; origin: string;
  limb: number; torso: number; head: number; subdiv: boolean; smooth: boolean;
  tex: 1 | 2 | 4;                 // atlas downsample factor (256 / tex)
  res: number;                    // internal render height
  snap: boolean; affine: boolean; dither: boolean; bilinear: boolean;
  extras: boolean;                // nose, ears, thumbs
  shader: number;                 // 0 standard, 1 n64, 2 painted, 3 1-bit print, 4 ink cel, 7 flat facets
  outline: boolean; vertexSpec: boolean;
  post: number;                   // 0 none, 1 horror grain + vignette, 2 16-colour palette
  fog: [number, number];          // start, length (m)
  mips?: boolean;                 // build mip levels (facet styles average a face's colour)
}
const lo = { limb: 6, torso: 8, head: 9, subdiv: false };
const hi = { limb: 8, torso: 12, head: 14, subdiv: true };
const mid = { limb: 8, torso: 12, head: 12, subdiv: false };
const base = { extras: true, outline: false, vertexSpec: false, post: 0, fog: [3.5, 9] as [number, number] };
export const LEVELS: Record<Level, LevelSpec> = {
  ps1b: { ...base, id: "ps1b", name: "PS1 późne", era: "ok. 1999", origin: "Schyłek PlayStation (Vagrant Story, MGS, Medievil): drgające wierzchołki, falujące tekstury, dithering 15-bit, połysk liczony na wierzchołkach.", ...lo, smooth: true, tex: 2, res: 240, snap: true, affine: true, dither: true, bilinear: false, shader: 0, vertexSpec: true },
  hybrid: { ...base, id: "hybrid", name: "Hybryda PS1+PS2", era: "propozycja", origin: "Bryła i odbicia z PS2, ostre piksele tekstur i dithering z PS1, obraz 360 linii bez drgań. Tą drogą idą współczesne retro gry (Dusk, Ultrakill, Iron Lung).", ...hi, smooth: true, tex: 2, res: 360, snap: false, affine: false, dither: true, bilinear: false, shader: 0 },
  hybridink: { ...base, id: "hybridink", name: "Hybryda z konturem", era: "propozycja", origin: "Hybryda PS1+PS2 z cienkim konturem z tuszu: sylwetki czytelne w tłumie i w mroku, a reszta zostaje retro.", ...hi, smooth: true, tex: 2, res: 360, snap: false, affine: false, dither: true, bilinear: false, shader: 0, outline: true },
  hfa: { ...base, id: "hfa", name: "Hybryda fasetowa", era: "standard gry", origin: "Pełne tekstury hybrydy, ale światło liczone na każdy trójkąt osobno: bryła pokazuje swoje płaszczyzny jak wyciosana, detal z tekstur zostaje.", ...mid, smooth: true, tex: 2, res: 360, snap: false, affine: false, dither: true, bilinear: false, shader: 8, mips: true },
  hfb: { ...base, id: "hfb", name: "Fasety z detalem", era: "mieszanka B", origin: "Każdy trójkąt dostaje uśredniony kolor, a tekstura prześwituje do połowy: płaskie plamy barwy jak w low-poly, ale twarz, herb i ogniwa nadal czytelne.", ...mid, smooth: true, tex: 2, res: 360, snap: false, affine: false, dither: true, bilinear: false, shader: 9, mips: true },
  hfc: { ...base, id: "hfc", name: "Fasety, metal z teksturą", era: "mieszanka C", origin: "Sukno, skóra i drewno jako płaskie fasety, a metal (kolczuga, płyty, hełmy, broń) w pełnej teksturze z refleksami: zbroja odcina się od reszty.", ...mid, smooth: true, tex: 2, res: 360, snap: false, affine: false, dither: true, bilinear: false, shader: 10, mips: true },
  ps2: { ...base, id: "ps2", name: "PS2", era: "ok. 2003", origin: "PlayStation 2 (Shadow of the Colossus, Drakengard): więcej trójkątów, wygładzone tekstury 256 px, odbicia z mapy otoczenia.", ...hi, smooth: true, tex: 1, res: 448, snap: false, affine: false, dither: false, bilinear: true, shader: 0 },
  horror: { ...base, id: "horror", name: "Horror PS1", era: "1999 / dziś", origin: "Silent Hill i dzisiejsze horrory w duchu PSX (Puppet Combo, Lunacid): gęsta mgła blisko kamery, ziarno, winieta, zgaszone kolory. Najbardziej duszny wariant.", ...lo, smooth: true, tex: 2, res: 240, snap: true, affine: true, dither: true, bilinear: false, shader: 0, vertexSpec: true, post: 1, fog: [1.6, 5.5] },
  amiga: { ...base, id: "amiga", name: "Paleta 16 kolorów", era: "ok. 1990", origin: "Amiga i DOS (Darklands, Hexen) oraz dzisiejsze gry z zamkniętą paletą (Blasphemous): każdy piksel zmuszony do jednej z 16 ponurych barw, z ditheringiem.", ...hi, smooth: true, tex: 2, res: 240, snap: false, affine: false, dither: false, bilinear: false, shader: 0, post: 2 },
  facet: { ...base, id: "facet", name: "Płaskie fasety", era: "2014–dziś", origin: "Nowoczesne low-poly bez tekstur (Mount & Blade-owe mody low-poly, Totally Accurate Battle Simulator, Superhot): jeden kolor na trójkąt, ostre krawędzie brył.", ...lo, smooth: false, tex: 4, res: 540, snap: false, affine: false, dither: false, bilinear: false, shader: 7 },
  n64: { ...base, id: "n64", name: "N64", era: "ok. 1998", origin: "Nintendo 64 (Ocarina of Time): bardzo małe tekstury rozmyte filtrem, miękkie cieniowanie, gęsta mgła.", ...lo, smooth: true, tex: 4, res: 240, snap: false, affine: false, dither: true, bilinear: true, shader: 1, vertexSpec: true },
  painted: { ...base, id: "painted", name: "Ręcznie malowany", era: "ok. 2002–2004", origin: "Blizzard (Warcraft III, World of Warcraft): mało trójkątów, cała robota w malowanej teksturze, miękkie owinięte światło, nasycone barwy.", ...hi, smooth: true, tex: 1, res: 448, snap: false, affine: false, dither: false, bilinear: true, shader: 2 },
  print: { ...base, id: "print", name: "Drzeworyt 1-bit", era: "2018", origin: "Return of the Obra Dinn (Lucas Pope), z grafiki starych Macintoshy: dwa kolory, raster z ditheringu, kontury. Wygląda jak ryciny z kronik.", ...hi, smooth: true, tex: 1, res: 360, snap: false, affine: false, dither: false, bilinear: false, shader: 3, outline: true },
  ink: { ...base, id: "ink", name: "Tusz i cień", era: "2016–2020", origin: "Komiksy Mike'a Mignoli (Hellboy) i Darkest Dungeon: twarde pasma cienia, czarny kontur, ostry refleks na metalu.", ...hi, smooth: true, tex: 2, res: 400, snap: false, affine: false, dither: false, bilinear: false, shader: 4, outline: true },
  ps1a: { ...base, id: "ps1a", name: "PS1 wczesne", era: "ok. 1996", origin: "Pierwsze gry 3D na PlayStation: płaskie fasety, tekstury 64 px.", limb: 4, torso: 6, head: 6, subdiv: false, smooth: false, tex: 4, res: 240, snap: true, affine: true, dither: true, bilinear: false, extras: false, shader: 0, vertexSpec: true },
};

export type Joint = "pelvis" | "torso" | "head" | "uarmL" | "farmL" | "handL" | "uarmR" | "farmR" | "handR" | "thighL" | "shinL" | "footL" | "thighR" | "shinR" | "footR" | "skirtL" | "skirtR";
export const RIG: Record<Joint, { parent: Joint | null; at: [number, number, number] }> = {
  pelvis: { parent: null, at: [0, 0.93, 0] },
  torso: { parent: "pelvis", at: [0, 0.12, 0] },
  head: { parent: "torso", at: [0, 0.405, 0.005] },
  uarmL: { parent: "torso", at: [0.172, 0.35, 0] }, farmL: { parent: "uarmL", at: [0, -0.29, 0] }, handL: { parent: "farmL", at: [0, -0.26, 0] },
  uarmR: { parent: "torso", at: [-0.172, 0.35, 0] }, farmR: { parent: "uarmR", at: [0, -0.29, 0] }, handR: { parent: "farmR", at: [0, -0.26, 0] },
  thighL: { parent: "pelvis", at: [0.095, -0.05, 0] }, shinL: { parent: "thighL", at: [0, -0.43, 0] }, footL: { parent: "shinL", at: [0, -0.42, 0] },
  thighR: { parent: "pelvis", at: [-0.095, -0.05, 0] }, shinR: { parent: "thighR", at: [0, -0.43, 0] }, footR: { parent: "shinR", at: [0, -0.42, 0] },
  skirtL: { parent: "pelvis", at: [0, 0.1, 0] }, skirtR: { parent: "pelvis", at: [0, 0.1, 0] },
};
export const JOINTS = Object.keys(RIG) as Joint[];
/** Skirt joints sit at the waist; meshes are authored in pelvis space and shifted by this. */
export const SKIRT_PIVOT = 0.1;

export interface Part { joint: Joint; mesh: TMesh }

/** Insert a slightly bulged midpoint ring between every pair (PS2 roundness). */
export function sub(rings: Ring[]): Ring[] {
  const out: Ring[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    out.push(a);
    const k = 1.025;
    out.push([(a[0] + b[0]) / 2, ((a[1] + b[1]) / 2) * k, ((a[2] + b[2]) / 2) * k, ((a[3] ?? 0) + (b[3] ?? 0)) / 2, ((a[4] ?? 0) + (b[4] ?? 0)) / 2]);
  }
  out.push(rings[rings.length - 1]);
  return out;
}

/** Emit a skirt as two halves on skirtL/skirtR (authored in pelvis space). */
export function skirt(add: (j: Joint, f: (t: TMesh) => void) => void, rings: Ring[], sides: number, R: Region, o: Record<string, unknown>, mat = 0) {
  const m = trs(m4(), 0, -SKIRT_PIVOT, 0);
  const half = Math.max(3, Math.ceil(sides / 2));
  add("skirtL", (t) => { t.mat = mat; t.loft(m, rings, half, R, { ...o, arc: [-0.03, 0.53] }); });
  add("skirtR", (t) => { t.mat = mat; t.loft(m, rings, half, R, { ...o, arc: [0.47, 1.03], ...(o.tile ? {} : {}) }); });
}

export interface BodyOpts { fistL?: boolean; fistR?: boolean; hide?: Set<string> }

export function buildHuman(L: LevelSpec, opt: BodyOpts = {}): { parts: Part[]; tris: number } {
  const parts: Part[] = [];
  const hide = opt.hide ?? new Set<string>();
  const S = (r: Ring[]) => (L.subdiv ? sub(r) : r);
  const add = (joint: Joint, f: (t: TMesh) => void) => { const t = new TMesh(256); f(t); parts.push({ joint, mesh: t }); };
  const o = { smooth: L.smooth };
  const I = () => m4();

  add("pelvis", (t) => {
    t.loft(I(), S([[-0.11, 0.15, 0.1], [0, 0.165, 0.112], [0.12, 0.15, 0.1]]), L.torso, REG.pelvis, { ...o, capBot: true });
    if (!hide.has("belt")) t.loft(I(), [[0.085, 0.17, 0.118], [0.135, 0.162, 0.112]], L.torso, REG.belt, o);
  });
  if (!hide.has("belt")) add("pelvis", (t) => {
    // buckle and a purse on the belt
    t.box(trs(m4(), 0, 0.15, 0.124), 0.045, 0.034, 0.012, { x: REG.belt.x + 30, y: REG.belt.y + 1, w: 4, h: 6 });
    t.box(trs(m4(), -0.125, 0.09, 0.085, -0.55), 0.06, 0.075, 0.03, { x: REG.belt.x + 8, y: REG.belt.y, w: 12, h: 8 });
  });
  if (!hide.has("skirt")) skirt(add, S([[-0.26, 0.225, 0.17, 0, 0.005], [-0.08, 0.195, 0.14], [0.11, 0.166, 0.113]]), L.torso, REG.skirt, o);
  if (!hide.has("torso")) add("torso", (t) => {
    t.loft(I(), S([[0, 0.152, 0.102], [0.11, 0.168, 0.112, 0, 0.008], [0.22, 0.185, 0.122, 0, 0.014], [0.31, 0.19, 0.116, 0, 0.004], [0.38, 0.17, 0.102], [0.415, 0.115, 0.084], [0.44, 0.065, 0.062]]), L.torso, REG.torso, { ...o, capTop: true });
  });
  if (!hide.has("head")) add("head", (t) => {
    t.mat = 0.25;
    t.loft(I(), S([[-0.02, 0.05, 0.05], [0.06, 0.053, 0.057, 0, 0.004], [0.085, 0.07, 0.08, 0, 0.012], [0.125, 0.082, 0.096, 0, 0.012], [0.17, 0.088, 0.1, 0, 0.008], [0.215, 0.091, 0.103], [0.255, 0.087, 0.099, 0, -0.005], [0.282, 0.073, 0.084, 0, -0.009], [0.3, 0.048, 0.056, 0, -0.011], [0.308, 0.018, 0.022, 0, -0.011]]), L.head, REG.head, { ...o, capTop: true });
    if (L.extras && !hide.has("face")) {
      const nose: Region = { x: REG.head.x + 31, y: REG.head.y + 27, w: 2, h: 5 };
      t.box(trs(m4(), 0, 0.166, 0.1, 0, -0.22), 0.019, 0.045, 0.022, nose);
      // brow ridge, cheekbones and jaw: the face reads from a distance instead of a painted egg
      const skinR: Region = { x: REG.head.x + 28, y: REG.head.y + 22, w: 8, h: 3 };
      t.box(trs(m4(), 0, 0.2, 0.087, 0, 0.12), 0.11, 0.016, 0.026, skinR);
      for (const sd of [1, -1]) t.box(trs(m4(), sd * 0.05, 0.16, 0.078, sd * 0.45), 0.034, 0.022, 0.03, skinR);
      const jaw: Region = { x: REG.head.x + 26, y: REG.head.y + 40, w: 12, h: 4 };
      t.box(trs(m4(), 0, 0.098, 0.074, 0, 0.35), 0.06, 0.04, 0.036, jaw);
      if (!hide.has("ears")) {
        const ear: Region = { x: REG.head.x + 15, y: REG.head.y + 25, w: 3, h: 8 };
        t.box(trs(m4(), 0.09, 0.175, -0.005, 0.25), 0.018, 0.05, 0.03, ear);
        t.box(trs(m4(), -0.09, 0.175, -0.005, -0.25), 0.018, 0.05, 0.03, ear);
      }
    }
  });
  for (const s of ["L", "R"] as const) {
    const side = s === "L" ? 1 : -1;
    if (!hide.has("uarm")) add(`uarm${s}`, (t) => t.loft(I(), S([[-0.3, 0.043, 0.043], [-0.16, 0.05, 0.05], [-0.04, 0.058, 0.056], [0.015, 0.052, 0.052], [0.045, 0.026, 0.03]]), L.limb, REG.uarm, { ...o, capTop: true }));
    if (!hide.has("farm")) add(`farm${s}`, (t) => t.loft(I(), S([[-0.27, 0.031, 0.029], [-0.16, 0.041, 0.04], [-0.05, 0.046, 0.044], [0.02, 0.042, 0.042]]), L.limb, REG.farm, o));
    const fist = s === "L" ? opt.fistL : opt.fistR;
    if (!hide.has("hand" + s)) add(`hand${s}`, (t) => {
      if (fist) {
        // closed fist around a grip that runs along the hand's Z axis
        t.loft(I(), [[-0.115, 0.024, 0.05, 0, 0.004], [-0.09, 0.03, 0.054], [-0.045, 0.028, 0.05], [-0.01, 0.022, 0.038], [0.012, 0.022, 0.03]], Math.max(4, L.limb - 2), REG.hand, { ...o, capBot: true });
        if (L.extras) t.loft(trs(m4(), side * 0.02, -0.07, 0.03, 0, -1.2), [[-0.045, 0.011, 0.012], [0, 0.015, 0.015]], 4, REG.thumb, { ...o, capBot: true });
      } else {
        t.loft(I(), [[-0.165, 0.012, 0.03, 0, 0.01], [-0.12, 0.016, 0.044, 0, 0.006], [-0.065, 0.021, 0.047], [-0.02, 0.02, 0.036], [0.01, 0.022, 0.03]], Math.max(4, L.limb - 2), REG.hand, { ...o, capBot: true });
        if (L.extras) t.loft(trs(m4(), -side * 0.004, -0.04, 0.036, 0, -0.35), [[-0.07, 0.01, 0.011], [0, 0.015, 0.015]], 4, REG.thumb, { ...o, capBot: true });
      }
    });
    add(`thigh${s}`, (t) => t.loft(I(), S([[-0.44, 0.058, 0.06], [-0.3, 0.068, 0.074], [-0.12, 0.083, 0.09, 0, 0.004], [0.03, 0.085, 0.088]]), L.limb, REG.thigh, { ...o, capTop: true }));
    add(`shin${s}`, (t) => {
      t.loft(I(), S([[-0.42, 0.044, 0.048], [-0.3, 0.052, 0.056], [-0.18, 0.057, 0.066, 0, -0.008], [-0.05, 0.054, 0.06], [0.02, 0.05, 0.054]]), L.limb, REG.shin, o);
      if (L.extras) {
        t.box(trs(m4(), 0, -0.01, 0.047, 0, 0.1), 0.06, 0.07, 0.03, { x: REG.shin.x + 12, y: REG.shin.y + 2, w: 8, h: 6 });   // kneecap
        // turned-down boot cuff
        t.loft(I(), [[-0.3, 0.056, 0.062], [-0.25, 0.06, 0.066], [-0.235, 0.05, 0.056]], L.limb, REG.foot, { ...o });
      }
    });
    add(`foot${s}`, (t) => {
      const m = trs(m4(), 0, 0, 0, 0, Math.PI / 2);   // loft +Y becomes +Z (toes forward); ring oz becomes downward
      t.loft(m, [[-0.06, 0.042, 0.045, 0, 0.033], [0, 0.048, 0.05, 0, 0.028], [0.09, 0.052, 0.036, 0, 0.043], [0.17, 0.045, 0.022, 0, 0.055], [0.2, 0.028, 0.014, 0, 0.06]], Math.max(4, L.limb), REG.foot, { ...o, capTop: true, capBot: true });
    });
  }
  return { parts, tris: parts.reduce((a, p) => a + p.mesh.tris, 0) };
}

export type V3 = [number, number, number];
/** A pose: euler rotations per joint, optional local rotation matrices (from IK), hip bob and shield placement. */
export interface Pose { r: Partial<Record<Joint, V3>>; m?: Partial<Record<Joint, Mat4>>; bob?: number; root?: V3 }

/** World matrix for every joint. Skirt halves follow the thighs at reduced strength. */
export function solve(root: Mat4, pose: Pose): Record<Joint, Mat4> {
  const out = {} as Record<Joint, Mat4>;
  const r = { ...pose.r };
  for (const s of ["L", "R"] as const) {
    if (r[`skirt${s}`]) continue;
    const th = r[`thigh${s}`] ?? [0, 0, 0];
    r[`skirt${s}`] = [Math.max(-0.75, th[0] * 0.62), 0, th[2] * 0.5];
  }
  const rt = pose.root ?? [0, 0, 0];
  for (const j of JOINTS) {
    const rg = RIG[j], a = r[j] ?? [0, 0, 0];
    const y = rg.at[1] + (j === "pelvis" ? (pose.bob ?? 0) : 0);
    let local: Mat4;
    const ov = pose.m?.[j];
    if (ov) { local = trs(m4(), rg.at[0], y, rg.at[2]); mul(local, local, ov); }
    else local = trs(m4(), rg.at[0], y, rg.at[2], a[1], a[0], a[2]);
    if (j === "pelvis" && (rt[0] || rt[1] || rt[2])) local = mul(m4(), trs(m4(), rt[0], rt[1], rt[2]), local);
    out[j] = rg.parent ? mul(m4(), out[rg.parent], local) : mul(m4(), root, local);
  }
  return out;
}

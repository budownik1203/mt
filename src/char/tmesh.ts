// Textured mesh builder: lofted cross-sections (limbs, torso, head) and UV boxes.
import { Mat4, xform } from "../core/math.ts";
import { Region } from "./atlas.ts";

/** [y, rx, rz, ox, oz] — a cross-section ring along local +Y. */
export type Ring = [number, number, number, number?, number?];

export class TMesh {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; mats: number[] = [];
  /** Material for following geometry: 0 matte, 1 mail/dull metal, 2 polished plate. */
  mat = 0;
  constructor(public atlasSize = 256) {}

  private nx(m: Mat4, n: number[]) {
    const v = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  uvOf(R: Region, u: number, v: number) {
    // half-texel inset so nearest sampling never bleeds into a neighbour region
    const s = this.atlasSize, i = 0.5;
    return [(R.x + i + u * (R.w - 2 * i)) / s, (R.y + i + v * (R.h - 2 * i)) / s];
  }
  push(p: number[], n: number[], t: number[]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(t[0], t[1]); this.mats.push(this.mat); }
  tri(p: number[][], n: number[][], t: number[][]) { for (let k = 0; k < 3; k++) this.push(p[k], n[k], t[k]); }

  /** Loft along +Y. smooth = shared normals per ring (Gouraud), else faceted. */
  loft(m: Mat4, rings: Ring[], sides: number, R: Region, o: { smooth?: boolean; capTop?: boolean; capBot?: boolean; u0?: number; u1?: number; tile?: [number, number]; arc?: [number, number] } = {}) {
    const smooth = o.smooth ?? true, u0 = o.u0 ?? 0, u1 = o.u1 ?? 1;
    const yTop = rings[rings.length - 1][0], yBot = rings[0][0];
    const P: number[][][] = [], N: number[][][] = [], UV: number[][][] = [];
    rings.forEach((rg, ri) => {
      const [y, rx, rz, ox = 0, oz = 0] = rg;
      const prev = rings[Math.max(0, ri - 1)], next = rings[Math.min(rings.length - 1, ri + 1)];
      const dr = ((next[1] + next[2]) - (prev[1] + prev[2])) / 2, dy = next[0] - prev[0] || 1;
      const row: number[][] = [], nrow: number[][] = [], urow: number[][] = [];
      for (let i = 0; i <= sides; i++) {
        const u = o.arc ? o.arc[0] + (o.arc[1] - o.arc[0]) * (i / sides) : i / sides, a = 2 * Math.PI * u - Math.PI / 2;
        const c = Math.cos(a), s = Math.sin(a);
        row.push(xform(m, c * rx + ox, y, s * rz + oz));
        let hx = c / Math.max(rx, 1e-3), hz = s / Math.max(rz, 1e-3);
        const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
        nrow.push(this.nx(m, [hx, -dr / dy, hz]));
        const vv = (yTop - y) / (yTop - yBot || 1);
        urow.push(o.tile ? [u * o.tile[0], vv * o.tile[1]] : this.uvOf(R, u0 + (u1 - u0) * u, vv));
      }
      P.push(row); N.push(nrow); UV.push(urow);
    });
    for (let r = 0; r < rings.length - 1; r++)
      for (let i = 0; i < sides; i++) {
        const a = P[r][i], b = P[r][i + 1], c = P[r + 1][i + 1], d = P[r + 1][i];
        const ta = UV[r][i], tb = UV[r][i + 1], tc = UV[r + 1][i + 1], td = UV[r + 1][i];
        if (smooth) {
          this.tri([a, c, b], [N[r][i], N[r + 1][i + 1], N[r][i + 1]], [ta, tc, tb]);
          this.tri([a, d, c], [N[r][i], N[r + 1][i], N[r + 1][i + 1]], [ta, td, tc]);
        } else {
          const fn = faceN(a, c, b);
          this.tri([a, c, b], [fn, fn, fn], [ta, tc, tb]);
          this.tri([a, d, c], [fn, fn, fn], [ta, td, tc]);
        }
      }
    const cap = (ri: number, up: boolean) => {
      const rg = rings[ri];
      const ctr = xform(m, rg[3] ?? 0, rg[0], rg[4] ?? 0);
      const nn = this.nx(m, [0, up ? 1 : -1, 0]);
      const tcen = o.tile ? [0.5, up ? 0 : o.tile[1]] : this.uvOf(R, 0.5, up ? 0 : 1);
      for (let i = 0; i < sides; i++) {
        const a = P[ri][i], b = P[ri][i + 1];
        if (up) this.tri([ctr, a, b], [nn, nn, nn], [tcen, UV[ri][i], UV[ri][i + 1]]);
        else this.tri([ctr, b, a], [nn, nn, nn], [tcen, UV[ri][i + 1], UV[ri][i]]);
      }
    };
    if (o.capTop) cap(rings.length - 1, true);
    if (o.capBot) cap(0, false);
  }

  /** UV box, whole region on every face. */
  box(m: Mat4, w: number, h: number, d: number, R: Region) {
    const x = w / 2, y = h / 2, z = d / 2;
    const v = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]].map((p) => xform(m, p[0], p[1], p[2]));
    const f = (a: number, b: number, c: number, dd: number) => {
      const n = faceN(v[a], v[b], v[c]);
      const t = [this.uvOf(R, 0, 1), this.uvOf(R, 1, 1), this.uvOf(R, 1, 0), this.uvOf(R, 0, 0)];
      this.tri([v[a], v[b], v[c]], [n, n, n], [t[0], t[1], t[2]]);
      this.tri([v[a], v[c], v[dd]], [n, n, n], [t[0], t[2], t[3]]);
    };
    f(4, 5, 6, 7); f(1, 0, 3, 2); f(5, 1, 2, 6); f(0, 4, 7, 3); f(7, 6, 2, 3); f(0, 1, 5, 4);
  }

  /** Flat outline (x,y pairs, convex fan from centroid) extruded along Z; front faces +Z. */
  plate2d(m: Mat4, pts: number[][], depth: number, front: Region, back: Region, rim: Region) {
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const uvF = (x: number, y: number, R: Region, flip: boolean) => this.uvOf(R, flip ? 1 - (x - minx) / (maxx - minx) : (x - minx) / (maxx - minx), 1 - (y - miny) / (maxy - miny));
    const z = depth / 2;
    const nf = this.nx(m, [0, 0, 1]), nb = this.nx(m, [0, 0, -1]);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      // bulge: centre sits a little proud of the rim, like a curved shield
      this.tri([xform(m, cx, cy, z + depth), xform(m, a[0], a[1], z), xform(m, b[0], b[1], z)], [nf, nf, nf], [uvF(cx, cy, front, false), uvF(a[0], a[1], front, false), uvF(b[0], b[1], front, false)]);
      this.tri([xform(m, cx, cy, -z), xform(m, b[0], b[1], -z), xform(m, a[0], a[1], -z)], [nb, nb, nb], [uvF(cx, cy, back, true), uvF(b[0], b[1], back, true), uvF(a[0], a[1], back, true)]);
      const A = xform(m, a[0], a[1], z), B = xform(m, b[0], b[1], z), C = xform(m, b[0], b[1], -z), D = xform(m, a[0], a[1], -z);
      const n = this.nx(m, [b[1] - a[1], a[0] - b[0], 0]);
      const t0 = this.uvOf(rim, 0, 0), t1 = this.uvOf(rim, 1, 0), t2 = this.uvOf(rim, 1, 1), t3 = this.uvOf(rim, 0, 1);
      this.tri([A, B, C], [n, n, n], [t0, t1, t2]); this.tri([A, C, D], [n, n, n], [t0, t2, t3]);
    }
  }

  get tris() { return this.pos.length / 9; }
}

function faceN(a: number[], b: number[], c: number[]) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

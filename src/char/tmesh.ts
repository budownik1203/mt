// Textured mesh builder: lofted cross-sections (limbs, torso, head) and UV boxes.
import { Mat4, xform } from "../core/math.ts";
import { Region } from "./atlas.ts";

/** [y, rx, rz, ox, oz] — a cross-section ring along local +Y. */
export type Ring = [number, number, number, number?, number?];

export class TMesh {
  pos: number[] = []; nor: number[] = []; uv: number[] = [];
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
  push(p: number[], n: number[], t: number[]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(t[0], t[1]); }
  tri(p: number[][], n: number[][], t: number[][]) { for (let k = 0; k < 3; k++) this.push(p[k], n[k], t[k]); }

  /** Loft along +Y. smooth = shared normals per ring (Gouraud), else faceted. */
  loft(m: Mat4, rings: Ring[], sides: number, R: Region, o: { smooth?: boolean; capTop?: boolean; capBot?: boolean; u0?: number; u1?: number } = {}) {
    const smooth = o.smooth ?? true, u0 = o.u0 ?? 0, u1 = o.u1 ?? 1;
    const yTop = rings[rings.length - 1][0], yBot = rings[0][0];
    const P: number[][][] = [], N: number[][][] = [], UV: number[][][] = [];
    rings.forEach((rg, ri) => {
      const [y, rx, rz, ox = 0, oz = 0] = rg;
      const prev = rings[Math.max(0, ri - 1)], next = rings[Math.min(rings.length - 1, ri + 1)];
      const dr = ((next[1] + next[2]) - (prev[1] + prev[2])) / 2, dy = next[0] - prev[0] || 1;
      const row: number[][] = [], nrow: number[][] = [], urow: number[][] = [];
      for (let i = 0; i <= sides; i++) {
        const u = i / sides, a = 2 * Math.PI * u - Math.PI / 2;
        const c = Math.cos(a), s = Math.sin(a);
        row.push(xform(m, c * rx + ox, y, s * rz + oz));
        let hx = c / Math.max(rx, 1e-3), hz = s / Math.max(rz, 1e-3);
        const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
        nrow.push(this.nx(m, [hx, -dr / dy, hz]));
        urow.push(this.uvOf(R, u0 + (u1 - u0) * u, (yTop - y) / (yTop - yBot || 1)));
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
      const tcen = this.uvOf(R, 0.5, up ? 0 : 1);
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

  get tris() { return this.pos.length / 9; }
}

function faceN(a: number[], b: number[], c: number[]) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

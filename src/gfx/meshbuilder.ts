// Builds flat-shaded, vertex-coloured triangle soups. Every primitive is
// placed with a transform matrix, so whole props can be merged into one mesh.
import { Mat4, m4, trs, xform, rng } from "../core/math.ts";

export type RGB = [number, number, number];
export const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export class MeshBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  private r = rng(1234);
  /** Per-face colour jitter, gives the painterly faceted look. */
  jitter = 0.06;

  tri(a: number[], b: number[], c: number[], color: RGB) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const j = 1 + (this.r() - 0.5) * 2 * this.jitter;
    const cr = color[0] * j, cg = color[1] * j, cb = color[2] * j;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(cr, cg, cb);
    }
  }

  quad(a: number[], b: number[], c: number[], d: number[], color: RGB) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Box centred on origin before transform. */
  box(m: Mat4, w: number, h: number, d: number, color: RGB) {
    const x = w / 2, y = h / 2, z = d / 2;
    const P = (px: number, py: number, pz: number) => xform(m, px, py, pz);
    const v = [P(-x, -y, -z), P(x, -y, -z), P(x, y, -z), P(-x, y, -z), P(-x, -y, z), P(x, -y, z), P(x, y, z), P(-x, y, z)];
    this.quad(v[4], v[5], v[6], v[7], color); // +z
    this.quad(v[1], v[0], v[3], v[2], color); // -z
    this.quad(v[5], v[1], v[2], v[6], color); // +x
    this.quad(v[0], v[4], v[7], v[3], color); // -x
    this.quad(v[7], v[6], v[2], v[3], color); // +y
    this.quad(v[0], v[1], v[5], v[4], color); // -y
  }

  /** Frustum along +Y from y=0 to y=h. r1 bottom radius, r2 top radius. */
  cyl(m: Mat4, r1: number, r2: number, h: number, seg: number, color: RGB, caps = true) {
    const ring = (r: number, y: number) => {
      const out: number[][] = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        out.push(xform(m, Math.cos(a) * r, y, Math.sin(a) * r));
      }
      return out;
    };
    const b = ring(r1, 0), t = ring(r2, h);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      if (r2 > 0) this.quad(b[i], t[i], t[j], b[j], color);
      else this.tri(b[i], t[i], b[j], color);
    }
    if (caps) {
      const cb = xform(m, 0, 0, 0), ct = xform(m, 0, h, 0);
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        this.tri(cb, b[i], b[j], color);
        if (r2 > 0) this.tri(ct, t[j], t[i], color);
      }
    }
  }

  /** Low-poly blob: icosahedron with optional random displacement. */
  rock(m: Mat4, r: number, color: RGB, bump = 0.25, seed = 1) {
    const t = (1 + Math.sqrt(5)) / 2;
    const vs = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
    const f = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    const rr = rng(seed * 977 + 3);
    const pts = vs.map((v) => {
      const l = Math.hypot(v[0], v[1], v[2]);
      const k = (r / l) * (1 + (rr() - 0.5) * 2 * bump);
      return xform(m, v[0] * k, v[1] * k, v[2] * k);
    });
    const ctr = xform(m, 0, 0, 0);
    for (const [a, b, c] of f) {
      const A = pts[a], B = pts[b], C = pts[c];
      const ux = B[0]-A[0], uy = B[1]-A[1], uz = B[2]-A[2], vx = C[0]-A[0], vy = C[1]-A[1], vz = C[2]-A[2];
      const n = [uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx];
      const out = (A[0]-ctr[0])*n[0] + (A[1]-ctr[1])*n[1] + (A[2]-ctr[2])*n[2];
      if (out >= 0) this.tri(A, B, C, color); else this.tri(A, C, B, color);
    }
  }

  merge(o: MeshBuilder) {
    this.pos.push(...o.pos); this.nor.push(...o.nor); this.col.push(...o.col);
  }

  get count() { return this.pos.length / 3; }
}

export const T = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) => trs(m4(), x, y, z, ry, rx, rz, s, s, s);

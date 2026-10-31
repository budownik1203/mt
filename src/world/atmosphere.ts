// Time of day and weather -> lighting. Grimdark palette: ashen days,
// rust dusks, cold blue nights. Rain thickens fog and darkens everything.
import { Lighting } from "../gfx/renderer.ts";
import { V3, lerp, clamp } from "../core/math.ts";

type Key = { h: number; sun: V3; zen: V3; hor: V3; sky: V3; gnd: V3; exp: number };
const K: Key[] = [
  { h: 0, sun: [0.05, 0.07, 0.12], zen: [0.01, 0.015, 0.03], hor: [0.04, 0.05, 0.08], sky: [0.05, 0.07, 0.11], gnd: [0.02, 0.02, 0.03], exp: 1.5 },
  { h: 5.2, sun: [0.1, 0.08, 0.1], zen: [0.04, 0.05, 0.09], hor: [0.18, 0.12, 0.12], sky: [0.09, 0.09, 0.12], gnd: [0.04, 0.03, 0.03], exp: 1.3 },
  { h: 6.5, sun: [1.2, 0.58, 0.3], zen: [0.15, 0.18, 0.26], hor: [0.6, 0.36, 0.24], sky: [0.19, 0.18, 0.21], gnd: [0.12, 0.09, 0.07], exp: 1.05 },
  { h: 9, sun: [1.25, 1.08, 0.86], zen: [0.22, 0.27, 0.34], hor: [0.46, 0.47, 0.47], sky: [0.24, 0.26, 0.3], gnd: [0.1, 0.09, 0.07], exp: 0.85 },
  { h: 15, sun: [1.3, 1.08, 0.82], zen: [0.22, 0.26, 0.33], hor: [0.48, 0.46, 0.44], sky: [0.25, 0.26, 0.29], gnd: [0.1, 0.09, 0.07], exp: 0.85 },
  { h: 18.3, sun: [1.4, 0.5, 0.2], zen: [0.16, 0.16, 0.24], hor: [0.7, 0.3, 0.16], sky: [0.2, 0.16, 0.18], gnd: [0.13, 0.08, 0.06], exp: 1.05 },
  { h: 19.6, sun: [0.15, 0.08, 0.1], zen: [0.05, 0.05, 0.1], hor: [0.22, 0.1, 0.1], sky: [0.1, 0.08, 0.12], gnd: [0.04, 0.03, 0.03], exp: 1.3 },
  { h: 24, sun: [0.05, 0.07, 0.12], zen: [0.01, 0.015, 0.03], hor: [0.04, 0.05, 0.08], sky: [0.05, 0.07, 0.11], gnd: [0.02, 0.02, 0.03], exp: 1.5 },
];

const l3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export interface Weather { rain: number; target: number }

export function lighting(hour: number, w: Weather): Lighting {
  let i = 0;
  while (i < K.length - 2 && hour >= K[i + 1].h) i++;
  const a = K[i], b = K[i + 1];
  const t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
  const sunCol = l3(a.sun, b.sun, t), zen = l3(a.zen, b.zen, t), hor = l3(a.hor, b.hor, t), sky = l3(a.sky, b.sky, t), gnd = l3(a.gnd, b.gnd, t);
  const exp = lerp(a.exp, b.exp, t);
  // sun path: rises east (+x), sets west, tilted south
  const ang = ((hour - 6) / 12) * Math.PI;
  let sd: V3 = [Math.cos(ang), Math.sin(ang), -0.45];
  const night = clamp((-sd[1] + 0.05) * 4, 0, 1);
  if (sd[1] < 0) sd = [-sd[0], -sd[1] * 0.9 + 0.25, -0.45];   // moon
  const l = Math.hypot(...sd); sd = [sd[0] / l, sd[1] / l, sd[2] / l];
  const r = w.rain;
  const grey = (c: V3, k: number): V3 => { const g = (c[0] + c[1] + c[2]) / 3; return l3(c, [g, g, g], k); };
  const sun = l3(sunCol, grey(sunCol, 1), r * 0.7).map((v) => v * (1 - r * 0.72)) as V3;
  const fog = l3(hor, grey(hor, 0.8), r * 0.6).map((v) => v * (1 - r * 0.3)) as V3;
  return {
    sunDir: sd, sunColor: sun,
    skyColor: grey(sky, r * 0.5), groundColor: gnd,
    fogColor: fog, fogDensity: lerp(0.0038, 0.02, r),
    zenith: l3(zen, grey(zen, 1), r * 0.8).map((v) => v * (1 - r * 0.25)) as V3,
    horizon: fog, night: night * (1 - r), points: [], exposure: exp, wet: r,
  };
}

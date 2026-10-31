// Captures an animation loop as numbered frames.
export default async (p) => {
  const j = JSON.parse(process.env.JOB);
  await p.setViewportSize({ width: 900, height: 720 });
  await p.waitForTimeout(300);
  for (let i = 0; i < j.n; i++) {
    const t = (i / j.n) * j.len;
    await p.evaluate(([j, t]) => lab.set({ spin: false, wire: false, light: j.light || "day", level: j.level, loadout: j.loadout, view: j.view, pose: j.pose, time: t, yaw: j.yaw, dist: j.dist, pitch: 0.08 }), [j, t]);
    await p.waitForTimeout(120);
    await p.locator("#view").screenshot({ path: `shots/anim/${j.name}_${String(i).padStart(3, "0")}.png` });
  }
};

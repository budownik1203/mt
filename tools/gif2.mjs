export default async (p) => {
  const j = JSON.parse(process.env.JOB);
  await p.setViewportSize({ width: 900, height: 720 });
  await p.evaluate(() => { const e = document.querySelector(".era"); if (e) e.hidden = true; const h = document.querySelector(".hint"); if (h) h.hidden = true; });
  await p.evaluate((j) => lab.set({ spin: false, light: j.light || "day", level: "hfa", loadout: j.loadout, weapon: j.weapon, move: "all", view: "q", pose: "combat", time: 0 }), j);
  await p.waitForTimeout(300);
  for (let i = 0; i < j.n; i++) {
    const t = i * j.dt;
    await p.evaluate(([j, t]) => lab.set({ time: t, yaw: j.yaw, dist: j.dist, pitch: 0.18 }), [j, t]);
    await p.waitForTimeout(90);
    await p.locator("#view").screenshot({ path: `shots/anim/${j.name}_${String(i).padStart(3, "0")}.png` });
  }
};

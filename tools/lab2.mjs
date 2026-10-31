// Renders: loadouts x styles (3/4) and style showcase.
export default async (p) => {
  const jobs = JSON.parse(process.env.JOBS);
  for (const j of jobs) {
    await p.evaluate((j) => lab.set({ spin: false, time: 0.3, wire: false, pose: "idle", light: "day", ...j }), j);
    await p.waitForTimeout(450);
    await p.locator("#view").screenshot({ path: `shots/g_${j.level}_${j.loadout}_${j.view}_${j.light || "day"}.png` });
  }
};

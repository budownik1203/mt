export default async (p) => {
  const jobs = JSON.parse(process.env.JOBS);
  for (const j of jobs) {
    await p.evaluate((j) => lab.set({ spin: false, wire: false, light: "day", ...j }), j);
    await p.waitForTimeout(350);
    await p.locator("#view").screenshot({ path: `shots/${j.out}.png` });
  }
};

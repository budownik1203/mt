export default async (p) => {
  const lv = (process.env.LEVELS || "ps1a,ps1b,ps2").split(",");
  const views = (process.env.VIEWS || "front,q,side,back,face").split(",");
  for (const level of lv) for (const v of views) {
    const wire = v.endsWith("w"); const view = wire ? v.slice(0, -1) : v;
    await p.evaluate(([level, view, wire, light, pose]) => { lab.set({ level, view, spin: false, wire, light, pose, time: 0.3 }); }, [level, view, wire, process.env.LIGHT || "day", process.env.POSE || "idle"]);
    await p.waitForTimeout(500);
    await p.locator("#view").screenshot({ path: `shots/lab_${level}_${v}.png` });
  }
};

export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => { mb2.start(); mb2.pause(true); mb2.tick(10); });
  const shots = [[13, Math.PI, -0.12, "day"], [13, 0.6, -0.05, "day2"], [17.7, Math.PI * 0.3, -0.08, "dusk"], [22, Math.PI, -0.1, "night"]];
  for (const [h, yaw, pitch, tag] of shots) {
    await p.evaluate(([h, yaw, pitch]) => { mb2.setHour(h); mb2.look(yaw, pitch); mb2.player.hp = 999; mb2.noAI(true); mb2.tick(0.5); }, [h, yaw, pitch]);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `shots/gd_${tag}_${process.env.V}.png` });
  }
  console.log("errors", errs.length, errs.join(" | "));
};

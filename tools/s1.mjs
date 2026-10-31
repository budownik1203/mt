export default async (p) => {
  await p.screenshot({ path: "shots/title.png" });
  await p.evaluate(() => { mb2.start(); mb2.setHour(16); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { mb2.spawn(); const f = mb2.fighters; f[1].x = mb2.player.x + 0; f[1].z = mb2.player.z - 2.2; mb2.look(Math.PI, -0.15); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: "shots/third.png" });
};

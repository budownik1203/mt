export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(17.4); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { for (let i = 0; i < 6; i++) mb2.spawn(); const P = mb2.player; mb2.fighters.filter(f => f.team === 1).forEach((f, i) => { const a = Math.PI + (i - 3) * 0.35; f.x = P.x + Math.sin(a) * (4 + (i % 3)); f.z = P.z + Math.cos(a) * (4 + (i % 3)); }); mb2.look(Math.PI, -0.15); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: "shots/g3_a.png" });
  await p.evaluate(() => { mb2.weapon(6); });
  await p.keyboard.press("KeyV");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "shots/g3_b.png" });
  await p.evaluate(() => { mb2.attack(3); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: "shots/g3_c.png" });
  await p.keyboard.press("KeyV");
  await p.evaluate(() => { mb2.setHour(22); mb2.weapon(4); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "shots/g3_d.png" });
};

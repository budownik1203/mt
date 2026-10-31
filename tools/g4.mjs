export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(14); mb2.weapon(5); mb2.noAI(true); mb2.pause(true); mb2.tick(3); });
  for (const [dir, aim, tag] of [[1, 0.55, "head"], [2, -0.1, "arm"], [1, -0.95, "leg"]]) {
    await p.evaluate(([dir, aim]) => {
      if (!mb2.fighters.some(f => f.team === 1 && f.alive)) mb2.spawn();
      const P = mb2.player; P.hp = 999;
      const en = mb2.fighters.filter(f => f.team === 1 && f.alive); const e = en[0];
      en.slice(1).forEach(f => { f.x = 60; f.z = 60; });
      P.yaw = Math.PI; e.x = P.x - 0.15; e.z = P.z - 1.35; e.yaw = 0; e.hp = 4; e.vx = e.vz = 0;
      mb2.look(Math.PI, aim); mb2.player.cd = 0; mb2.tick(0.5); mb2.attack(dir);
    }, [dir, aim]);
    for (let i = 0; i < 6; i++) { await p.evaluate(() => mb2.tick(0.18)); await p.waitForTimeout(250); await p.screenshot({ path: `shots/g4_${tag}_${i}.png` }); }
    console.log(tag, (await p.evaluate(() => document.getElementById("log").innerText)).split("\n").slice(0, 2).join(" | "), "gibs", await p.evaluate(() => mb2.gibs()));
  }
  await p.evaluate(() => { mb2.weapon(0); mb2.bot(-1, 0); mb2.look(Math.PI, -0.1); });
  for (let i = 0; i < 4; i++) { await p.evaluate((i) => { mb2.tick(0.15); if (i === 1) mb2.attack(1); }, i); await p.waitForTimeout(250); await p.screenshot({ path: `shots/g4_walk_${i}.png` }); }
};

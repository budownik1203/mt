export default async (p) => {
  const W = Number(process.env.W || 5);
  await p.evaluate((W) => { mb2.start(); mb2.setHour(13); mb2.weapon(W); mb2.noAI(true); mb2.pause(true); mb2.tick(1);
    if (!mb2.fighters.some(f => f.team === 1 && f.alive)) mb2.spawn();
    const P = mb2.player; P.hp = 999;
    const en = mb2.fighters.filter(f => f.team === 1 && f.alive); en.slice(1).forEach(f => { f.x = 60; f.z = 60; });
    const e = en[0]; P.yaw = Math.PI; e.x = P.x; e.z = P.z - 1.4; e.yaw = 0; e.hp = 900;
    mb2.look(Math.PI, -0.1); mb2.tick(0.6);
    const mx = P.x, mz = P.z - 0.7, y = P.y;
    mb2.cam([mx + 3.6, y + 1.5, mz + 0.4], [mx, y + 1.1, mz]);
  }, W);
  for (let a = 0; a < 2; a++) {
    await p.evaluate((a) => { mb2.player.cd = 0; mb2.attack(a === 0 ? 1 : 0); }, a);
    for (let i = 0; i < 32; i++) {
      await p.evaluate(() => mb2.tick(1 / 30));
      await p.waitForTimeout(40);
      await p.screenshot({ path: `shots/anim/hit_${String(a * 32 + i).padStart(3, "0")}.png`, clip: { x: 340, y: 120, width: 600, height: 480 } });
    }
  }
};

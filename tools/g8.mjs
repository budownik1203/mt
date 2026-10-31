export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(15); mb2.pause(true); mb2.tick(12); });
  for (let i = 0; i < 12; i++) console.log(await p.evaluate(() => { mb2.player.hp = 999; mb2.tick(0.25); const e = mb2.fighters[1]; return mb2.dbg() + " " + (e ? e.state + " " + e.trackT.toFixed(2) + " hd" + e.hitDone : ""); }));
};

export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(14); mb2.weapon(0); mb2.noAI(true); mb2.pause(true); mb2.tick(2); });
  // 1) aim decides the zone of a level cut
  for (const [pitch, tag] of [[0.55, "up"], [-0.1, "level"], [-0.95, "down"]]) {
    const z = [];
    for (let k = 0; k < 4; k++) {
      await p.evaluate(([pitch]) => {
        if (!mb2.fighters.some(f => f.team === 1 && f.alive)) mb2.spawn();
        const P = mb2.player; P.hp = 999; P.cd = 0;
        const en = mb2.fighters.filter(f => f.team === 1 && f.alive); const e = en[0];
        en.slice(1).forEach(f => { f.x = 60; f.z = 60; });
        P.yaw = Math.PI; e.x = P.x; e.z = P.z - 1.3; e.yaw = 0; e.hp = 500; e.vx = e.vz = 0; e.state = "idle";
        mb2.look(Math.PI, pitch); mb2.tick(0.5); mb2.attack(1);
      }, [pitch]);
      await p.evaluate(() => mb2.tick(1.4));
      if (k === 0) { await p.evaluate(() => {}); }
      z.push((await p.evaluate(() => document.getElementById("log").innerText)).split("\n")[0]); if (k === 3) console.log(JSON.stringify(await p.evaluate(() => globalThis.__hit)), await p.evaluate(() => mb2.player.lean));
    }
    console.log(tag, z.map(s => (s.match(/: ([^,]+),/) || [])[1]).join(","));
  }
  // screenshot the low lean mid-swing
  await p.evaluate(() => { mb2.look(Math.PI, -0.95); mb2.player.cd = 0; mb2.attack(1); mb2.tick(0.45); });
  await p.waitForTimeout(300); await p.screenshot({ path: "shots/g5_low.png" });
  await p.evaluate(() => { mb2.tick(1.5); mb2.look(Math.PI, 0.55); mb2.player.cd = 0; mb2.attack(0); mb2.tick(0.45); });
  await p.waitForTimeout(300); await p.screenshot({ path: "shots/g5_high.png" });
  await p.evaluate(() => mb2.tick(1.5));
  // 2) speeds
  for (const [x, z, run, tag] of [[0, -1, false, "przód"], [1, 0, false, "bok"], [0, 1, false, "tył"], [0, -1, true, "bieg przód"], [1, 0, true, "bieg bok"], [0, 1, true, "bieg tył"]]) {
    const v = await p.evaluate(([x, z, run]) => { mb2.look(Math.PI, -0.1); mb2.bot(x, z, run); const P = mb2.player; mb2.player.__run = run; let s = 0; for (let i = 0; i < 60; i++) { P.wish.run = run; } mb2.runBot = run; mb2.tick(1); return Math.hypot(P.vx, P.vz).toFixed(2); }, [x, z, run]);
    console.log(tag, v);
  }
  await p.evaluate(() => mb2.bot(0, 0));
};

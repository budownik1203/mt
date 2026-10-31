// Gameplay smoke: real loop, bot player attacks nearest enemy; checks waves progress.
export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(18.1); });
  await p.waitForTimeout(3500);
  const t0 = Date.now();
  let shot = 0;
  while (Date.now() - t0 < 40000) {
    const st = await p.evaluate(() => {
      const P = mb2.player, en = mb2.fighters.filter(f => f.team === 1 && f.alive);
      if (!P.alive) return { dead: true };
      let best = null, bd = 1e9;
      for (const e of en) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const yaw = Math.atan2(best.x - P.x, best.z - P.z); mb2.look(yaw, -0.12);
        P.wish.x = bd > 1.6 ? Math.sin(yaw) : 0; P.wish.z = bd > 1.6 ? Math.cos(yaw) : 0;
        if (bd < 2.2 && P.state === "idle") mb2.attack(Math.floor(Math.random() * 4));
        if (best.state === "windup" && P.state === "idle" && Math.random() < 0.5) mb2.block([0,2,1,3][best.dir]);
      }
      return { hp: P.hp, n: en.length, log: document.getElementById("log").innerText.split("\n")[0], clock: document.getElementById("clock").innerText };
    });
    if (st.dead) { console.log("player died"); break; }
    if (shot < 3 && Date.now() - t0 > 6000 + shot * 9000) {
      if (shot === 1) await p.evaluate(() => mb2.setRain(1));
      if (shot === 2) await p.evaluate(() => { mb2.setHour(23); mb2.setRain(0); });
      await p.waitForTimeout(400);
      await p.screenshot({ path: `shots/fight${shot}.png` }); shot++;
      console.log(JSON.stringify(st));
    }
    await p.waitForTimeout(60);
  }
  console.log(await p.evaluate(() => document.getElementById("clock").innerText));
};

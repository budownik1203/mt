export default async (p) => {
  await p.screenshot({ path: "shots/g1_title.png" });
  await p.evaluate(() => { mb2.start(); mb2.setHour(15); });
  await p.waitForTimeout(3600);
  // let wave 1 spawn, then put the enemy in front of the player
  await p.evaluate(() => { const P = mb2.player, e = mb2.fighters[1]; if (e) { e.x = P.x; e.z = P.z - 2.4; } mb2.look(Math.PI, -0.08); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: "shots/g1_a.png" });
  await p.evaluate(() => { mb2.attack(1); mb2.setLmb(true); });
  await p.waitForTimeout(420);
  await p.screenshot({ path: "shots/g1_b.png" });
  await p.evaluate(() => mb2.setLmb(false));
  await p.waitForTimeout(160);
  await p.screenshot({ path: "shots/g1_c.png" });
  await p.waitForTimeout(1500);
  const log = await p.evaluate(() => document.getElementById("log").innerText);
  console.log("LOG:", log.replace(/\n/g, " | "));
  await p.evaluate(() => mb2.setHour(18.2));
  await p.waitForTimeout(400);
  await p.screenshot({ path: "shots/g1_d.png" });
  // bot fight for 25 s
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const st = await p.evaluate(() => {
      const P = mb2.player; if (!P.alive) return "dead";
      const en = mb2.fighters.filter(f => f.team === 1 && f.alive);
      let b = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } }
      if (b) { const yaw = Math.atan2(b.x - P.x, b.z - P.z); mb2.look(yaw, -0.1); P.wish.x = bd > 1.8 ? Math.sin(yaw) : 0; P.wish.z = bd > 1.8 ? Math.cos(yaw) : 0;
        if (bd < 2.3 && P.state === "idle") mb2.attack(Math.floor(Math.random() * 4)); }
      return document.getElementById("clock").innerText;
    });
    if (st === "dead") { console.log("player died"); break; }
    await p.waitForTimeout(80);
  }
  console.log(await p.evaluate(() => document.getElementById("clock").innerText));
  await p.screenshot({ path: "shots/g1_e.png" });
};

export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(14); });
  const t0 = Date.now(); let shots = 0;
  while (Date.now() - t0 < 70000) {
    const st = await p.evaluate(() => {
      const P = mb2.player; if (!P.alive) return { dead: true };
      const en = mb2.fighters.filter(f => f.team === 1 && f.alive);
      let b = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } }
      if (b) {
        const yaw = Math.atan2(b.x - P.x, b.z - P.z); mb2.look(yaw, -0.12);
        const r = P.weapon.reach + 0.4;
        mb2.bot(bd > r ? Math.sin(yaw) : 0, bd > r ? Math.cos(yaw) : 0);
        if (b.state === "windup" || b.state === "hold") { if (P.state === "idle" || P.state === "block") mb2.block([0,2,1,3][b.dir]); }
        else { if (P.state === "block") mb2.unblock(); if (bd < r + 0.3 && P.state === "idle") mb2.attack(Math.floor(Math.random() * 4)); }
      } else mb2.bot(0, 0);
      return { hp: P.hp, n: en.length, bd, ps: P.state, es: b && b.state };
    });
    if (st.dead) { console.log("player died"); break; }
    if (st.bd < 2.5 && shots < 4 && Date.now() - t0 > 8000 + shots * 7000) { await p.screenshot({ path: `shots/g2_${shots}.png` }); shots++; console.log(JSON.stringify(st)); }
    await p.waitForTimeout(50);
  }
  console.log(await p.evaluate(() => document.getElementById("clock").innerText));
  console.log("LOG:", (await p.evaluate(() => document.getElementById("log").innerText)).replace(/\n/g, " | "));
};

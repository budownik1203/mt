export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(14); mb2.weapon(0); mb2.noAI(true); mb2.pause(true); mb2.tick(2); });
  for (const pitch of [-0.1, -0.1, -0.1]) {
    await p.evaluate(([pitch]) => {
      if (!mb2.fighters.some(f => f.team === 1 && f.alive)) mb2.spawn();
      const P = mb2.player; P.hp = 999; P.cd = 0;
      const en = mb2.fighters.filter(f => f.team === 1 && f.alive); const e = en[0];
      en.slice(1).forEach(f => { f.x = 60; f.z = 60; });
      P.yaw = Math.PI; e.x = P.x; e.z = P.z - 1.3; e.yaw = 0; e.hp = 500; e.vx = e.vz = 0; e.state = "idle";
      mb2.look(Math.PI, pitch); mb2.tick(0.5); mb2.attack(1);
    }, [pitch]);
    await p.evaluate(() => mb2.tick(1.4));
    console.log((await p.evaluate(() => document.getElementById("log").innerText)).split("\n")[0]);
  }
  // parry: enemy blocks the right swing (block dir = mirror)
  const r = await p.evaluate(() => {
    const P = mb2.player; const e = mb2.fighters.find(f => f.team === 1 && f.alive);
    P.cd = 0; mb2.attack(1); e.block(2);
    const out = [];
    for (let i = 0; i < 120; i++) { mb2.tick(1 / 60); if (i % 10 === 0) out.push(`${(i / 60).toFixed(2)} ${P.state} cd=${P.cd.toFixed(2)} e.rip=${e.riposte.toFixed(2)} e=${e.state}`); }
    return out.join("\n");
  });
  console.log(r);
};

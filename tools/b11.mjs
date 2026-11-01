// Build 11: ranged — player bow/crossbow/arquebus, enemy and allied shooters, volleys, smoke, shields catch missiles.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `shots/b11_${n}.png` }); };
  // 1) practice field: the player shoots each weapon at a dummy
  await p.evaluate(() => mb2.start());
  await p.waitForTimeout(500);
  await p.evaluate(() => { mb2.spawn(); mb2.tick(0.2); });
  const fire = async (slot) => p.evaluate(async (slot) => {
    mb2.pause(true); mb2.noAI(true); mb2.weapon(slot);
    const pl = mb2.player; const foe = mb2.fighters.find((f) => f.team === 1 && f.alive);
    if (!foe) return "no foe";
    foe.x = pl.x; foe.z = pl.z + 14; foe.yaw = 0; foe.hp = foe.maxHp; const hp0 = foe.hp;
    mb2.aimAt(foe);
    pl.startAim(); mb2.tick(1.2); const st = pl.rs; pl.loose(); mb2.tick(1.0);
    return `${pl.weaponId}: rs ${st} → ammo ${pl.ammo}, foe hp ${hp0}→${Math.round(foe.hp)}, missiles ${mb2.projCount()}`;
  }, slot);
  for (const s of [8, 9, 10]) console.log(await fire(s));
  await p.evaluate(() => { mb2.weapon(10); mb2.player.startAim(); mb2.tick(0.8); mb2.player.loose(); mb2.tick(0.15); const pl = mb2.player; mb2.cam([pl.x + 2.2, 2.0, pl.z - 0.6], [pl.x, 1.4, pl.z + 2.5]); mb2.tick(0.02); });
  await shot("arquebus_smoke");
  await p.evaluate(() => { mb2.weapon(8); mb2.player.startAim(); mb2.tick(1.2); const pl = mb2.player; mb2.cam([pl.x + 1.6, 1.8, pl.z + 1.2], [pl.x, 1.45, pl.z]); mb2.tick(0.02); });
  await shot("bow_aim");
  await p.evaluate(() => { mb2.player.loose(); mb2.weapon(9); mb2.player.startAim(); mb2.tick(0.6); const pl = mb2.player; mb2.cam([pl.x + 1.6, 1.8, pl.z + 1.2], [pl.x, 1.45, pl.z]); mb2.tick(0.02); });
  await shot("crossbow_aim");
  // 2) campaign battle: my crossbowmen + arquebusiers in volleys vs bandits with bowmen
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][0].click(); });
  await p.evaluate(() => { const c = mb2.camp, me = c.co.party; c.hour = 13; me.troops = [{ t: "zbrojny", n: 8, wounded: 0, xp: 0 }, { t: "kusznik", n: 6, wounded: 0, xp: 0 }, { t: "arkebuzer", n: 4, wounded: 0, xp: 0 }];
    const b = c.parties.find((q) => q.kind === "bandits"); b.troops = [{ t: "rozbojnik", n: 10, wounded: 0, xp: 0 }, { t: "chlop_luk", n: 5, wounded: 0, xp: 0 }]; mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.noAI(false); });
  await p.evaluate(() => { const e = mb2.enc; e.sel = new Set([6]); window.dispatchEvent(new KeyboardEvent("keydown", { code: "F4" })); window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3" })); return e.groups[5].fire; });
  console.log("group 6 fire", await p.evaluate(() => mb2.enc.groups[5].fire));
  const sim = await p.evaluate(() => { mb2.pause(true); let shots = 0, maxProj = 0; for (let i = 0; i < 30; i++) { mb2.tick(0.5); maxProj = Math.max(maxProj, mb2.projCount()); }
    const mine = mb2.fighters.filter((f) => f.team === 0 && f.primary); const foes = mb2.fighters.filter((f) => f.team === 1);
    return `my shooters ammo ${mine.map((f) => f.ammo).join(",")} · enemy dead ${foes.filter((f) => !f.alive).length}/${foes.length} · peak missiles ${maxProj} · switched to sidearm ${mine.filter((f) => !f.ranged).length}`; });
  console.log("sim", sim);
  await p.evaluate(() => { const pl = mb2.player; const s = mb2.fighters.find((f) => f.team === 0 && f.primary && f.alive) ?? pl; mb2.cam([s.x + 3, 2.4, s.z + 4], [s.x, 1.2, s.z - 6]); mb2.tick(0.02); });
  await shot("battle");
  console.log("hud", await p.evaluate(() => document.getElementById("orders").innerText.replace(/\n/g, " | ")));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

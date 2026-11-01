// Build 13: horses and cavalry — practice mount, gallop, couched lance, horse hit/death, AI riders, horse market, mounted map speed.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `shots/b13_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  await p.evaluate(() => mb2.start()); await p.waitForTimeout(400);
  await p.evaluate(() => { mb2.spawn(); mb2.pause(true); mb2.noAI(true); mb2.mountPlayer("kon"); mb2.weapon(11); mb2.tick(0.2); });
  // gallop forward
  console.log("gallop", await p.evaluate(() => { const pl = mb2.player; mb2.bot(0, 1, true); mb2.tick(3); return `speed ${pl.mount.speed.toFixed(1)} m/s, z ${pl.z.toFixed(1)}, couched ${pl.couched}`; }));
  await p.evaluate(() => { const pl = mb2.player; mb2.cam([pl.x + 3.5, 2.6, pl.z + 2.5], [pl.x, 1.5, pl.z]); mb2.tick(0.02); });
  await shot("gallop_lance");
  // couched lance into a dummy
  console.log("lance", await p.evaluate(() => { const pl = mb2.player; const foe = mb2.fighters.find((f) => f.team === 1 && f.alive); foe.x = pl.x; foe.z = pl.z + 9; foe.hp = foe.maxHp; const h0 = foe.hp; mb2.tick(1.2); return `foe hp ${h0}→${Math.round(foe.hp)} alive ${foe.alive}`; }));
  // the horse is killed under the player
  console.log("horse down", await p.evaluate(() => { const pl = mb2.player; mb2.bot(0, 0); pl.mount.hp = 5; const foe = mb2.fighters.find((f) => f.team === 1 && f.alive) ?? mb2.fighters.find((f) => f.team === 1); mb2.hitHorse(foe, pl); mb2.tick(1); return `mounted ${pl.mounted} hp ${Math.round(pl.hp)}`; }));
  await p.evaluate(() => { const pl = mb2.player; mb2.cam([pl.x + 3, 2.2, pl.z - 3], [pl.x, 0.8, pl.z]); mb2.tick(0.02); });
  await shot("horse_down");
  // campaign: buy a horse, cavalry battle
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  await p.evaluate(() => { const c = mb2.camp; c.co.party.gold = 3000; c.co.hero.skills.jazda = 2; mb2.ui.settlement("grauburg"); });
  console.log("market", await click("Targ koński"));
  await shot("market");
  console.log("buy", await click("Rumak"), await p.evaluate(() => mb2.camp.co.hero.horse));
  await p.evaluate(() => { const c = mb2.camp, me = c.co.party; me.troops = [{ t: "jezdziec", n: 6, wounded: 0, xp: 0 }, { t: "rycerz_konny", n: 4, wounded: 0, xp: 0 }]; mb2.ui.close(); });
  console.log("map speed", await p.evaluate(() => { const c = mb2.camp; return c.mountedCompany + " " + c.speedOf(c.co.party).toFixed(2); }));
  await p.evaluate(() => { const c = mb2.camp; c.hour = 12; const b = c.parties.find((q) => q.kind === "bandits"); b.troops = [{ t: "rozbojnik", n: 14, wounded: 0, xp: 0 }, { t: "chlop_luk", n: 3, wounded: 0, xp: 0 }]; mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.noAI(false); mb2.bot(0, 0); });
  console.log("riders", await p.evaluate(() => mb2.fighters.filter((f) => f.team === 0).map((f) => (f.mount ? f.mount.id : "pieszo")).join(",")));
  const sim = await p.evaluate(() => { mb2.pause(true); let maxSp = 0; for (let i = 0; i < 24; i++) { mb2.tick(0.5); for (const f of mb2.fighters) if (f.mount && !f.mount.dead) maxSp = Math.max(maxSp, f.mount.speed); }
    const foes = mb2.fighters.filter((f) => f.team === 1); const mine = mb2.fighters.filter((f) => f.team === 0 && f !== mb2.player);
    return `max horse speed ${maxSp.toFixed(1)} · enemy down ${foes.filter((f) => !f.alive).length}/${foes.length} · my riders alive ${mine.filter((f) => f.alive).length}/${mine.length} · horses dead ${mine.filter((f) => f.mount && f.mount.dead).length}`; });
  console.log("sim", sim);
  await p.evaluate(() => { const r = mb2.fighters.find((f) => f.team === 0 && f !== mb2.player && f.mounted) ?? mb2.player; mb2.cam([r.x + 5, 3, r.z + 5], [r.x, 1.4, r.z]); mb2.tick(0.02); });
  await shot("cavalry");
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

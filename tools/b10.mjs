// Build 10: monsters and contracts — lairs, contract offer, investigation, weakened beast, reward.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `shots/b10_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][0].click(); });
  console.log("monsters", await p.evaluate(() => { const c = mb2.camp; return c.parties.filter((q) => q.kind === "monster").map((q) => q.name + ":" + q.troops.map((t) => t.t + "×" + t.n).join("+") + " path? " + !!c.route(q, q.x + 5, q.z + 5)).join(" | "); }));
  // a few nights of hunting
  console.log("nights", await p.evaluate(() => { const c = mb2.camp; c.co.inside = true; c.passHours(24 * 6); c.co.inside = false; return c.notes.filter((n) => /napada/.test(n.text)).length + " attacks; offers " + c.offers.join(","); }));
  // village near the wolf lair: take the contract
  const vid = await p.evaluate(() => { const c = mb2.camp, L = c.w.pois.find((q) => q.id === "lair_wolf"); if (!c.parties.some((q) => q.monster === "wilkolak")) mb2.spawnMonster("wilkolak"); const s = c.w.settlements.filter((x) => !x.burned && x.kind !== "castle").sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z))[0]; c.fx.rel[c.fx.owner[s.id]] = 0; mb2.ui.settlement(s.id); return s.id; });
  console.log("village", vid);
  await shot("village");
  console.log("offer", await click("Kontrakt"));
  await shot("offer");
  console.log("take", await click("Przyjmij"));
  for (let i = 0; i < 3; i++) { console.log("investigate", await click("Śledztwo")); await shot("clue" + i); await click("Wróć"); }
  console.log("contracts", await p.evaluate(() => JSON.stringify(mb2.camp.contracts)));
  // fight the werewolf
  await p.evaluate(() => { const c = mb2.camp; c.co.party.troops = [{ t: "zbrojny", n: 12, wounded: 0, xp: 0 }, { t: "halabardnik", n: 6, wounded: 0, xp: 0 }]; mb2.ui.close(); const w = c.parties.find((q) => q.monster === "wilkolak"); mb2.ui.encounter(w); });
  await shot("encounter");
  await p.evaluate(() => [...document.querySelectorAll("#macts button")][0].click());
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.pause(true); mb2.tick(0.3); });
  console.log("wolf hp", await p.evaluate(() => mb2.fighters.filter((f) => f.team === 1).map((f) => f.kit.name.pl + " " + f.maxHp + " noMorale " + f.noMorale).join(", ") + " weak " + mb2.enc.weak));
  await p.evaluate(() => { const w = mb2.fighters.find((f) => f.team === 1); const pl = mb2.player; w.x = pl.x; w.z = pl.z - 3.2; w.yaw = 0; mb2.noAI(true); mb2.tick(0.1); mb2.cam([pl.x + 1.6, 1.9, pl.z - 0.5], [w.x, 1.1, w.z]); mb2.tick(0.1); });
  await shot("werewolf");
  await p.evaluate(() => { for (const f of mb2.fighters) if (f.team === 1) { f.hp = 0; f.die(); } mb2.enc.enemyQ.length = 0; mb2.noAI(false); mb2.tick(0.5); });
  await p.waitForTimeout(3000);
  console.log("after", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 360)));
  await shot("after");
  // other beasts: models
  await p.evaluate(() => { const c = mb2.camp; mb2.ui.close(); for (const id of ["utopce", "strzyga"]) if (!c.parties.some((q) => q.monster === id)) mb2.spawnMonster(id); const u = c.parties.find((q) => q.monster === "strzyga"); mb2.ui.encounter(u); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.pause(true); mb2.noAI(true); mb2.tick(0.3); const pl = mb2.player; let i = 0; for (const f of mb2.fighters) if (f.team === 1) { f.x = pl.x - 2 + i * 1.6; f.z = pl.z - 3.5; f.yaw = 0; i++; } mb2.tick(0.1); mb2.cam([pl.x, 1.8, pl.z - 0.3], [pl.x, 1.1, pl.z - 3.5]); mb2.tick(0.1); });
  await shot("strzyga");
  const coll = await p.evaluate(() => { const s = mb2.fighters.find((f) => f.team === 1 && mb2.enc.troopOf.get(f.id) === "strzyga"); s.hp = 0; s.die(); mb2.collapse(1); return mb2.fighters.filter((f) => f.team === 1 && f.alive).length; });
  console.log("strzyga down, alive left", coll);
  await p.evaluate(() => { mb2.enc.enemyQ.length = 0; mb2.noAI(false); mb2.tick(0.5); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { mb2.ui.close(); const c = mb2.camp; const u = c.parties.find((q) => q.monster === "utopce"); mb2.ui.encounter(u); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.pause(true); mb2.noAI(true); mb2.tick(0.3); const pl = mb2.player; let i = 0; for (const f of mb2.fighters) if (f.team === 1) { f.x = pl.x - 3 + i * 1.4; f.z = pl.z - 3.5; f.yaw = 0; i++; } mb2.tick(0.1); mb2.cam([pl.x, 1.8, pl.z - 0.3], [pl.x, 1.1, pl.z - 3.5]); mb2.tick(0.1); });
  await shot("utopce");
  await p.evaluate(() => { mb2.ui.chronicle && 0; });
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

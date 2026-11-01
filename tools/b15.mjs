// Build 15: joining lord battles, defending your walls, starving a castle out.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `shots/b15_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  const finish = async () => { await p.evaluate(() => { for (const f of mb2.fighters) if (f.team === 1) { f.hp = 0; f.die(); } mb2.enc.enemyQ.length = 0; mb2.tick(0.5); }); await p.waitForTimeout(3000); };
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  await p.evaluate(() => { const c = mb2.camp; c.hour = 12; c.co.party.gold = 3000; c.co.hero.renown = 200; c.co.party.troops = [{ t: "zbrojny", n: 10, wounded: 0, xp: 0 }, { t: "kusznik", n: 5, wounded: 0, xp: 0 }];
    if (!c.fx.wars.includes("cesarstwo|wronsk")) c.fx.wars.push("cesarstwo|wronsk"); });
  // 1) two lords fight next to us: join the Wrońsk side
  console.log("join", await p.evaluate(() => { const c = mb2.camp, me = c.co.party; const a = mb2.spawnLord("bratumil"), b = mb2.spawnLord("brenner");
    a.x = me.x + 1; a.z = me.z; b.x = me.x + 1.5; b.z = me.z; a.fight = { with: b.id, until: c.now + 3 }; b.fight = { with: a.id, until: c.now + 3 }; mb2.ui.encounter(a); return document.getElementById("mtitle").textContent; }));
  await shot("join_menu");
  console.log("help", await click("Pomóż: Wojewoda"));
  await p.waitForTimeout(800);
  console.log("allies", await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.pause(true); mb2.tick(0.3); return mb2.fighters.filter((f) => f.team === 0 && f.group === 8).length + " allied fighters, enemy " + mb2.fighters.filter((f) => f.team === 1).length; }));
  await p.evaluate(() => { mb2.cam([6, 6, 22], [0, 1, 4]); mb2.tick(0.02); }); await shot("join_battle");
  await finish();
  console.log("after join", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 260)), await p.evaluate(() => "rel " + mb2.camp.fx.lords.bratumil.rel + " fight " + JSON.stringify(mb2.camp.parties.find((q) => q.lord === "bratumil")?.fight)));
  await p.evaluate(() => mb2.ui.close());
  // 2) our town is besieged: defend the walls
  await p.evaluate(() => { const c = mb2.camp, s = c.w.settlements.find((q) => q.id === "grauburg"); c.fx.join = { f: "wronsk", role: "vassal", until: 0 }; c.fx.owner.grauburg = "wronsk"; c.fx.fief.grauburg = "player"; c.fx.garrison.grauburg = 14;
    const L = c.parties.find((q) => q.lord === "ulrich") ?? mb2.spawnLord("ulrich"); L.fight = undefined; L.x = s.x + 3; L.z = s.z + 3; L.path = []; L.mode = "wait"; L.dest = "grauburg"; L.think = 70; L.raid = undefined; mb2.ui.settlement("grauburg"); });
  await shot("besieged");
  console.log("defend", await click("Bronić murów"));
  await p.waitForTimeout(800);
  console.log("posts", await p.evaluate(() => { mb2.pause(true); mb2.noAI(false); mb2.tick(0.3); const mine = mb2.fighters.filter((f) => f.team === 0 && f !== mb2.player), foe = mb2.fighters.filter((f) => f.team === 1);
    return `mine ${mine.length}, on wall ${mine.filter((f) => f.y - mb2.height(f.x, f.z) > 2.5).length}, garrison ${mine.filter((f) => f.group === 8).length} · attackers ${foe.length}, outside ${foe.filter((f) => f.z > -8).length} · deploy ${mb2.enc.deploy}`; }));
  console.log("t+15s", await p.evaluate(() => { for (let i = 0; i < 30; i++) mb2.tick(0.5); const foe = mb2.fighters.filter((f) => f.team === 1); return `attackers alive ${foe.filter((f) => f.alive).length}, on wall ${foe.filter((f) => f.alive && f.y - mb2.height(f.x, f.z) > 2).length}`; }));
  await p.evaluate(() => { mb2.cam([18, 7, 0], [10, 2.5, -10]); mb2.tick(0.02); }); await shot("defend");
  await finish();
  console.log("after defend", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 200)), await p.evaluate(() => mb2.camp.fx.owner.grauburg + " garrison " + mb2.camp.fx.garrison.grauburg));
  await p.evaluate(() => mb2.ui.close());
  // 3) starve the Arcybiskupstwo town out
  await p.evaluate(() => { const c = mb2.camp; if (!c.fx.wars.includes("arcybiskupstwo|wronsk")) c.fx.wars.push("arcybiskupstwo|wronsk"); c.fx.warDay["arcybiskupstwo|wronsk"] = c.day; const s = c.w.settlements.find((q) => q.id === "morwen"); c.co.party.x = s.x + 3; c.co.party.z = s.z + 3; c.fx.garrison.morwen = 14; c.co.food.push({ type: "grain", n: 400, age: 0 }); mb2.ui.settlement("morwen"); });
  console.log("starve", await click("Oblegaj"));
  console.log("days", await p.evaluate(() => { const c = mb2.camp; c.parties = c.parties.filter((q) => q.kind === "player"); c.passHours(24 * 12); return `owner ${c.fx.owner.morwen} fief ${c.fx.fief.morwen} garrison ${c.fx.garrison.morwen} · ` + c.notes.filter((n) => /Oblężenie|poddaje/.test(n.text)).slice(0, 3).map((n) => n.text).join(" / "); }));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

// Build 8: necromancy — book in the burned chapel, graveyard, camp rites,
// undead models in battle, raising the fallen (N), necromancer collapse, hunters.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `shots/b8_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][2].click(); });   // kleryk
  // walk to the burned chapel, open the camp menu, take the book
  await p.evaluate(() => { const c = mb2.camp, q = c.w.pois.find((x) => x.id === "ruin2"); c.co.party.x = q.x + 2; c.co.party.z = q.z + 1; c.parties = c.parties.filter((x) => x.kind === "player"); mb2.ui.campMenu(); });
  await shot("chapel");
  console.log("book", await click("Przeszukaj"), await p.evaluate(() => mb2.camp.co.hero.necro + " skill " + mb2.camp.co.hero.skills.nekromancja + " cor " + mb2.camp.co.hero.corruption));
  await shot("book");
  // graveyard: dig for bones
  await p.evaluate(() => { const c = mb2.camp, q = c.w.pois.find((x) => x.id === "grave1"); c.co.party.x = q.x + 2; c.co.party.z = q.z + 1; c.parties = c.parties.filter((x) => x.kind === "player"); c.rand = () => 0.9; mb2.ui.campMenu(); });
  console.log("dig", await click("Rozkop"), await p.evaluate(() => "bones " + mb2.camp.co.bones));
  // rites: pitch camp, raise skeletons, then ghouls from corpses, then empower
  await p.evaluate(() => { const c = mb2.camp; c.co.bones = 40; c.co.corpses = 10; c.co.hero.skills.nekromancja = 3; c.parties = c.parties.filter((x) => x.kind === "player"); mb2.ui.campMenu(); });
  console.log("camp", await click("Rozbij"));
  console.log("bones rite", await click("Podnieś"));
  await shot("rite");
  console.log("flesh rite", await click("Ożyw"));
  console.log("empower", await click("Wzmocnij"));
  console.log("troops", await p.evaluate(() => mb2.camp.co.party.troops.map((s) => s.t + ":" + s.n).join(", ") + " · cor " + Math.round(mb2.camp.co.hero.corruption) + " · morale " + Math.round(mb2.camp.co.morale)));
  await shot("camp");
  // battle against a necromancer: undead models on both sides; raise the fallen; kill the necromancer
  await p.evaluate(() => { const c = mb2.camp; c.rand = Math.random; mb2.ui.close(); c.co.camp = false;
    const n = c.parties.find((q) => q.kind === "necro") ?? (() => { const me = c.co.party; const q = c.newParty("necro", "Nekromanta", me.x + 1, me.z, [{ t: "nekromanta", n: 1, wounded: 0, xp: 0 }, { t: "szkielet", n: 6, wounded: 0, xp: 0 }, { t: "ghul", n: 3, wounded: 0, xp: 0 }]); return q; })();
    mb2.ui.encounter(n); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
  await p.evaluate(() => { mb2.pause(true); mb2.tick(1); mb2.cam([0, 3.2, 1], [0, 1, -14]); mb2.tick(0.1); }); await shot("battle_undead");
  // kill two of ours near the player, then raise them
  const raised = await p.evaluate(() => {
    const pl = mb2.player; let k = 0;
    for (const f of mb2.fighters) if (f.team === 0 && f !== pl && !f.noMorale && k < 2) { f.x = pl.x + 1 + k; f.z = pl.z; f.hp = 0; f.die(); k++; }
    mb2.tick(0.3);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyN" }));
    return mb2.enc.risen.size + " risen, cd " + Math.round(mb2.enc.raiseCD);
  });
  console.log("raise", raised);
  await p.evaluate(() => { mb2.tick(1.5); mb2.cam([mb2.player.x + 3, 2.2, mb2.player.z + 3], [mb2.player.x, 1, mb2.player.z]); mb2.tick(0.1); }); await shot("raised");
  const coll = await p.evaluate(() => {
    const nec = mb2.fighters.find((f) => f.team === 1 && mb2.enc.troopOf.get(f.id) === "nekromanta");
    if (!nec) return "no necromancer on field";
    const before = mb2.fighters.filter((f) => f.team === 1 && f.alive).length;
    // a lethal blow through the game's own hit path is hard to aim headless: emulate its effect
    nec.hp = 0; nec.die(); mb2.collapse(1);
    return before + " → " + mb2.fighters.filter((f) => f.team === 1 && f.alive).length;
  });
  console.log("collapse", coll);
  await p.evaluate(() => { for (const f of mb2.fighters) if (f.team === 1 && f.alive) { f.hp = 0; f.die(); } mb2.enc.enemyQ.length = 0; mb2.tick(0.5); });
  await p.waitForTimeout(3000);
  console.log("after", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 400)));
  console.log("harvest", await click("Zbierzcie"), await p.evaluate(() => "corpses " + mb2.camp.co.corpses + " bones " + mb2.camp.co.bones + " troops " + mb2.camp.co.party.troops.map((s) => s.t + ":" + s.n).join(",")));
  // corruption 80: hunters, closed gates, confession refused with undead
  await p.evaluate(() => { const c = mb2.camp; c.co.hero.corruption = 80; mb2.ui.close(); mb2.spawnHunters(); mb2.ui.settlement("grauburg"); });
  await shot("gate");
  console.log("gate", await p.evaluate(() => document.getElementById("mbody").innerText.slice(-120).replace(/\n/g, " ")));
  console.log("hunters", await p.evaluate(() => { const c = mb2.camp, h = c.parties.find((q) => q.kind === "hunters"); return h ? h.name + " hostile " + c.hostile(h) : "none"; }));
  await p.evaluate(() => { const c = mb2.camp; c.co.hero.corruption = 40; c.co.party.gold = 500; mb2.ui.close(); mb2.ui.settlement("morwen"); });
  console.log("confess w/ undead", await click("Spowiedź"));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.campMenu(); });
  console.log("release", await click("Uwolnij"));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.settlement("morwen"); });
  console.log("confess", await click("Spowiedź"), await p.evaluate(() => "cor " + mb2.camp.co.hero.corruption));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.characterPanel(); }); await shot("char");
  // save / load keeps it
  console.log("save", await p.evaluate(() => { const s = mb2.camp.save(); const d = JSON.parse(s); return d.co.hero.necro + " bones " + d.co.bones; }));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

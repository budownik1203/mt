// Build 9: factions and lords — world simulation, factions panel, lord encounter
// (mercenary contract, homage), raiding a village, storming a castle, ransom of a lord.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `shots/b9_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });   // szlachcic
  console.log("lords", await p.evaluate(() => mb2.camp.parties.filter((q) => q.kind === "lord").map((q) => q.name + ":" + mb2.camp.partySize(q)).join(", ")));
  await p.evaluate(() => { mb2.camp.speed = 0; mb2.ui.factionsPanel(); }); await shot("factions");
  // simulate 40 days of the world
  const sim = await p.evaluate(() => { const c = mb2.camp; c.co.inside = true; c.passHours(24 * 120); c.co.inside = false;
    const own = {}; for (const s of c.w.settlements) own[s.id] = c.fx.owner[s.id];
    return JSON.stringify({ wars: c.fx.wars, lords: c.parties.filter((q) => q.kind === "lord").length, burned: c.w.settlements.filter((s) => s.burned).map((s) => s.name), own }); });
  console.log("sim", sim);
  console.log("notes", await p.evaluate(() => mb2.camp.notes.slice(0, 12).map((n) => n.text).join(" / ")));
  await p.evaluate(() => { mb2.camp.co.party.troops = [{ t: "zbrojny", n: 20, wounded: 0, xp: 0 }, { t: "halabardnik", n: 10, wounded: 0, xp: 0 }, { t: "rycerz", n: 6, wounded: 0, xp: 0 }]; mb2.camp.co.party.gold = 1000; });
  // meet the Wrońsk ruler: hire as mercenary
  await p.evaluate(() => { const c = mb2.camp; let q = c.parties.find((x) => x.lord === "wsiewolod"); if (!q) q = null; mb2.ui.close(); if (q) mb2.ui.encounter(q); });
  await shot("lord");
  console.log("lord menu", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 300)));
  console.log("hire", await click("Zaciągnij"), await p.evaluate(() => JSON.stringify(mb2.camp.fx.join)));
  console.log("homage (renown low)", await click("Złóż hołd"));
  await p.evaluate(() => { mb2.camp.co.hero.renown = 150; const q = mb2.camp.parties.find((x) => x.lord === "wsiewolod"); if (q) mb2.ui.encounter(q); });
  console.log("homage", await click("Złóż hołd"), await p.evaluate(() => JSON.stringify(mb2.camp.fx.join) + " fiefs " + Object.entries(mb2.camp.fx.fief).filter(([, v]) => v === "player").map(([k]) => k)));
  // war with the Empire: raid an imperial village, storm Lindenau/Grauburg? take a castle-like target: Grauburg town
  await p.evaluate(() => { const c = mb2.camp; if (!c.fx.wars.includes("cesarstwo|wronsk")) c.fx.wars.push("cesarstwo|wronsk"); mb2.ui.close(); const v = c.w.settlements.find((s) => s.kind === "village" && c.fx.owner[s.id] === "cesarstwo" && !s.burned); window.__v = v && v.id; if (v) mb2.ui.settlement(v.id); });
  await shot("enemy_village");
  console.log("raid", await click("Splądruj"), await p.evaluate(() => "burned " + (window.__v && mb2.camp.w.settlements.find((s) => s.id === window.__v).burned) + " gold " + mb2.camp.co.party.gold));
  await p.evaluate(() => { const c = mb2.camp; const t = c.w.settlements.find((s) => s.kind !== "village" && c.fx.owner[s.id] === "cesarstwo"); window.__t = t.id; c.fx.garrison[t.id] = 12; mb2.ui.close(); mb2.ui.settlement(t.id); });
  await shot("enemy_town");
  console.log("assault", await click("Szturmuj"));
  await p.waitForTimeout(800);
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
  await p.evaluate(() => { mb2.pause(true); mb2.tick(2); }); await shot("siege_battle");
  await p.evaluate(() => { for (const f of mb2.fighters) if (f.team === 1) { f.hp = 0; f.die(); } mb2.enc.enemyQ.length = 0; mb2.tick(0.5); });
  await p.waitForTimeout(3000);
  console.log("after siege", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 300)), await p.evaluate(() => window.__t + " " + mb2.camp.fx.owner[window.__t] + " / " + mb2.camp.fx.fief[window.__t]));
  await p.evaluate(() => mb2.ui.close());
  // beat an imperial lord and take him prisoner, then ransom
  await p.evaluate(() => { const c = mb2.camp; let q = c.parties.find((x) => x.kind === "lord" && x.faction === "cesarstwo"); if (!q) return; q.troops = [{ t: "zbrojny", n: 6, wounded: 0, xp: 0 }]; mb2.ui.encounter(q); });
  console.log("fight lord", await click("Rozstrzygnij"));
  await shot("lord_captured");
  console.log("capture", await click("Weź do niewoli"), await p.evaluate(() => JSON.stringify(mb2.camp.fx.captives)));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.settlement("wronsk"); });
  console.log("broker", await click("Pośrednik"), await click("Hauptmann") === "ok" || await click("Margrabia") === "ok" || await click("Rycerz"));
  console.log("captives", await p.evaluate(() => JSON.stringify(mb2.camp.fx.captives) + " gold " + mb2.camp.co.party.gold));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.factionsPanel(); }); await shot("factions2");
  // map view with faction colours
  await p.evaluate(() => { mb2.ui.close(); mb2.mapTick(0.2); }); await shot("map");
  console.log("save", await p.evaluate(() => { const s = mb2.camp.save(); const ok = mb2.camp.load(s); return ok + " " + Object.keys(JSON.parse(s).fx.lords).length; }));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

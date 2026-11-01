// Build 16: trade goods, quests (letter, band, delivery), tournament.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `shots/b16_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  const btn = (sel) => p.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return "missing " + sel; b.click(); return "ok"; }, sel);
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  await p.evaluate(() => { const c = mb2.camp; c.co.party.gold = 3000; mb2.ui.settlement("wronsk"); });
  console.log("market", await click("Kupcy"));
  for (let i = 0; i < 3; i++) await btn('#mbody [data-buy5="futra"]');
  await shot("market");
  console.log("bought", await p.evaluate(() => JSON.stringify(mb2.camp.co.trade.cargo) + " gold " + mb2.camp.co.party.gold));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.settlement("grauburg"); }); await click("Kupcy");
  console.log("best known futra", await p.evaluate(() => document.querySelector("#mbody tbody").innerText.split("\n").find((l) => l.startsWith("Futra"))));
  await btn('#mbody [data-sellall="futra"]');
  console.log("sold", await p.evaluate(() => document.querySelector("#mbody p.meta b")?.innerText + " gold " + mb2.camp.co.party.gold));
  // village quest: delivery or band
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.settlement("gnilowo"); });
  console.log("elder", await click("Sołtys"), await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ")));
  console.log("accept", await click("Przyjmij"));
  const q = await p.evaluate(() => JSON.stringify(mb2.camp.co.quests[0]));
  console.log("quest", q);
  console.log("complete", await p.evaluate(async () => { const c = mb2.camp, k = c.co.quests[0];
    if (k.kind === "dostawa") { c.co.trade.cargo[k.good] = { n: k.n, cost: 10 }; mb2.ui.settlement("gnilowo"); [...document.querySelectorAll("#macts button")].find((b) => b.textContent.startsWith("Oddaj towar")).click(); }
    else { const b = c.parties.find((x) => x.id === k.party); mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith("Rozstrzygnij")).click(); }
    return "quests left " + c.co.quests.length + " · " + c.notes[0].text; }));
  // lord quest: letter
  await p.evaluate(() => { mb2.ui.close(); const L = mb2.spawnLord("wsiewolod"); mb2.camp.fx.rel.wronsk = 10; mb2.ui.encounter(L); });
  console.log("lord", await click("Masz dla mnie"), await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ")));
  console.log("accept", await click("Przyjmij"), await p.evaluate(() => JSON.stringify(mb2.camp.co.quests.map((q) => q.kind + "→" + (q.target ?? q.party)))));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.chronicle(); }); await shot("chronicle");
  // tournament in Grauburg
  await p.evaluate(() => { const c = mb2.camp; c.co.trade.tourney = { town: "grauburg", until: c.day + 5 }; mb2.ui.close(); mb2.ui.settlement("grauburg"); });
  console.log("tourney", await click("Turniej"), await click("Zgłoś się i postaw na siebie 50"));
  for (let r = 0; r < 3; r++) {
    await p.waitForTimeout(400);
    console.log("bout", r, await p.evaluate(async () => { mb2.pause(true); mb2.tick(0.3); const f = mb2.fighters.find((x) => x.team === 1); const s = `${f.kit.name.pl} ${f.kit.weapon}`; f.hp = 0; f.die(); mb2.tick(2.2); await new Promise((r) => setTimeout(r, 50)); return s + " → " + document.getElementById("mtitle").textContent; }));
    if (r === 0) await shot("bout");
    if (r < 2) await click("Do następnej");
  }
  console.log("prize", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ") + " gold " + mb2.camp.co.party.gold));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

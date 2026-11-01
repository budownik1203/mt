// Build 12: faith and rites — monastery, grove, chaplain and żerca, camp rites, blessings, sacrifice → excommunication, penance, events, Dziady.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `shots/b12_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  const st = () => p.evaluate(() => { const f = mb2.camp.co.faith; return `wiara ${f.hero} pob ${Math.round(f.piety)} łaska ${Math.round(f.favor)} ex ${f.excom} boon ${f.boon ? f.boon.id + "→" + f.boon.until : "-"} gold ${mb2.camp.co.party.gold} morale ${Math.round(mb2.camp.co.morale)}`; });
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  const go = (id) => p.evaluate((id) => { const c = mb2.camp, q = c.w.pois.find((x) => x.id === id); c.co.party.x = q.x + 2; c.co.party.z = q.z + 2; c.parties = c.parties.filter((x) => x.kind === "player" || x.kind === "lord"); c.co.party.gold = 1500; mb2.ui.close(); mb2.ui.campMenu(); }, id);
  await go("monastery"); await shot("monastery");
  console.log("mass", await click("Msza i spowiedź"), await st());
  console.log("relic", await click("Kup relikwię"), await st());
  console.log("chaplain", await click("Przyjmij kapelana"));
  console.log("camp", await click("Rozbij"));
  console.log("field mass", await click("Msza polowa"), await st());
  await go("grove"); await shot("grove");
  console.log("food offering", await click("Ofiara z jadła"), await st());
  console.log("zerca", await click("Przyjmij żercę"));
  await p.evaluate(() => { mb2.camp.co.prisoners = [{ t: "rozbojnik", n: 2 }]; mb2.ui.campMenu(); });
  console.log("human sacrifice", await click("Ofiara z jeńca"), await st());
  await shot("sacrifice");
  await go("monastery");
  console.log("mass while excommunicated", await click("Msza i spowiedź"));
  console.log("penance", await click("Pokuta"), await st());
  await p.evaluate(() => { mb2.camp.co.party.troops.push({ t: "zbrojny", n: 10, wounded: 0, xp: 0 }); mb2.ui.close(); mb2.ui.partyPanel(); });
  console.log("party faith", await p.evaluate(() => [...document.querySelectorAll("#mbody p.meta")].map((e) => e.innerText).find((t) => t.startsWith("Wiara"))));
  await shot("party");
  // events
  for (const id of ["swiety", "stos", "wrozba"]) { console.log(id, await p.evaluate((id) => { mb2.ui.close(); const ev = mb2.events.find((e) => e.id === id); mb2.ui.event(ev); return document.getElementById("mtitle").textContent; }, id)); }
  await shot("event");
  console.log("choice", await p.evaluate(() => { [...document.querySelectorAll("#macts button")][0].click(); return document.getElementById("mbody").innerText.slice(0, 120); }));
  // Dziady
  await p.evaluate(() => { const c = mb2.camp; c.day = 120 * Math.ceil(c.day / 120) + 85; c.leaveField(c.co.party.x + 1, c.co.party.z, 8); c.co.food.push({ type: "grain", n: 40, age: 0 }); c.co.camp = true; mb2.ui.close(); mb2.ui.campMenu(); });
  console.log("dziady", await click("Nakarmić zmarłych"), await p.evaluate(() => "fields " + mb2.camp.fields.length));
  // battle with a blessing: morale of church men higher
  const mor = await p.evaluate(() => { const c = mb2.camp; mb2.ui.close(); c.co.faith.boon = { id: "blogoslawienstwo", until: c.day + 2 }; const b = c.parties.find((q) => q.kind === "bandits") ?? c.parties.find((q) => q.kind !== "player"); mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")][0].click(); return "ok"; });
  await p.waitForTimeout(800);
  console.log("battle morale", await p.evaluate(() => mb2.fighters.filter((f) => f.team === 0 && f !== mb2.player).map((f) => f.kit.name.pl.split(" ")[0] + ":" + Math.round(f.morale)).join(", ")));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

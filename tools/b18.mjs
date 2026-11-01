// Build 18: second region — border road, new factions and lords, region-aware save/load.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `shots/b18_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  console.log("regions", await p.evaluate(() => { const c = mb2.camp; return Object.entries(c.regions).map(([k, r]) => `${k}: ${r.w.settlements.length} osad, ${r.parties.length} oddziałów (${r.parties.filter((q) => q.kind === "lord").map((q) => q.lord).join(",")})`).join(" | "); }));
  // ride to the border road
  await p.evaluate(() => { const c = mb2.camp, b = c.w.pois.find((q) => q.kind === "border"); c.co.party.x = b.x - 3; c.co.party.z = b.z; c.speed = 0; mb2.mapTick(0.2); mb2.ui.campMenu(); });
  await shot("border");
  console.log("cross", await click("Przekrocz granicę"));
  await p.waitForTimeout(500);
  console.log("now", await p.evaluate(() => { const c = mb2.camp; return `${c.region} (${c.regionName()}) day ${c.day} · player at ${c.co.party.x.toFixed(0)},${c.co.party.z.toFixed(0)} · in list ${c.parties.includes(c.co.party)} · labels ${document.querySelectorAll("#labels .lbl").length}`; }));
  await p.evaluate(() => { mb2.camp.speed = 0; mb2.mapTick(0.3); }); await shot("map2");
  await p.evaluate(() => mb2.ui.settlement("hansberg")); await shot("hansberg");
  await p.evaluate(() => mb2.ui.settlement("martwogrod")); console.log("martwogrod", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ").slice(0, 200)));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.settlement("kostnica"); }); console.log("lich village", await p.evaluate(() => [...document.querySelectorAll("#macts button")].map((b) => b.innerText.replace(/\n/g, " ")).slice(0, 2).join(" | ")));
  await p.evaluate(() => { mb2.ui.close(); mb2.ui.factionsPanel(); }); await shot("factions");
  // run the new region's world for 20 days
  console.log("sim", await p.evaluate(() => { const c = mb2.camp; mb2.ui.close(); c.co.inside = true; c.passHours(24 * 20); c.co.inside = false; return c.notes.slice(0, 8).map((n) => n.text).join(" / "); }));
  // save, load, cross back
  console.log("save/load", await p.evaluate(() => { const c = mb2.camp, s = c.save(); const ok = c.load(s); return ok + " region " + c.region + " parties " + c.parties.length + " popiel " + c.regions.popiel.parties.length; }));
  await p.evaluate(() => { const c = mb2.camp, b = c.w.pois.find((q) => q.kind === "border"); c.co.party.x = b.x + 3; c.co.party.z = b.z; mb2.ui.campMenu(); });
  console.log("back", await click("Przekrocz granicę"), await p.evaluate(() => mb2.camp.region));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

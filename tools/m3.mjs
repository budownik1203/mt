export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => mb2.campaign());
  const out = await p.evaluate(() => {
    const c = mb2.camp, me = c.co.party, L = [];
    L.push("food0 " + c.foodTotal + " men " + c.men);
    c.co.inside = true;
    c.leaveField(me.x + 3, me.z, 12);
    c.passHours(24 * 3.5);
    L.push("after 3.5d food " + c.foodTotal + " hunger " + c.co.hungerDays + " morale " + Math.round(c.co.morale) + " undead " + c.parties.filter((q) => q.kind === "undead").length);
    c.passHours(24 * 3);
    L.push("after 6.5d food " + c.foodTotal + " hunger " + c.co.hungerDays + " men " + c.men + " morale " + Math.round(c.co.morale));
    L.push(c.notes.slice(0, 8).map((n) => n.text).join(" / "));
    return L.join("\n");
  });
  console.log(out);
  // market
  await p.evaluate(() => { mb2.ui.settlement("grauburg"); });
  await p.waitForTimeout(300); await p.screenshot({ path: "shots/m3_town.png" });
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")].find((b) => b.textContent.startsWith("Targ")).click(); });
  await p.waitForTimeout(300); await p.screenshot({ path: "shots/m3_market.png" });
  await p.evaluate(() => { mb2.ui.close(); });
  // winter
  const w = await p.evaluate(() => { const c = mb2.camp; c.co.food.push({ type: "grain", n: 500, age: 0 }); c.co.party.gold = 5000; c.passHours(24 * 70); return c.dateText("pl") + " winter " + c.winter + " speed " + c.speedOf(c.co.party).toFixed(2) + " men " + c.men; });
  console.log(w);
  await p.evaluate(() => { mb2.mapCam(0.6, 1.0, 70); mb2.mapTick(0.2); });
  await p.waitForTimeout(500); await p.screenshot({ path: "shots/m3_winter.png" });
  await p.evaluate(() => mb2.ui.partyPanel());
  await p.waitForTimeout(300); await p.screenshot({ path: "shots/m3_party.png" });
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

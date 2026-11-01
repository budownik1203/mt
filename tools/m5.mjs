export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => mb2.campaign());
  const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: `shots/m5_${n}.png` }); };
  await p.evaluate(() => { mb2.mapCam(0.5, 1.15, 125); mb2.mapTick(0.3); }); await shot("a");
  await p.evaluate(() => { const c = mb2.camp; c.orderMove(-34, -16, "gnilowo"); mb2.mapCam(1.4, 0.8, 42); mb2.mapTick(6); c.speed = 0; }); await shot("b");
  await p.evaluate(() => { const c = mb2.camp; c.co.inside = true; c.co.food.push({ type: "grain", n: 900, age: 0 }); c.passHours(24 * 72); c.co.inside = false; mb2.mapCam(0.6, 1.0, 70); mb2.mapTick(0.2); }); await shot("c");
  // night battle in the forest, winter
  await p.evaluate(() => { const c = mb2.camp, me = c.co.party; c.hour = 13; me.x = 40; me.z = 0; const b = c.parties.find((q) => q.kind === "bandits"); b.x = me.x + 1; b.z = me.z; b.troops = [{ t: "rozbojnik", n: 10, wounded: 0, xp: 0 }, { t: "herszt", n: 1, wounded: 0, xp: 0 }]; mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { mb2.pause(true); mb2.tick(5); }); await shot("d");
  console.log("save", await p.evaluate(() => { const s = mb2.camp.save(); return s.length; }));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

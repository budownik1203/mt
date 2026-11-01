export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { const c = mb2.camp, me = c.co.party; me.troops = [{ t: "chlop", n: 8, wounded: 0, xp: 0 }, { t: "pacholek", n: 6, wounded: 0, xp: 0 }, { t: "zbrojny", n: 4, wounded: 0, xp: 0 }];
    const b = c.parties.find((q) => q.kind === "bandits"); b.troops = [{ t: "rozbojnik", n: 16, wounded: 0, xp: 0 }, { t: "herszt", n: 1, wounded: 0, xp: 0 }]; mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(1200); await p.screenshot({ path: "shots/b6_deploy.png" });
  // put group 2 into a hedgehog and group 1 into a shield wall, start
  const key = (k, o = {}) => p.evaluate(([k, o]) => window.dispatchEvent(new KeyboardEvent("keydown", { code: k, ...o })), [k, o]);
  await key("Digit2"); await key("F2"); await key("F2"); await key("F2"); await key("F2");
  await key("Digit1"); await key("F2"); await key("F2"); await key("F2");
  await p.waitForTimeout(500); await p.screenshot({ path: "shots/b6_deploy2.png" });
  await key("Space");
  await p.evaluate(() => { mb2.pause(true); mb2.tick(3); }); await p.waitForTimeout(500); await p.screenshot({ path: "shots/b6_fight1.png" });
  await key("Digit0"); await key("F1"); await key("F3");
  await p.evaluate(() => { mb2.tick(8); }); await p.waitForTimeout(500); await p.screenshot({ path: "shots/b6_fight2.png" });
  console.log(await p.evaluate(() => document.getElementById("orders").innerText.replace(/\n/g, " | ") + "\nLOG " + document.getElementById("log").innerText.replace(/\n/g, " / ")));
  console.log(await p.evaluate(() => mb2.fighters.filter(f => f.team === 1).map(f => Math.round(f.morale) + (f.fleeing ? "F" : "") + (f.alive ? "" : "x")).join(" ")));
  await p.evaluate(() => { mb2.tick(10); });
  console.log(await p.evaluate(() => mb2.mode + " | " + (document.getElementById("mbody")?.innerText ?? "").replace(/\n/g, " ")));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

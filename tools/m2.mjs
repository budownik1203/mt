export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => mb2.campaign());
  await p.evaluate(() => { mb2.mapCam(0.6, 1.2, 150); mb2.mapTick(0.3); });
  await p.waitForTimeout(500); await p.screenshot({ path: "shots/m2_over.png" });
  await p.evaluate(() => { mb2.mapCam(0.6, 0.95, 55); mb2.mapTick(0.3); });
  await p.waitForTimeout(500); await p.screenshot({ path: "shots/m2_close.png" });
  // put a bandit band next to us and let it come
  const r = await p.evaluate(() => { const c = mb2.camp, me = c.co.party; const b = c.parties.find((q) => q.kind === "bandits"); b.x = me.x + 5; b.z = me.z + 3; b.troops = [{ t: "rozbojnik", n: 16, wounded: 0, xp: 0 }]; c.co.camp = true; c.speed = 1; for (let i = 0; i < 300 && !mb2.ui.open; i++) mb2.mapTick(0.1); return mb2.ui.open + " " + document.getElementById("mtitle").textContent; });
  console.log("encounter", r);
  await p.waitForTimeout(300); await p.screenshot({ path: "shots/m2_enc.png" });
  // fight
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")].find((b) => b.textContent.startsWith("Do walki")).click(); });
  await p.waitForTimeout(1200);
  console.log("mode", await p.evaluate(() => mb2.mode + " fighters " + mb2.fighters.length));
  await p.evaluate(() => { mb2.pause(true); mb2.tick(4); });
  await p.waitForTimeout(600); await p.screenshot({ path: "shots/m2_battle.png" });
  await p.evaluate(() => { mb2.tick(8); });
  await p.waitForTimeout(600); await p.screenshot({ path: "shots/m2_battle2.png" });
  console.log("battle", await p.evaluate(() => document.getElementById("clock").textContent + " | " + document.getElementById("log").innerText.split("\n").slice(0, 3).join(" / ")));
  await p.evaluate(() => { mb2.killFoes(); mb2.tick(0.5); });
  await p.waitForTimeout(3000);
  console.log("after", await p.evaluate(() => mb2.mode + " | " + document.getElementById("mtitle").textContent + " | " + document.getElementById("mbody").innerText.replace(/\n/g, " ")));
  await p.screenshot({ path: "shots/m2_after.png" });
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][0].click(); });
  console.log("post", await p.evaluate(() => mb2.camp.notes.slice(0, 4).map((n) => n.text).join(" / ") + " | troops " + JSON.stringify(mb2.camp.co.party.troops)));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

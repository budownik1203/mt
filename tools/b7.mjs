export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `shots/b7_${n}.png` }); };
  await shot("title");
  await p.evaluate(() => document.getElementById("topts").click()); await shot("opts");
  await p.evaluate(() => document.getElementById("o-close").click());
  await p.evaluate(() => mb2.campaign(true)); await shot("create");
  await p.evaluate(() => { document.getElementById("cname").value = "Wojsław"; [...document.querySelectorAll("#macts button")][4].click(); });
  console.log(await p.evaluate(() => { const h = mb2.camp.co.hero; return h.name + " " + h.origin + " gold " + mb2.camp.co.party.gold + " armour " + h.armour + " w " + h.weapons; }));
  await shot("map");
  await p.evaluate(() => mb2.ui.settlement("grauburg")); await shot("town");
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")].find((b) => b.textContent.startsWith("Kowal")).click(); }); await shot("smith");
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")].find((b) => b.textContent.startsWith("Miecz dwu")).click(); });
  await p.evaluate(() => { mb2.camp.co.hero.attrPts = 2; mb2.ui.characterPanel(); }); await shot("char");
  await p.evaluate(() => mb2.ui.inventoryPanel()); await shot("inv");
  await p.evaluate(() => { const b = document.querySelector("#mbody [data-eq]"); b && b.click(); });
  console.log("weapons", await p.evaluate(() => mb2.camp.co.hero.weapons.join(",")));
  await p.evaluate(() => mb2.ui.close());
  // force an event through the campaign
  await p.evaluate(() => { const c = mb2.camp; c.co.party.path = [[c.co.party.x + 40, c.co.party.z]]; c.co.inside = false; c.speed = 1; for (let i = 0; i < 40 && !mb2.ui.open; i++) { mb2.mapTick(2); } });
  console.log("event?", await p.evaluate(() => mb2.ui.open + " " + document.getElementById("mtitle").textContent));
  await shot("event");
  await p.evaluate(() => mb2.ui.close());
  // battle with hero gear, then prisoners
  await p.evaluate(() => { const c = mb2.camp, me = c.co.party; me.troops = [{ t: "chlop", n: 10, wounded: 0, xp: 0 }, { t: "zbrojny", n: 4, wounded: 0, xp: 0 }];
    const b = c.parties.find((q) => q.kind === "bandits"); b.troops = [{ t: "rozbojnik", n: 12, wounded: 0, xp: 0 }]; mb2.ui.encounter(b); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
  console.log("player kit", await p.evaluate(() => mb2.player.kit.weapon + " hp " + mb2.player.maxHp));
  await p.evaluate(() => { mb2.pause(true); mb2.tick(4); }); await shot("battle");
  await p.evaluate(() => { for (const f of mb2.fighters) if (f.team === 1) { f.hp = 0; f.die(); f.lastType = "blunt"; } mb2.enc.enemyQ.length = 0; mb2.tick(0.5); });
  await p.waitForTimeout(3000);
  console.log("after", await p.evaluate(() => document.getElementById("mbody").innerText.replace(/\n/g, " ")));
  await shot("after");
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][0].click(); mb2.ui.partyPanel(); }); await shot("party");
  console.log("prisoners", await p.evaluate(() => JSON.stringify(mb2.camp.co.prisoners) + " lvl " + mb2.camp.co.hero.level + " xp " + mb2.camp.co.hero.xp));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

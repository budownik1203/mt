// UI audit: screenshots of every screen (title, options, map HUD, menus, panels, battle HUDs).
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `shots/ui_${n}.png` }); };
  await shot("title");
  await p.evaluate(() => document.getElementById("topts").click()); await shot("options");
  await p.evaluate(() => document.getElementById("o-close").click());
  await p.evaluate(() => mb2.campaign(true)); await shot("create");
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  await p.evaluate(() => { const c = mb2.camp; c.co.party.troops.push({ t: "kusznik", n: 4, wounded: 1, xp: 2 }, { t: "jezdziec", n: 2, wounded: 0, xp: 0 }); c.co.prisoners = [{ t: "rozbojnik", n: 3 }]; c.speed = 0; mb2.mapTick(0.3); });
  await shot("map");
  await p.evaluate(() => mb2.ui.settlement("grauburg")); await shot("town");
  await p.evaluate(() => mb2.ui.settlement("gnilowo")); await shot("village");
  await p.evaluate(() => mb2.ui.characterPanel()); await shot("character");
  await p.evaluate(() => mb2.ui.inventoryPanel()); await shot("inventory");
  await p.evaluate(() => mb2.ui.partyPanel()); await shot("party");
  await p.evaluate(() => mb2.ui.factionsPanel()); await shot("factions");
  await p.evaluate(() => mb2.ui.chronicle()); await shot("chronicle");
  await p.evaluate(() => mb2.ui.campMenu()); await shot("camp");
  await p.evaluate(() => { mb2.ui.close(); const b = mb2.camp.parties.find((q) => q.kind === "bandits"); mb2.ui.encounter(b); }); await shot("encounter");
  await p.evaluate(() => [...document.querySelectorAll("#macts button")][0].click());
  await p.waitForTimeout(900); await shot("deploy");
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.pause(true); mb2.tick(1.5); }); await shot("battle");
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "F1" })); }); await shot("battle_menu");
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

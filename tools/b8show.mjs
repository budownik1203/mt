// Close-up of the undead models in daylight (for the changelog).
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][0].click(); });
  await p.evaluate(() => { const c = mb2.camp, me = c.co.party; c.hour = 12; me.troops = [{ t: "rycerz_grobu", n: 2, wounded: 0, xp: 0 }, { t: "kosciany_straznik", n: 2, wounded: 0, xp: 0 }, { t: "straznik_krypty", n: 2, wounded: 0, xp: 0 }];
    const q = c.newParty("necro", "Nekromanta", me.x + 1, me.z, [{ t: "nekromanta", n: 1, wounded: 0, xp: 0 }, { t: "szkielet", n: 3, wounded: 0, xp: 0 }, { t: "kosciany_wojownik", n: 2, wounded: 0, xp: 0 }, { t: "ghul", n: 2, wounded: 0, xp: 0 }, { t: "ghul_cmentarny", n: 1, wounded: 0, xp: 0 }, { t: "zywy_trup", n: 2, wounded: 0, xp: 0 }]);
    mb2.ui.encounter(q); [...document.querySelectorAll("#macts button")][0].click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.pause(true); mb2.noAI(true); mb2.tick(0.2);
    let i = 0; for (const f of mb2.fighters) if (f.team === 1) { f.x = -6 + (i % 6) * 2.2; f.z = -2 - Math.floor(i / 6) * 2.4; f.yaw = 0; i++; }
    i = 0; for (const f of mb2.fighters) if (f.team === 0 && f !== mb2.player) { f.x = -5 + i * 2; f.z = 6; f.yaw = Math.PI; i++; }
    mb2.player.x = 0; mb2.player.z = 14; mb2.tick(0.1); });
  await p.evaluate(() => { mb2.cam([0, 2.0, 5.5], [0, 1.0, -2]); mb2.tick(0.1); }); await p.waitForTimeout(400); await p.screenshot({ path: "shots/b8_models_enemy.png" });
  await p.evaluate(() => { mb2.cam([0, 2.0, 1.0], [0, 1.0, 6]); mb2.tick(0.1); }); await p.waitForTimeout(400); await p.screenshot({ path: "shots/b8_models_mine.png" });
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

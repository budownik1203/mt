// Build 14: sieges — wall, ladders, gate, defenders on the walk, attackers climbing, gate breaking.
export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  const shot = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `shots/b14_${n}.png` }); };
  const click = (start) => p.evaluate((s) => { const b = [...document.querySelectorAll("#macts button")].find((x) => x.textContent.startsWith(s)); if (!b) return "missing " + s; if (b.disabled) return "disabled " + s; b.click(); return "ok"; }, start);
  await p.evaluate(() => mb2.campaign(true));
  await p.evaluate(() => { [...document.querySelectorAll("#macts button")][4].click(); });
  await p.evaluate(() => { const c = mb2.camp; c.hour = 11; c.co.party.gold = 2000; c.co.hero.renown = 200; c.fx.join = { f: "wronsk", role: "vassal", until: 0 }; if (!c.fx.wars.includes("cesarstwo|wronsk")) c.fx.wars.push("cesarstwo|wronsk");
    c.co.party.troops = [{ t: "zbrojny", n: 14, wounded: 0, xp: 0 }, { t: "halabardnik", n: 8, wounded: 0, xp: 0 }, { t: "kusznik", n: 6, wounded: 0, xp: 0 }]; c.fx.garrison.grauburg = 22; mb2.ui.settlement("grauburg"); });
  console.log("assault", await click("Szturmuj"));
  await p.waitForTimeout(800);
  await p.evaluate(() => { mb2.pause(true); mb2.cam([30, 16, 22], [0, 2, -8]); mb2.tick(0.05); });
  await shot("deploy");
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); mb2.noAI(false); mb2.bot(0, 0); mb2.tick(0.2); });
  console.log("defenders", await p.evaluate(() => { const d = mb2.fighters.filter((f) => f.team === 1); return d.length + " · on wall " + d.filter((f) => f.y - mb2.height(f.x, f.z) > 2.5).length + " · gate " + mb2.gate(); }));
  const run = async (sec) => p.evaluate((sec) => { for (let i = 0; i < sec * 2; i++) mb2.tick(0.5);
    const a = mb2.fighters.filter((f) => f.team === 0 && f !== mb2.player), d = mb2.fighters.filter((f) => f.team === 1);
    return `attackers alive ${a.filter((f) => f.alive).length}/${a.length}, on wall/inside ${a.filter((f) => f.alive && (f.y - mb2.height(f.x, f.z) > 2 || f.z < -11)).length} · defenders alive ${d.filter((f) => f.alive).length}/${d.length} · gate ${mb2.gate()}`; }, sec);
  console.log("t+10s", await run(10));
  await p.evaluate(() => { mb2.cam([22, 6, 2], [13, 2.5, -9]); mb2.tick(0.02); }); await shot("ladder");
  console.log("t+25s", await run(15));
  await p.evaluate(() => { mb2.cam([8, 7, 6], [0, 2, -10]); mb2.tick(0.02); }); await shot("gate");
  console.log("t+45s", await run(20));
  console.log("gate broken, colliders left", await p.evaluate(() => mb2.breakGate()), await p.evaluate(() => mb2.gate()));
  await p.evaluate(() => { mb2.cam([4, 4, 2], [0, 1.5, -12]); mb2.tick(0.5); }); await shot("gate_broken");
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

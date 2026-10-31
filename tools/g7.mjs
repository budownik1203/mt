export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => { mb2.start(); mb2.setHour(15); mb2.pause(true); });
  const L = new Set();
  for (let i = 0; i < 40; i++) { const l = await p.evaluate(() => { mb2.player.hp = 999; mb2.tick(1); return document.getElementById("log").innerText; }); l.split("\n").forEach((s) => s && L.add(s)); }
  console.log(await p.evaluate(() => mb2.fighters.map(f => `${f.team} ${f.state} ${f.x.toFixed(1)},${f.z.toFixed(1)} hp${f.hp}`).join(" / ")));
  console.log(await p.evaluate(() => mb2.dbg()));
  await p.screenshot({ path: "shots/g7.png" });
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
  console.log([...L].slice(0, 25).join("\n"));
};

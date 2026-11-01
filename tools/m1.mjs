export default async (p) => {
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluate(() => mb2.campaign());
  await p.waitForTimeout(800);
  await p.screenshot({ path: "shots/m1_start.png" });
  // overview
  await p.evaluate(() => { mb2.mapCam(0.6, 1.25, 150); mb2.mapTick(0.5); });
  await p.waitForTimeout(500); await p.screenshot({ path: "shots/m1_over.png" });
  // walk to Grauburg
  const r = await p.evaluate(() => { const c = mb2.camp; const s = c.w.settlements.find((q) => q.id === "gnilowo"); const ok = c.orderMove(s.x + 1.5, s.z + 1.5, s.id); return ok + " path " + c.co.party.path.length; });
  console.log("order", r);
  await p.evaluate(() => mb2.mapCam(0.6, 0.95, 62));
  for (let i = 0; i < 40; i++) { const st = await p.evaluate(() => { mb2.mapTick(2); const c = mb2.camp; return [c.dateText("pl"), c.co.party.path.length, mb2.ui.open, document.getElementById("mtitle").textContent].join(" | "); }); if (i % 5 === 0 || st.includes("true")) console.log(st); if (st.includes("| true |")) break; }
  await p.waitForTimeout(400); await p.screenshot({ path: "shots/m1_menu.png" });
  console.log("notes", await p.evaluate(() => mb2.camp.notes.slice(0, 5).map(n => n.text).join(" / ")));
  console.log("errors", errs.length, errs.slice(0, 3).join(" | "));
};

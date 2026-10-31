// Pose sheet: player (sword + shield) frozen in each attack/block pose.
export default async (p) => {
  await p.evaluate(() => { mb2.start(); mb2.setHour(13); });
  await p.waitForTimeout(300);
  const poses = [["windup",0,0.37],["release",0,0.19],["windup",1,0.37],["release",1,0.19],["windup",2,0.37],["release",2,0.19],["windup",3,0.37],["release",3,0.19],["block",0,0.5],["block",1,0.5],["block",2,0.5],["block",3,0.5]];
  const view = process.env.VIEW || "34";
  for (const [s,d,t] of poses) {
    await p.evaluate(([s,d,t,view]) => {
      const e = mb2.player;
      e.x = 0; e.z = 0; e.vx = e.vz = 0; mb2.look(0, 0); e.yaw = 0;
      const y = e.y;
      const off = view === "front" ? [0.3, 3.2] : view === "side" ? [3.2, 0.2] : [2.4, 2.4];
      mb2.cam([e.x + off[0], y + 1.6, e.z + off[1]], [e.x, y + 1.25, e.z]);
      mb2.pause(true);
      for (let i = 0; i < 14; i++) mb2.freeze(e, s, d, t);
    }, [s,d,t,view]);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `shots/pose_${s}_${d}.png`, clip: { x: 390, y: 110, width: 500, height: 500 } });
  }
};

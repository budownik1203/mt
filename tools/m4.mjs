export default async (p) => {
  await p.evaluate(() => mb2.campaign());
  console.log(await p.evaluate(() => { const c = mb2.camp; c.co.inside = true; c.co.food.push({ type: "grain", n: 900, age: 0 }); c.co.party.gold = 5000; const L = [];
    for (let d = 0; d < 70; d += 5) { c.passHours(24 * 5); L.push(c.day + " men " + c.men + " mor " + Math.round(c.co.morale) + " food " + c.foodTotal + " water " + c.co.water); }
    return L.join("\n") + "\n" + c.notes.slice(0, 12).map((n) => n.text).join(" / "); }));
};

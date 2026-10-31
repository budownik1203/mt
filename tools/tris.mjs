export default async (p) => { for (const l of ["ps1a","ps1b","ps2"]) { await p.evaluate((l)=>lab.set({level:l}), l); console.log(l, await p.evaluate(()=>lab.tris)); } };

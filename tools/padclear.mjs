// Pad clearance check: exact distance from each site pad ring + pylons + housing to every solid.
import { SITES } from "../game/src/config.js";
import { ALL_SOLIDS } from "../game/src/map.js";

// A solid is an axis-aligned box S(x1,z1,x2,z2,top,kind,base=0). Footprint distance from a point.
const dPoint = (px, pz, s) => {
  const cx = Math.max(s.x1, Math.min(px, s.x2));
  const cz = Math.max(s.z1, Math.min(pz, s.z2));
  return Math.hypot(px - cx, pz - cz);
};

const report = [];
for (const key of ["A", "B"]) {
  const site = SITES[key];
  const [cx, , cz] = site.center;
  const R = site.radius;
  const ringOuter = R + 0.12 + 0.075;
  const pylons = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 * i + Math.PI / 4;
    pylons.push([cx + Math.cos(a) * (R + 0.55), cz + Math.sin(a) * (R + 0.55)]);
  }
  const housing = [cx + R * 0.62, cz - R * 0.62];
  const housingR = 0.78;

  let padClear = Infinity, padSolid = null;
  let pylonClear = Infinity, pylonSolid = null;
  let housingClear = Infinity, housingSolid = null;
  for (const s of ALL_SOLIDS) {
    if (s.kind === "rail" || s.kind === "stair" || s.kind === "deck") continue;
    const dp = dPoint(cx, cz, s) - ringOuter;
    if (dp < padClear) { padClear = dp; padSolid = s.kind + " " + [s.x1, s.z1, s.x2, s.z2].join(","); }
    for (const [px, pz] of pylons) {
      const dq = dPoint(px, pz, s) - 0.19;
      if (dq < pylonClear) { pylonClear = dq; pylonSolid = s.kind + " " + [s.x1, s.z1, s.x2, s.z2].join(","); }
    }
    const dh = dPoint(housing[0], housing[1], s) - housingR;
    if (dh < housingClear) { housingClear = dh; housingSolid = s.kind + " " + [s.x1, s.z1, s.x2, s.z2].join(","); }
  }
  // full mesh overlap test: does any solid footprint overlap the pad disc?
  const overlap = ALL_SOLIDS.filter((s) => {
    if (s.kind === "rail" || s.kind === "stair" || s.kind === "deck") return false;
    return dPoint(cx, cz, s) < R;
  }).map((s) => s.kind + " " + [s.x1, s.z1, s.x2, s.z2].join(","));

  report.push({
    site: key, center: [cx, cz], radius: R, ringOuter: +ringOuter.toFixed(3),
    padClear: +padClear.toFixed(2), padSolid,
    pylonClear: +pylonClear.toFixed(2), pylonSolid,
    housingClear: +housingClear.toFixed(2), housingSolid,
    padOverlapsWall: overlap,
    clears: overlap.length === 0 && padClear > 0 && pylonClear > 0 && housingClear > 0,
  });
}
console.log(JSON.stringify(report, null, 2));
const bad = report.filter((r) => !r.clears);
console.log(bad.length === 0 ? "\nALL PADS CLEAR" : "\nFAILING: " + bad.map((b) => b.site).join(","));
process.exit(bad.length === 0 ? 0 : 1);

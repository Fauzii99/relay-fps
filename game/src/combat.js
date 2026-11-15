import { HEADSHOT_MULT, LIMB_MULT} from "./config.js";
const ZONES = [ { zone: "head", y0: 1.56, y1: 1.88, radius: 0.185, mult: HEADSHOT_MULT}, { zone: "torso", y0: 1.04, y1: 1.56, radius: 0.285, mult: 1.0}, { zone: "pelvis", y0: 0.84, y1: 1.04, radius: 0.27, mult: 0.9}, { zone: "legs", y0: 0.0, y1: 0.84, radius: 0.26, mult: LIMB_MULT} ];
export function raycastFighter(ox, oy, oz, dx, dy, dz, maxT, fighter) {
 const fx = fighter.pos.x;
 const fz = fighter.pos.z;
 const baseY = fighter.pos.y - fighter.crouch * 0.42;
 let best = null;
 for (const z of ZONES) {
  const y0 = baseY + z.y0;
  const y1 = baseY + z.y1;
  const hit = verticalSegment(ox, oy, oz, dx, dy, dz, maxT, fx, y0, y1, fz, z.radius);
  if (hit !== null && (best === null || hit.t < best.t)) best = { t: hit.t, zone: z.zone, mult: z.mult, y: hit.y};}
 if (best !== null) {
  const lx = ox + dx * best.t - fx;
  const lz = oz + dz * best.t - fz;
  const c = Math.cos(fighter.yaw);
  const s = Math.sin(fighter.yaw);
  const lateral = Math.abs(lx * c + lz * s);
  const hitY = best.y - baseY;
  if (lateral > 0.245 && hitY > 1.02 && hitY < 1.62) best = { ...best, zone: "arms", mult: LIMB_MULT};}
 return best;}
function verticalSegment(ox, oy, oz, dx, dy, dz, maxT, cx, y0, y1, cz, radius) {
 const ex = ox - cx;
 const ez = oz - cz;
 const a = dx * dx + dz * dz;
 if (a < 1e-9) {
  if (ex * ex + ez * ez > radius * radius) return null;
  const y = oy;
  if (y < y0 || y > y1) return null;
  return { t: 0, y: y};}
 const tPlane = -(ex * dx + ez * dz) / a;
 const px = ex + dx * tPlane;
 const pz = ez + dz * tPlane;
 const horiz = Math.hypot(px, pz);
 if (horiz > radius) return null;
 const dxz = Math.sqrt(a);
 const half = Math.sqrt(Math.max(0, radius * radius - horiz * horiz)) / dxz;
 let t0 = tPlane - half;
 if (t0 < 0) t0 = 0;
 const t1 = Math.min(maxT, tPlane + half);
 if (t0 > t1) return null;
 const ya = oy + dy * t0;
 const yb = oy + dy * t1;
 const lo = Math.min(ya, yb);
 const hi = Math.max(ya, yb);
 if (hi < y0 || lo > y1) return null;
 let t = t0;
 if (Math.abs(dy) > 1e-8) if (ya < y0) t = Math.max(t, (y0 - oy) / dy); else if (ya > y1) t = Math.max(t, (y1 - oy) / dy);
 if (t > t1 || t > maxT) return null;
 return { t: t, y: oy + dy * t};}
export function damageAtRange(weapon, dist) {
 if (dist <= weapon.falloffStart) return weapon.damage;
 if (dist >= weapon.falloffEnd) return weapon.damage * weapon.falloffMin;
 const t = (dist - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart);
 return weapon.damage * (1 - t * (1 - weapon.falloffMin));}
export function applyDamage(fighter, amount, zone) {
 let remaining = amount;
 let armourLost = 0;
 if (fighter.armor > 0 && zone !== "legs") {
  const absorbable = zone === "head" ? 0.34 : 0.5;
  const absorbed = Math.min(fighter.armor, remaining * absorbable);
  fighter.armor = Math.max(0, fighter.armor - absorbed);
  armourLost = absorbed;
  remaining -= absorbed;}
 fighter.health = Math.max(0, fighter.health - remaining);
 return { dealt: remaining, armourLost: armourLost, killed: fighter.health <= 0};}
const RECOIL_PATTERN = [ [ 0.0, 1.0 ], [ 0.42, 0.92 ], [ -0.5, 0.86 ], [ 0.66, 0.8 ], [ -0.72, 0.76 ], [ 0.34, 0.7 ], [ -0.28, 0.66 ], [ 0.82, 0.62 ], [ -0.86, 0.58 ], [ 0.5, 0.54 ], [ -0.44, 0.5 ], [ 0.2, 0.46 ] ];
export function recoilForShot(index) {
 const p = RECOIL_PATTERN[index % RECOIL_PATTERN.length];
 const cycles = Math.floor(index / RECOIL_PATTERN.length);
 return { side: p[0], up: p[1] * Math.pow(0.78, cycles)};}

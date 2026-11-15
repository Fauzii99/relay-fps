import { ALL_SOLIDS } from "./map.js";
const CELL = 8;
export class CollisionWorld {
 constructor(solids = ALL_SOLIDS) {
  this.solids = solids; this.grid = new Map;
  this.solidBoxes = solids.map((s, i) => ({ ...s, i: i }));
  for (const box of this.solidBoxes) {
   const cx1 = Math.floor(box.x1 / CELL); const cx2 = Math.floor(box.x2 / CELL);
   const cz1 = Math.floor(box.z1 / CELL); const cz2 = Math.floor(box.z2 / CELL);
   for (let cx = cx1; cx <= cx2; cx++) for (let cz = cz1; cz <= cz2; cz++) {
    const key = `${cx},${cz}`;
    let bucket = this.grid.get(key);
    if (bucket === void 0) {
     bucket = []; this.grid.set(key, bucket);
    }
    bucket.push(box);
   }
  }
  for (const bucket of this.grid.values()) bucket.sort((a, b) => a.i - b.i);
 }
 near(x1, z1, x2, z2, pad = 0) {
  const out = []; const cx1 = Math.floor((x1 - pad) / CELL);
  const cx2 = Math.floor((x2 + pad) / CELL); const cz1 = Math.floor((z1 - pad) / CELL);
  const cz2 = Math.floor((z2 + pad) / CELL);
  for (let cx = cx1; cx <= cx2; cx++) for (let cz = cz1; cz <= cz2; cz++) {
   const bucket = this.grid.get(`${cx},${cz}`);
   if (bucket === void 0) continue;
   for (const box of bucket) {
    if (out.length > 0 && out[out.length - 1] === box) continue; out.push(box);
   }
  }
  return out;
 }
 supportHeight(x, z, radius, feetY, stepHeight) {
  let best = 0; const boxes = this.near(x - radius, z - radius, x + radius, z + radius);
  for (const box of boxes) {
   if (box.kind === "rail") continue; const top = box.y1;
   if (top > feetY + stepHeight + 1e-4) continue; if (top <= best) continue;
   if (x + radius <= box.x1 || x - radius >= box.x2) continue;
   if (z + radius <= box.z1 || z - radius >= box.z2) continue; best = top;
  }
  return best;
 }
 resolve(x, z, radius, feetY, height, stepHeight) {
  let px = x; let pz = z;
  const boxes = this.near(px - radius, pz - radius, px + radius, pz + radius, radius);
  for (const box of boxes) {
   if (box.y1 <= feetY + stepHeight + 1e-4) continue; if (box.y0 >= feetY + height - 0.06) continue;
   const overlapX = Math.min(px + radius, box.x2) - Math.max(px - radius, box.x1);
   const overlapZ = Math.min(pz + radius, box.z2) - Math.max(pz - radius, box.z1);
   if (overlapX <= 0 || overlapZ <= 0) continue;
   if (overlapX < overlapZ) px += px < (box.x1 + box.x2) / 2 ? -overlapX : overlapX; else pz += pz < (box.z1 + box.z2) / 2 ? -overlapZ : overlapZ;
  }
  return { x: px, z: pz };
 }
 stepUp(x, z, radius, feetY, stepHeight) {
  return this.supportHeight(x, z, radius, feetY, stepHeight);
 }
 raycast(origin, dir, maxDist, mask = null) {
  const ex = origin.x + dir.x * maxDist; const ez = origin.z + dir.z * maxDist;
  const boxes = this.near(Math.min(origin.x, ex), Math.min(origin.z, ez), Math.max(origin.x, ex), Math.max(origin.z, ez), 0.5);
  let bestT = maxDist; let best = null;
  for (const box of boxes) {
   if (mask !== null && mask(box)) continue; const hit = slab(origin, dir, box, bestT);
   if (hit !== null && hit.t < bestT) {
    bestT = hit.t;
    best = { ...hit, solid: box };
   }
  }
  return best;
 }
 lineOfSight(ax, ay, az, bx, by, bz, mask = null) {
  const dx = bx - ax; const dy = by - ay;
  const dz = bz - az; const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true; const inv = 1 / dist;
  const hit = this.raycast({ x: ax, y: ay, z: az }, { x: dx * inv, y: dy * inv, z: dz * inv }, dist - 0.05, mask);
  return hit === null;
 }
}
function slab(origin, dir, box, maxT) {
 let tmin = 0; let tmax = maxT;
 let nx = 0; let ny = 0;
 let nz = 0;
 if (Math.abs(dir.x) < 1e-8) {
  if (origin.x < box.x1 || origin.x > box.x2) return null;
 } else {
  const inv = 1 / dir.x; let t1 = (box.x1 - origin.x) * inv;
  let t2 = (box.x2 - origin.x) * inv; let sign = -1;
  if (t1 > t2) {
   const tmp = t1; t1 = t2;
   t2 = tmp; sign = 1;
  }
  if (t1 > tmin) {
   tmin = t1; nx = sign;
   ny = 0; nz = 0;
  }
  if (t2 < tmax) tmax = t2; if (tmin > tmax) return null;
 }
 if (Math.abs(dir.y) < 1e-8) {
  if (origin.y < box.y0 || origin.y > box.y1) return null;
 } else {
  const inv = 1 / dir.y; let t1 = (box.y0 - origin.y) * inv;
  let t2 = (box.y1 - origin.y) * inv; let sign = -1;
  if (t1 > t2) {
   const tmp = t1; t1 = t2;
   t2 = tmp; sign = 1;
  }
  if (t1 > tmin) {
   tmin = t1; nx = 0;
   ny = sign; nz = 0;
  }
  if (t2 < tmax) tmax = t2; if (tmin > tmax) return null;
 }
 if (Math.abs(dir.z) < 1e-8) {
  if (origin.z < box.z1 || origin.z > box.z2) return null;
 } else {
  const inv = 1 / dir.z; let t1 = (box.z1 - origin.z) * inv;
  let t2 = (box.z2 - origin.z) * inv; let sign = -1;
  if (t1 > t2) {
   const tmp = t1; t1 = t2;
   t2 = tmp; sign = 1;
  }
  if (t1 > tmin) {
   tmin = t1; nx = 0;
   ny = 0; nz = sign;
  }
  if (t2 < tmax) tmax = t2; if (tmin > tmax) return null;
 }
 if (tmin <= 0 || tmin > maxT) return null;
 return { t: tmin, x: origin.x + dir.x * tmin, y: origin.y + dir.y * tmin, z: origin.z + dir.z * tmin, nx: nx, ny: ny, nz: nz };
}

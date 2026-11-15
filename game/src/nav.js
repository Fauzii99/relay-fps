import { WAYPOINTS, NAV_EDGES } from "./map.js";
const byId = new Map(WAYPOINTS.map(w => [ w.id, w ]));
export function nodeById(id) {
 return byId.get(id) ?? null;
}
export function nodesNear(x, z, lane = null) {
 let best = null; let bestD = 1 / 0;
 for (const w of WAYPOINTS) {
  if (lane !== null && w.lane !== lane) continue; const d = (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z);
  if (d < bestD) {
   bestD = d; best = w;
  }
 }
 return best;
}
export function nearestNode(x, z, lane = null) {
 return nodesNear(x, z, lane);
}
export function laneNodes(lane) {
 return WAYPOINTS.filter(w => w.lane === lane);
}
const cache = new Map;
export function findPath(startId, goalId) {
 if (startId === goalId) return [ startId ];
 const key = `${startId}>${goalId}`;
 const cached = cache.get(key); if (cached !== void 0) return cached;
 const start = byId.get(startId); const goal = byId.get(goalId);
 if (start === void 0 || goal === void 0) return []; const open = [ startId ];
 const cameFrom = new Map; const gScore = new Map([ [ startId, 0 ] ]);
 const fScore = new Map([ [ startId, Math.hypot(goal.x - start.x, goal.z - start.z) ] ]);
 const closed = new Set;
 while (open.length > 0) {
  let bestIdx = 0;
  for (let i = 1; i < open.length; i++) {
   const fi = fScore.get(open[i]) ?? 1 / 0; const fb = fScore.get(open[bestIdx]) ?? 1 / 0;
   if (fi < fb || fi === fb && open[i] < open[bestIdx]) bestIdx = i;
  }
  const current = open.splice(bestIdx, 1)[0];
  if (current === goalId) {
   const path = [ current ]; let node = current;
   while (cameFrom.has(node)) {
    node = cameFrom.get(node); path.unshift(node);
   }
   cache.set(key, path); return path;
  }
  closed.add(current); const edges = NAV_EDGES.get(current) ?? [];
  for (const next of edges) {
   if (closed.has(next)) continue; const a = byId.get(current);
   const b = byId.get(next); const step = Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(b.y - a.y) * 2.2;
   const tentative = (gScore.get(current) ?? 1 / 0) + step;
   if (tentative < (gScore.get(next) ?? 1 / 0)) {
    cameFrom.set(next, current); gScore.set(next, tentative);
    fScore.set(next, tentative + Math.hypot(goal.x - b.x, goal.z - b.z));
    if (!open.includes(next)) open.push(next);
   }
  }
 }
 cache.set(key, []); return [];
}
export function smoothPath(nodeIds, world, fromX, fromZ, fromY = 0) {
 const pts = nodeIds.map(id => byId.get(id)).filter(n => n !== void 0); if (pts.length === 0) return [];
 const out = []; let cx = fromX;
 let cz = fromZ; let cy = fromY;
 let i = 0;
 while (i < pts.length) {
  let chosen = i;
  for (let j = pts.length - 1; j > i; j--) {
   const p = pts[j]; const flat = Math.abs(p.y - cy) < 0.35;
   if (!flat) continue;
   if (world.lineOfSight(cx, cy + 0.85, cz, p.x, p.y + 0.85, p.z, b => b.y1 > p.y + 1.7)) {
    chosen = j; break;
   }
  }
  const p = pts[chosen];
  out.push({ x: p.x, y: p.y, z: p.z, id: p.id });
  cx = p.x; cz = p.z;
  cy = p.y; i = chosen + 1;
 }
 return out;
}
export function clearPathCache() {
 cache.clear();
}
export function pathLength(nodeIds) {
 let sum = 0;
 for (let i = 0; i + 1 < nodeIds.length; i++) {
  const a = byId.get(nodeIds[i]); const b = byId.get(nodeIds[i + 1]);
  if (a === void 0 || b === void 0) continue; sum += Math.hypot(b.x - a.x, b.z - a.z);
 }
 return sum;
}

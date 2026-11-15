import { SITES, SPAWNS } from "./config.js";
const S = (x1, z1, x2, z2, y1, kind = "wall", y0 = 0) => ({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), y0: y0, y1: y1, kind: kind });
const perimeter = [ S(-41, -49, 41, -47, 9, "wall"), S(-41, 47, 41, 49, 9, "wall"), S(-41, -49, -39, 49, 9, "wall"), S(39, -49, 41, 49, 9, "wall") ];
const spineWalls = [ S(-9, 16, -7, 44, 6.5, "wall"), S(7, 16, 9, 44, 6.5, "wall"), S(-9, -26, -7, 4, 6.5, "wall"), S(7, -26, 9, 4, 6.5, "wall") ];
const laneWalls = [ S(22, 16, 24, 44, 5.6, "wall"), S(22, -26, 24, -8, 5.6, "wall"), S(-24, 16, -22, 40, 5.6, "wall"), S(-24, -30, -22, -8, 5.6, "wall") ];
const blocks = [ S(-22, -6, -9, 16, 8.2, "block"), S(9, -6, 22, 16, 8.2, "block"), S(9, -36, 22, -10, 7.4, "block"), S(-22, -38, -9, -30, 6.2, "block"), S(-38, -47, -24, -30, 7.6, "block"), S(24, -47, 38, -38, 7.6, "block"), S(-38, 34, -22, 44, 7.0, "block"), S(24, 40, 38, 46, 6.4, "block") ];
const cover = [ S(-4.6, 30, -2.0, 32.6, 0.95, "crate"), S(2.2, 24, 4.8, 26.4, 0.95, "crate"), S(-1.2, 18.5, 1.6, 19.6, 1.15, "barrier"), S(-6.6, 8.4, -4.2, 9.6, 1.2, "barrier"), S(4.2, 6.0, 6.6, 7.2, 1.2, "barrier"), S(-1.4, 0.6, 1.4, 2.4, 0.95, "crate"), S(-5.0, -12.0, -2.4, -10.4, 0.95, "crate"), S(2.6, -18.0, 5.2, -16.2, 0.95, "crate"), S(-1.0, -25.0, 1.8, -23.8, 1.15, "barrier"), S(26.4, 28, 29.0, 30.6, 0.95, "crate"), S(31.0, 18, 33.6, 20.2, 0.95, "crate"), S(34.6, 10, 37.0, 11.2, 1.2, "barrier"), S(26.6, 2, 29.2, 4.0, 0.95, "crate"), S(27.0, -22.0, 29.6, -19.4, 0.95, "crate"), S(33.4, -26.0, 36.0, -23.4, 0.95, "crate"), S(30.0, -33.0, 32.6, -30.4, 0.95, "crate"), S(25.4, -31.0, 26.6, -27.0, 1.3, "barrier"), S(-33.0, 8, -30.4, 10.6, 0.95, "crate"), S(-36.0, 0, -33.4, 2.2, 0.95, "crate"), S(-30.0, -8, -28.8, -4.0, 1.2, "barrier"), S(-35.4, -16.0, -32.8, -14.0, 0.95, "crate"), S(-33.0, 22.0, -30.4, 24.6, 0.95, "crate"), S(-29.0, 28.0, -26.4, 30.6, 0.95, "crate"), S(-36.0, 30.0, -33.4, 32.6, 0.95, "crate"), S(-22.6, 20.0, -21.4, 24.0, 1.25, "barrier"), S(-6.2, 38, -3.6, 40.2, 0.95, "crate"), S(3.6, 38, 6.2, 40.2, 0.95, "crate"), S(-4.4, -34.0, -1.8, -32.4, 0.95, "crate"), S(2.0, -36.0, 4.6, -34.4, 0.95, "crate") ];
const pillars = [ S(-6.4, 22.6, -5.4, 23.6, 6.0, "pillar"), S(5.4, 13.4, 6.4, 14.4, 6.0, "pillar"), S(-6.4, -8.6, -5.4, -7.6, 6.0, "pillar"), S(5.4, -22.4, 6.4, -21.4, 6.0, "pillar"), S(25.4, 22.4, 26.6, 23.6, 6.0, "pillar"), S(25.4, -2.6, 26.6, -1.4, 6.0, "pillar"), S(35.4, -14.4, 36.6, -13.2, 6.0, "pillar"), S(-25.4, 6.4, -24.2, 7.6, 6.0, "pillar"), S(-25.4, -18.4, -24.2, -17.2, 6.0, "pillar"), S(-32.4, 14.6, -31.2, 15.8, 6.0, "pillar"), S(12.0, -12.4, 13.2, -11.2, 8.0, "pillar"), S(-12.0, 2.0, -10.8, 3.2, 8.0, "pillar") ];
const catwalks = [ {
 id: "east",
 deck: { x1: 30, z1: -16, x2: 38, z2: 12, y: 3.3 },
 rail: [ { x1: 30, z1: -16, x2: 30.3, z2: 12, h: 1.1 }, { x1: 30, z1: -16, x2: 38, z2: -15.7, h: 1.1 } ],
 stairs: { x1: 30.4, z1: 12.4, x2: 34.0, z2: 16.0, steps: 11, rise: 0.3, run: 0.32, dir: "z" },
 sign: "CATWALK 1"
}, {
 id: "west",
 deck: { x1: -38, z1: -6, x2: -30, z2: 18, y: 3.3 },
 rail: [ { x1: -30.3, z1: -6, x2: -30, z2: 18, h: 1.1 }, { x1: -38, z1: 17.7, x2: -30, z2: 18, h: 1.1 } ],
 stairs: { x1: -34.6, z1: 18.4, x2: -30.6, z2: 22.0, steps: 11, rise: 0.3, run: 0.32, dir: "z" },
 sign: "CATWALK 2"
} ];
export const props = [ { kind: "pipe", x1: -8.6, z1: 16, x2: -8.2, z2: 43, y: 4.6, r: 0.34 }, { kind: "pipe", x1: 8.2, z1: -25, x2: 8.6, z2: 3, y: 4.9, r: 0.3 }, { kind: "pipe", x1: 23.4, z1: 17, x2: 23.8, z2: 43, y: 3.4, r: 0.26 }, { kind: "tank", x: 35.2, z: -18.4, r: 1.5, h: 3.4 }, { kind: "tank", x: -35.6, z: 36.4, r: 1.5, h: 3.4 }, { kind: "tank", x: -14.0, z: -33.8, r: 1.2, h: 2.8 }, { kind: "beacon", site: "A", x: SITES.A.center[0], z: SITES.A.center[2] }, { kind: "beacon", site: "B", x: SITES.B.center[0], z: SITES.B.center[2] }, { kind: "sign", x: -10.4, z: 42.4, ry: 0.32, text: "MID" }, { kind: "sign", x: 10.4, z: 42.4, ry: -0.32, text: "A" }, { kind: "sign", x: 0, z: -37.2, ry: Math.PI, text: "MID" } ];
export const SOLIDS = [ ...perimeter, ...spineWalls, ...laneWalls, ...blocks, ...cover, ...pillars ];
export const CATWALK_SOLIDS = [];
for (const cw of catwalks) {
 const d = cw.deck;
 CATWALK_SOLIDS.push(S(d.x1, d.z1, d.x2, d.z2, d.y, "deck"));
 for (const r of cw.rail) CATWALK_SOLIDS.push(S(r.x1, r.z1, r.x2, r.z2, d.y + r.h, "rail", d.y));
 const st = cw.stairs;
 for (let i = 0; i < st.steps; i++) {
  const t0 = i / st.steps;
  const t1 = (i + 1) / st.steps;
  const z1 = st.z1 + (st.z2 - st.z1) * t0;
  const z2 = st.z1 + (st.z2 - st.z1) * t1;
  CATWALK_SOLIDS.push(S(st.x1, z1, st.x2, z2, st.rise * (st.steps - i), "stair", 0));
 }
}
export const ALL_SOLIDS = [ ...SOLIDS, ...CATWALK_SOLIDS ];
const W = (id, x, z, lane, y = 0, role = null) => ({ id: id, x: x, z: z, y: y, lane: lane, role: role });
export const WAYPOINTS = [ W("s0", 0, 44, "spawn"), W("s1", -6, 42.5, "spawn"), W("s2", 6, 42.5, "spawn"), W("m0", 0, 36, "mid"), W("m1", -4.6, 33, "mid"), W("m2", 4.4, 28, "mid"), W("m3", 0, 24, "mid"), W("m4", -3.4, 20, "mid"), W("m5", 3.2, 16, "mid"), W("x0", 0, 11, "mid"), W("x1", -8.4, 10, "mid"), W("x2", 8.4, 10, "mid"), W("x3", -10.6, 2, "cross"), W("x4", 10.6, 2, "cross"), W("x5", 0, 4, "mid"), W("x6", 0, -2, "mid"), W("n0", 0, -8, "mid"), W("n1", -4.6, -12, "mid"), W("n2", 4.4, -19, "mid"), W("n3", 0, -24, "mid"), W("n4", 0, -30, "mid"), W("n5", -8, -33, "mid"), W("n6", 8, -33, "mid"), W("c0", 0, -42, "spawn"), W("c1", -6, -40.5, "spawn"), W("c2", 6, -40.5, "spawn"), W("c3", -11, -37.6, "spawn"), W("c4", 11, -37.6, "spawn"), W("a0", 36, 30, "A"), W("a1", 31, 26, "A"), W("a2", 36, 20, "A"), W("a3", 30, 14, "A"), W("a4", 35, 8, "A"), W("a5", 31, 2, "A"), W("a6", 35, -4, "A"), W("a7", 30, -10, "A"), W("a8", 26, -16, "A"), W("a9", 32, -18, "A"), W("A0", 31, -24, "A", 0, "plantA"), W("A1", 26, -28, "A", 0, "plantA"), W("A2", 33, -31, "A"), W("A3", 28, -34, "A"), W("A4", 24.6, -22, "A"), W("b0", -36, 32, "B"), W("b1", -31, 28, "B"), W("b2", -35, 24, "B"), W("b3", -30, 18, "B"), W("b4", -36, 12, "B"), W("b5", -31, 6, "B"), W("b6", -36, 0, "B"), W("b7", -30, -6, "B"), W("b8", -35, -12, "B"), W("b9", -31, -18, "B"), W("b10", -28, -24, "B"), W("b11", -18, -28, "B"), W("B0", -26, 24, "B", 0, "plantB"), W("B1", -30, 20, "B", 0, "plantB"), W("B2", -32, 28, "B"), W("B3", -27, 30, "B"), W("B4", -22.6, 16, "B"), W("k0", 12, 10, "cross"), W("k1", 16, 2, "cross"), W("k2", 14, -8, "cross"), W("k3", 14, -18, "cross"), W("k4", 18, -22, "cross"), W("k5", -12, 10, "cross"), W("k6", -16, 4, "cross"), W("k7", -14, -4, "cross"), W("k8", -16, -14, "cross"), W("k9", -20, -24, "cross"), W("k10", 20, 30, "cross"), W("k11", 20, 38, "cross"), W("k12", -18, 38, "cross"), W("k13", -20, 32, "cross"), W("k14", 14, -34, "cross"), W("k15", -14, -34, "cross"), W("h0", 32, -12, "high", 3.3), W("h1", 34, 2, "high", 3.3), W("h2", 32, 10, "high", 3.3), W("h3", -32, -2, "high", 3.3), W("h4", -34, 8, "high", 3.3), W("h5", -32, 16, "high", 3.3) ];
function buildEdges() {
 const edges = new Map;
 const link = (a, b) => {
  if (!edges.has(a)) edges.set(a, []);
  if (!edges.has(b)) edges.set(b, []);
  edges.get(a).push(b);
  edges.get(b).push(a);
 };
 const chain = (...ids) => {
  for (let i = 0; i + 1 < ids.length; i++) link(ids[i], ids[i + 1]);
 };
 chain("s0", "s1", "s2");
 chain("s0", "m0", "m1", "m2", "m3", "m4", "m5", "x0");
 chain("x0", "x5", "x6", "n0", "n1", "n2", "n3", "n4", "n5", "c3", "c1", "c0");
 chain("n4", "n6", "c4", "c2", "c0");
 chain("x0", "x1", "x3", "k5", "k6", "k7", "k8", "k9", "b11");
 chain("x0", "x2", "x4", "k0", "k1", "k2", "k3", "k4", "a8");
 chain("k0", "m5");
 chain("k1", "x6");
 chain("s1", "k12", "k13", "b3");
 chain("s2", "k11", "k10", "a1");
 chain("c3", "k15", "b11");
 chain("c4", "k14", "a8");
 chain("a1", "a0", "a2", "a3", "a4", "a5", "a6", "a7", "a8");
 chain("a3", "k10");
 chain("a8", "a9", "A4", "A1", "A0", "A2", "A3");
 chain("A1", "A4");
 chain("A0", "k4");
 chain("a7", "k3");
 chain("b3", "b0", "b2", "b4", "b5", "b6", "b7", "b8", "b9", "b10", "b11");
 chain("b3", "b1");
 chain("b10", "B4", "B1", "B0", "B2", "B3");
 chain("B4", "k13");
 chain("b11", "k9");
 chain("h0", "h1", "h2");
 chain("h3", "h4", "h5");
 chain("h2", "a3");
 chain("h5", "b3");
 return edges;
}
export const NAV_EDGES = buildEdges();
export const COVER = [ { id: "cA1", x: 26.0, z: -22.6, face: 200, lane: "A" }, { id: "cA2", x: 34.6, z: -25.2, face: 160, lane: "A" }, { id: "cA3", x: 31.4, z: -33.6, face: 20, lane: "A" }, { id: "cB1", x: -27.6, z: 22.4, face: 160, lane: "B" }, { id: "cB2", x: -32.6, z: 30.4, face: 210, lane: "B" }, { id: "cB3", x: -21.0, z: 22.0, face: 110, lane: "B" }, { id: "cM1", x: -1.0, z: 28.6, face: 0, lane: "mid" }, { id: "cM2", x: 3.6, z: 22.4, face: 8, lane: "mid" }, { id: "cM3", x: -3.0, z: 5.4, face: 350, lane: "mid" }, { id: "cM4", x: -3.8, z: -17.6, face: 176, lane: "mid" }, { id: "cM5", x: 3.8, z: -30.4, face: 186, lane: "mid" }, { id: "cE1", x: 27.4, z: 12.4, face: 190, lane: "A" }, { id: "cE2", x: 36.2, z: 4.0, face: 176, lane: "A" }, { id: "cW1", x: -31.0, z: 0.0, face: 176, lane: "B" }, { id: "cW2", x: -36.6, z: -8.0, face: 190, lane: "B" } ];
export const SITE_PADS = [ { ...SITES.A, color: 0xffcf5c }, { ...SITES.B, color: 0xffcf5c } ];
export const MAP_BOUNDS = { x1: -40, x2: 40, z1: -48, z2: 48 };
export { SPAWNS };

import { SITES, SPAWNS} from "./config.js";
const S = (x1, z1, x2, z2, y1, kind = "wall", y0 = 0) => ({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), y0: y0, y1: y1, kind: kind});
const boxes = text => text.trim().split("\n").map(row => {
 const [x1, z1, x2, z2, y1, y0 = 0, kind = "wall"] = row.split(" ");
 return { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), y0: +y0, y1: +y1, kind: kind};});

const perimeter = boxes(`
-41 -49 41 -47 9 0 wall
-41 47 41 49 9 0 wall
-41 -49 -39 49 9 0 wall
39 -49 41 49 9 0 wall
`);
const spineWalls = boxes(`
-9 16 -7 44 6.5 0 wall
7 16 9 44 6.5 0 wall
-9 -26 -7 4 6.5 0 wall
7 -26 9 4 6.5 0 wall
`);
const laneWalls = boxes(`
22 16 24 44 5.6 0 wall
22 -26 24 -8 5.6 0 wall
-24 16 -22 40 5.6 0 wall
-24 -30 -22 -8 5.6 0 wall
`);
const blocks = boxes(`
-22 -6 -9 16 8.2 0 block
9 -6 22 16 8.2 0 block
9 -36 22 -10 7.4 0 block
-22 -38 -9 -30 6.2 0 block
-38 -47 -24 -30 7.6 0 block
24 -47 38 -38 7.6 0 block
-38 34 -22 44 7 0 block
24 40 38 46 6.4 0 block
`);
const cover = boxes(`
-4.6 30 -2 32.6 0.95 0 crate
2.2 24 4.8 26.4 0.95 0 crate
-1.2 18.5 1.6 19.6 1.15 0 barrier
-6.6 8.4 -4.2 9.6 1.2 0 barrier
4.2 6 6.6 7.2 1.2 0 barrier
-1.4 0.6 1.4 2.4 0.95 0 crate
-5 -12 -2.4 -10.4 0.95 0 crate
2.6 -18 5.2 -16.2 0.95 0 crate
-1 -25 1.8 -23.8 1.15 0 barrier
26.4 28 29 30.6 0.95 0 crate
31 18 33.6 20.2 0.95 0 crate
34.6 10 37 11.2 1.2 0 barrier
26.6 2 29.2 4 0.95 0 crate
27 -22 29.6 -19.4 0.95 0 crate
33.4 -26 36 -23.4 0.95 0 crate
30 -33 32.6 -30.4 0.95 0 crate
25.4 -31 26.6 -27 1.3 0 barrier
-33 8 -30.4 10.6 0.95 0 crate
-36 0 -33.4 2.2 0.95 0 crate
-30 -8 -28.8 -4 1.2 0 barrier
-35.4 -16 -32.8 -14 0.95 0 crate
-33 22 -30.4 24.6 0.95 0 crate
-29 28 -26.4 30.6 0.95 0 crate
-36 30 -33.4 32.6 0.95 0 crate
-22.6 20 -21.4 24 1.25 0 barrier
-6.2 38 -3.6 40.2 0.95 0 crate
3.6 38 6.2 40.2 0.95 0 crate
-4.4 -34 -1.8 -32.4 0.95 0 crate
2 -36 4.6 -34.4 0.95 0 crate
`);
const pillars = boxes(`
-6.4 22.6 -5.4 23.6 6 0 pillar
5.4 13.4 6.4 14.4 6 0 pillar
-6.4 -8.6 -5.4 -7.6 6 0 pillar
5.4 -22.4 6.4 -21.4 6 0 pillar
25.4 22.4 26.6 23.6 6 0 pillar
25.4 -2.6 26.6 -1.4 6 0 pillar
35.4 -14.4 36.6 -13.2 6 0 pillar
-25.4 6.4 -24.2 7.6 6 0 pillar
-25.4 -18.4 -24.2 -17.2 6 0 pillar
-32.4 14.6 -31.2 15.8 6 0 pillar
12 -12.4 13.2 -11.2 8 0 pillar
-12 2 -10.8 3.2 8 0 pillar
`);
const catwalks = [ {
 id: "east",
 deck: { x1: 30, z1: -16, x2: 38, z2: 12, y: 3.3},
 rail: [ { x1: 30, z1: -16, x2: 30.3, z2: 12, h: 1.1}, { x1: 30, z1: -16, x2: 38, z2: -15.7, h: 1.1} ],
 stairs: { x1: 30.4, z1: 12.4, x2: 34.0, z2: 16.0, steps: 11, rise: 0.3, run: 0.32, dir: "z"},
 sign: "CATWALK 1"}, {
 id: "west",
 deck: { x1: -38, z1: -6, x2: -30, z2: 18, y: 3.3},
 rail: [ { x1: -30.3, z1: -6, x2: -30, z2: 18, h: 1.1}, { x1: -38, z1: 17.7, x2: -30, z2: 18, h: 1.1} ],
 stairs: { x1: -34.6, z1: 18.4, x2: -30.6, z2: 22.0, steps: 11, rise: 0.3, run: 0.32, dir: "z"},
 sign: "CATWALK 2"} ];
export const props = `pipe -8.6 16 -8.2 43 4.6 0.34
pipe 8.2 -25 8.6 3 4.9 0.3
pipe 23.4 17 23.8 43 3.4 0.26
tank 35.2 -18.4 1.5 3.4
tank -35.6 36.4 1.5 3.4
tank -14 -33.8 1.2 2.8
beacon A 22 -30
beacon B -24 26
sign -10.4 42.4 0.32 MID
sign 10.4 42.4 -0.32 A
sign 0 -37.2 3.141592653589793 MID`.trim().split("\n").map(row => {
 const [kind, a, b, c, d, e, f] = row.split(" ");
 if (kind === "beacon") return { kind: kind, site: a, x: +b, z: +c};
 if (kind === "sign") return { kind: kind, x: +a, z: +b, ry: +c, text: d};
 if (kind === "tank") return { kind: kind, x: +a, z: +b, r: +c, h: +d};
 return { kind: kind, x1: +a, z1: +b, x2: +c, z2: +d, y: +e, r: +(f ?? 0)};});
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
  CATWALK_SOLIDS.push(S(st.x1, z1, st.x2, z2, st.rise * (st.steps - i), "stair", 0));}}
export const ALL_SOLIDS = [ ...SOLIDS, ...CATWALK_SOLIDS ];
const LANES = { s: "spawn", m: "mid", c: "cross", a: "A", b: "B", h: "high"};
const rows = text => text.trim().split("\n").map(row => row.split(" "));
export const WAYPOINTS = rows(`
s0 0 44 s
s1 -6 42.5 s
s2 6 42.5 s
m0 0 36 m
m1 -4.6 33 m
m2 4.4 28 m
m3 0 24 m
m4 -3.4 20 m
m5 3.2 16 m
x0 0 11 m
x1 -8.4 10 m
x2 8.4 10 m
x3 -10.6 2 c
x4 10.6 2 c
x5 0 4 m
x6 0 -2 m
n0 0 -8 m
n1 -4.6 -12 m
n2 4.4 -19 m
n3 0 -24 m
n4 0 -30 m
n5 -8 -33 m
n6 8 -33 m
c0 0 -42 s
c1 -6 -40.5 s
c2 6 -40.5 s
c3 -11 -37.6 s
c4 11 -37.6 s
a0 36 30 a
a1 31 26 a
a2 36 20 a
a3 30 14 a
a4 35 8 a
a5 31 2 a
a6 35 -4 a
a7 30 -10 a
a8 26 -16 a
a9 32 -18 a
A0 31 -24 a  plantA
A1 26 -28 a  plantA
A2 33 -31 a
A3 28 -34 a
A4 24.6 -22 a
b0 -36 32 b
b1 -31 28 b
b2 -35 24 b
b3 -30 18 b
b4 -36 12 b
b5 -31 6 b
b6 -36 0 b
b7 -30 -6 b
b8 -35 -12 b
b9 -31 -18 b
b10 -28 -24 b
b11 -18 -28 b
B0 -26 24 b  plantB
B1 -30 20 b  plantB
B2 -32 28 b
B3 -27 30 b
B4 -22.6 16 b
k0 12 10 c
k1 16 2 c
k2 14 -8 c
k3 14 -18 c
k4 18 -22 c
k5 -12 10 c
k6 -16 4 c
k7 -14 -4 c
k8 -16 -14 c
k9 -20 -24 c
k10 20 30 c
k11 20 38 c
k12 -18 38 c
k13 -20 32 c
k14 14 -34 c
k15 -14 -34 c
h0 32 -12 h 3.3
h1 34 2 h 3.3
h2 32 10 h 3.3
h3 -32 -2 h 3.3
h4 -34 8 h 3.3
h5 -32 16 h 3.3
`).map(([ id, x, z, lane, y = 0, role = null ]) => ({ id: id, x: +x, z: +z, y: +y, lane: LANES[lane], role: role}));
function buildEdges() {
 const edges = new Map;
 const link = (a, b) => {
  if (!edges.has(a)) edges.set(a, []);
  if (!edges.has(b)) edges.set(b, []);
  edges.get(a).push(b);
  edges.get(b).push(a);};
 const chain = (...ids) => {
  for (let i = 0; i + 1 < ids.length; i++) link(ids[i], ids[i + 1]);};
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
 return edges;}
export const NAV_EDGES = buildEdges();
export const COVER = rows(`
cA1 26 -22.6 200 a
cA2 34.6 -25.2 160 a
cA3 31.4 -33.6 20 a
cB1 -27.6 22.4 160 b
cB2 -32.6 30.4 210 b
cB3 -21 22 110 b
cM1 -1 28.6 0 m
cM2 3.6 22.4 8 m
cM3 -3 5.4 350 m
cM4 -3.8 -17.6 176 m
cM5 3.8 -30.4 186 m
cE1 27.4 12.4 190 a
cE2 36.2 4 176 a
cW1 -31 0 176 b
cW2 -36.6 -8 190 b
`).map(([ id, x, z, face, lane ]) => ({ id: id, x: +x, z: +z, face: +face, lane: LANES[lane]}));
export const SITE_PADS = [ { ...SITES.A, color: 0xffcf5c}, { ...SITES.B, color: 0xffcf5c} ];
export const MAP_BOUNDS = { x1: -40, x2: 40, z1: -48, z2: 48};
export { SPAWNS};

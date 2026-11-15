export function createRng(seed) {
let a = seed >>> 0 || 1;
const next = () => {
a = a + 0x6d2b79f5 >>> 0;
let t = a;
t = Math.imul(t ^ t >>> 15, t | 1);
t ^= t + Math.imul(t ^ t >>> 7, t | 61);
return ((t ^ t >>> 14) >>> 0) / 4294967296;};
return {
next: next,
range: (lo, hi) => lo + next() * (hi - lo),
int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
pick: list => list[Math.floor(next() * list.length) % list.length],
cone: angle => {
const r = Math.sqrt(next()) * angle;
const theta = next() * Math.PI * 2;
return [ Math.sin(theta) * r, Math.cos(theta) * r ];},
sign: () => next() < 0.5 ? -1 : 1};}
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

import {CanvasTexture,RepeatWrapping,SRGBColorSpace,NoColorSpace} from "three";
const cache = new Map();
const rngOf = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
function textureOf(key, size, paint, srgb) {
 const id = key + ":" + size;
 if (cache.has(id)) return cache.get(id);
 const canvas = document.createElement("canvas");
 canvas.width = canvas.height = size;
 paint(canvas.getContext("2d"), size);
 const result = new CanvasTexture(canvas);
 result.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
 result.wrapS = result.wrapT = RepeatWrapping;
 result.anisotropy = 8;
 cache.set(id, result);
 return result;}
const line = (ctx, x, y, x2, y2) => {
 ctx.beginPath();
 ctx.moveTo(x, y);
 ctx.lineTo(x2, y2);
 ctx.stroke();};
const blob = (ctx, size, random, count, radius, style) => {
 ctx.fillStyle = style;
 for (let i = 0; i < count; i++) {
  ctx.beginPath();
  ctx.arc(random() * size, random() * size, radius * (0.4 + random()), 0, Math.PI * 2);
  ctx.fill();}};
const stripes = (ctx, size) => {
 for (let x = -size; x < size * 2; x += 64) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + 32, 0);
  ctx.lineTo(x + 32 + size, size);
  ctx.lineTo(x + size, size);
  ctx.closePath();
  ctx.fill();}};
const rivets = (ctx, size, radius) => {
 for (let p = 24; p < size; p += 64)
  for (const [x, y] of [[p, 20], [p, size - 20], [20, p], [size - 20, p]]) {
   ctx.beginPath();
   ctx.arc(x, y, radius, 0, Math.PI * 2);
   ctx.fill();}};
function albedo(kind, ctx, size, random) {
 if (kind === "hazard") {
  ctx.fillStyle = "#232a30";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#f0b93c";
  stripes(ctx, size);
  ctx.globalAlpha = 0.3;
  blob(ctx, size, random, 60, 6, "#2b3138");
  ctx.globalAlpha = 1;
  return;}
 ctx.fillStyle = kind === "concrete" ? "#a6aeb5" : kind === "deck" ? "#8f989f" : "#8b959c";
 ctx.fillRect(0, 0, size, size);
 for (let i = 0; i < 1200; i++) {
  const value = Math.floor(78 + random() * 104);
  ctx.fillStyle = `rgba(${value},${value + 3},${value + 6},0.17)`;
  ctx.fillRect(random() * size, random() * size, kind === "steel" ? 1 : 3, kind === "steel" ? 40 : 2);}
 if (kind === "steel") {
  ctx.strokeStyle = "rgba(214,224,231,0.5)";
  ctx.lineWidth = 2;
  for (let y = 6; y < size; y += 13) line(ctx, 0, y + random() * 3, size, y + random() * 3);
  blob(ctx, size, random, 14, 12, "rgba(150,88,52,0.26)");
  ctx.fillStyle = "#c9d5dc";
  rivets(ctx, size, 4);}
 if (kind === "deck" || kind === "concrete") {
  ctx.strokeStyle = kind === "deck" ? "#5c666e" : "#525d65";
  ctx.lineWidth = 3;
  if (kind === "concrete") ctx.strokeRect(2, 2, size - 4, size - 4);
  for (let p = 0; p <= size; p += kind === "deck" ? 64 : size / 2) {
   line(ctx, p, 0, p, size);
   line(ctx, 0, p, size, p);}
  ctx.strokeStyle = "rgba(228,236,241,0.45)";
  ctx.lineWidth = 1;
  for (let p = 3; p <= size; p += kind === "deck" ? 64 : size / 2) {
   line(ctx, p, 0, p, size);
   line(ctx, 0, p, size, p);}}
 if (kind === "concrete") {
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 14; i++) {
   ctx.fillStyle = random() < 0.5 ? "#78838b" : "#c3cbd0";
   ctx.fillRect(random() * size, random() * size, 40 + random() * 150, 26 + random() * 110);}
  ctx.globalAlpha = 0.2;
  blob(ctx, size, random, 22, 18, "#3d464c");
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(120,133,142,0.55)";
  ctx.font = "bold 58px monospace";}}
function height(kind, ctx, size, random) {
 ctx.fillStyle = "#808080";
 ctx.fillRect(0, 0, size, size);
 for (let i = 0; i < 700; i++) {
  const value = Math.floor(96 + random() * 96);
  ctx.fillStyle = `rgb(${value},${value},${value})`;
  ctx.fillRect(random() * size, random() * size, 3, 3);}
 ctx.strokeStyle = "#404040";
 ctx.lineWidth = 4;
 if (kind === "concrete") {
  ctx.strokeRect(2, 2, size - 4, size - 4);
  line(ctx, size / 2, 0, size / 2, size);
  line(ctx, 0, size / 2, size, size / 2);}
 if (kind === "deck") for (let p = 0; p <= size; p += 64) {
  line(ctx, p, 0, p, size);
  line(ctx, 0, p, size, p);}
 if (kind === "steel") {
  ctx.fillStyle = "#d0d0d0";
  rivets(ctx, size, 5);}}
function normalFromHeight(kind, size) {
 const field = document.createElement("canvas");
 field.width = field.height = size;
 const fieldCtx = field.getContext("2d");
 height(kind, fieldCtx, size, rngOf(size + 31));
 const data = fieldCtx.getImageData(0, 0, size, size).data;
 const mask = size - 1;
 const at = (x, y) => data[((y & mask) * size + (x & mask)) * 4] / 255;
 return (ctx) => {
  const out = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
   for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.6;
    const dy = (at(x, y + 1) - at(x, y - 1)) * 2.6;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    out.data[i] = (0.5 - dx / len * 0.5) * 255;
    out.data[i + 1] = (0.5 + dy / len * 0.5) * 255;
    out.data[i + 2] = (0.5 + 0.5 / len) * 255;
    out.data[i + 3] = 255;}
  ctx.putImageData(out, 0, 0);};}
const SEEDS = { concrete: 9173, steel: 4211, hazard: 811, deck: 5501};
export function surfaceMaps(kind) {
 const id = "maps:" + kind;
 if (cache.has(id)) return cache.get(id);
 const seed = SEEDS[kind] ?? 9173;
 const rough = kind === "steel" ? "#707070" : "#cfcfcf";
 const maps = {
  map: textureOf("a:" + kind, 512, (ctx, size) => albedo(kind, ctx, size, rngOf(seed)), true),
  normalMap: textureOf("n:" + kind, 256, normalFromHeight(kind, 256), false),
  roughnessMap: textureOf("r:" + kind, 192, (ctx, size) => {
   ctx.fillStyle = rough;
   ctx.fillRect(0, 0, size, size);
   const random = rngOf(seed + 7);
   for (let i = 0; i < 420; i++) {
    const value = Math.floor(120 + random() * 110);
    ctx.fillStyle = `rgb(${value},${value},${value})`;
    ctx.fillRect(random() * size, random() * size, 7, 7);}}, false)};
 cache.set(id, maps);
 return maps;}
export function stencilTexture(label = "R-9", tint = "#cfd8de") {
 return textureOf(`stencil:${label}:${tint}`, 256, (ctx) => {
  ctx.fillStyle = tint;
  ctx.textAlign = "center";
  ctx.font = "bold 74px sans-serif";
  ctx.fillText(label, 128, 132);
  ctx.strokeStyle = tint;
  ctx.lineWidth = 3;}, true);}
export function emitterTexture(hex = "#46d9c2", label = "RESONANCE") {
 return textureOf(`emitter:${hex}:${label}`, 512, (ctx) => {
  ctx.fillStyle = "#08181e";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = hex;
  ctx.lineWidth = 3;
  for (let radius = 76; radius < 250; radius += 42) {
   ctx.beginPath();
   ctx.arc(256, 256, radius, 0, Math.PI * 2);
   ctx.stroke();}
  ctx.globalAlpha = 0.35;
  line(ctx, 24, 256, 488, 256);
  line(ctx, 256, 24, 256, 488);
  ctx.globalAlpha = 1;
  ctx.fillStyle = hex;
  ctx.textAlign = "center";
  ctx.font = "bold 62px monospace";
  ctx.fillText(label, 256, 272);
  ctx.font = "bold 22px monospace";
  ctx.fillText("PLANT ZONE", 256, 312);}, true);}
export function panelGlowTexture() {
 return textureOf("glow", 128, (ctx) => {
  ctx.fillStyle = "#1b616a";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#59bcbf";
  for (let y = 8; y < 128; y += 9) line(ctx, 6, y, 122, y);}, true);}
export function makeSign(label, tint = "#f4e2c6", accent = "#3a2517") {
 return textureOf(`sign:${label}:${tint}`, 256, (ctx) => {
  ctx.fillStyle = tint; ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.strokeRect(3, 3, 250, 58);
  ctx.fillStyle = accent; ctx.font = "bold 34px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, 128, 34);
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % 256, (i * 53) % 64, 5, 2);
  ctx.globalAlpha = 1;}, true);}

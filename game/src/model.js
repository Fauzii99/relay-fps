import {Group,Mesh,MeshStandardMaterial,BoxGeometry,SphereGeometry,CylinderGeometry,ConeGeometry,Color,MeshBasicMaterial,TorusGeometry,CircleGeometry,PointLight,Matrix4,Vector3} from "three";
import { PALETTE} from "./config.js";
const BOX = new BoxGeometry(1, 1, 1);
new Matrix4;
function matFor(team, role) {
const accent = team === "warden" ? PALETTE.warden : PALETTE.cinder;
const deep = team === "warden" ? PALETTE.wardenDeep : PALETTE.cinderDeep;
const plateHex = team === "warden" ? (role === "heavy" ? 0x424e55 : 0x4b5860) : (role === "heavy" ? 0x3b3532 : 0x463d38);
const clothHex = team === "warden" ? 0x252d33 : 0x2a231f;
return {
accent: new MeshStandardMaterial({color: accent,emissive: new Color(accent),emissiveIntensity: 0.85,roughness: 0.36,metalness: 0.18}),
deep: new MeshStandardMaterial({color: deep,roughness: 0.55,metalness: 0.3}),
plate: new MeshStandardMaterial({color: plateHex,roughness: 0.6,metalness: 0.36}),
cloth: new MeshStandardMaterial({color: clothHex,roughness: 0.94,metalness: 0.03}),
visor: new MeshStandardMaterial({color: 0x070d10,emissive: new Color(accent),emissiveIntensity: 1.85,roughness: 0.14,metalness: 0.72}),
metal: new MeshStandardMaterial({color:0x2c343a,roughness:0.4,metalness:0.82})};}
function boxPart(material, w, h, d, x, y, z, parent) {
const mesh = new Mesh(BOX, material); mesh.scale.set(w, h, d);
mesh.position.set(x, y, z); mesh.castShadow = true;
mesh.receiveShadow = true; parent.add(mesh);
return mesh;}
function heldRifle(mats) {
const gun = new Group; boxPart(mats.metal, 0.062, 0.085, 0.52, 0, 0, -0.16, gun);
boxPart(mats.deep, 0.05, 0.05, 0.3, 0, 0.022, 0.2, gun);
boxPart(mats.metal, 0.03, 0.03, 0.34, 0, -0.008, -0.52, gun);
boxPart(mats.accent, 0.036, 0.05, 0.13, 0, 0.07, -0.06, gun);
boxPart(mats.deep, 0.04, 0.13, 0.07, 0, -0.1, -0.06, gun);
boxPart(mats.metal, 0.032, 0.09, 0.05, 0, -0.075, 0.06, gun); return gun;}
export class FighterModel {
constructor(team, role = "line") {
this.team = team; this.mats = matFor(team, role);
this.root = new Group; this.body = new Group;
this.root.add(this.body); const m = this.mats;
this.legs = [];
for (const side of [ -1, 1 ]) {
const hip = new Group; hip.position.set(side * 0.13, 0.86, 0);
this.body.add(hip); boxPart(m.cloth, 0.17, 0.42, 0.17, 0, -0.21, 0, hip);
const knee = new Group; knee.position.set(0, -0.42, 0);
hip.add(knee); boxPart(m.plate, 0.155, 0.38, 0.155, 0, -0.19, 0, knee);
boxPart(m.deep, 0.17, 0.09, 0.27, 0, -0.4, 0.04, knee);
this.legs.push({hip: hip,knee: knee,side: side});}
boxPart(m.plate, 0.36, 0.24, 0.26, 0, 0.95, 0, this.body);
boxPart(m.accent, 0.09, 0.16, 0.06, 0.15, 0.94, 0.14, this.body); this.chest = new Group;
this.chest.position.set(0, 1.06, 0); this.body.add(this.chest);
boxPart(m.plate, 0.44, 0.42, 0.29, 0, 0.2, 0, this.chest);
boxPart(m.cloth, 0.3, 0.16, 0.24, 0, -0.02, 0, this.chest);
boxPart(m.deep, 0.16, 0.1, 0.06, 0, 0.33, -0.15, this.chest);
boxPart(m.accent, 0.05, 0.26, 0.05, -0.225, 0.2, 0.06, this.chest);
boxPart(m.accent, 0.05, 0.26, 0.05, 0.225, 0.2, 0.06, this.chest); this.arms = [];
for (const side of [ -1, 1 ]) {
const shoulder = new Group; shoulder.position.set(side * 0.245, 0.42, 0);
this.chest.add(shoulder); const pad = new Mesh(new SphereGeometry(0.105, 10, 8), m.plate);
pad.scale.set(1.0, 0.82, 1.0); pad.castShadow = true;
shoulder.add(pad); boxPart(m.deep, 0.12, 0.3, 0.13, 0, -0.18, 0, shoulder);
const elbow = new Group; elbow.position.set(0, -0.34, 0);
shoulder.add(elbow); boxPart(m.plate, 0.105, 0.3, 0.115, 0, -0.15, 0, elbow);
boxPart(m.metal, 0.1, 0.1, 0.12, 0, -0.31, 0, elbow);
this.arms.push({shoulder: shoulder,elbow: elbow,side: side});}
this.head = new Group; this.head.position.set(0, 0.52, 0);
this.chest.add(this.head); const dome = new Mesh(new SphereGeometry(0.175, 14, 11), m.plate);
dome.scale.set(1.0, 1.05, 1.06); dome.castShadow = true;
this.head.add(dome);
const visor = new Mesh(new SphereGeometry(0.163, 16, 10, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.34, Math.PI * 0.4), m.visor);
visor.position.set(0, 0.004, 0); this.head.add(visor);
boxPart(m.deep, 0.2, 0.05, 0.2, 0, -0.13, 0.02, this.head);
boxPart(m.accent, 0.025, 0.13, 0.025, 0.135, 0.16, -0.02, this.head);
boxPart(m.accent, 0.14, 0.022, 0.05, 0, 0.155, 0.06, this.head); this.gun = heldRifle(m);
this.gun.position.set(0.08, 0.08, -0.3); this.gun.rotation.set(0, 0, -0.1);
this.chest.add(this.gun);
const shadow = new Mesh(new CylinderGeometry(0.34, 0.34, 0.012, 14), new MeshBasicMaterial({color: 0x05090b,transparent: true,opacity: 0.34,depthWrite: false}));
shadow.position.y = 0.008; this.root.add(shadow);
this.phase = 0; this.aimBlend = 0;
this.crouchBlend = 0; this.recoilKick = 0;}
animate(dt, {speed: speed = 0,crouch: crouch = 0,aim: aim = 0,dead: dead = false,shotKick: shotKick = 0}) {
this.aimBlend += (aim - this.aimBlend) * Math.min(1, dt * 9);
this.crouchBlend += (crouch - this.crouchBlend) * Math.min(1, dt * 10);
this.recoilKick += (shotKick - this.recoilKick) * Math.min(1, dt * 14);
if (dead) {
this.body.rotation.x = Math.min(Math.PI * 0.46, this.body.rotation.x + dt * 3.4);
this.body.position.y = Math.max(-0.42, this.body.position.y - dt * 0.9);
for (const leg of this.legs) {
leg.hip.rotation.x += (0.5 - leg.hip.rotation.x) * Math.min(1, dt * 4);
leg.knee.rotation.x += (0.7 - leg.knee.rotation.x) * Math.min(1, dt * 4);}
for (const arm of this.arms) arm.shoulder.rotation.x += (0.9 - arm.shoulder.rotation.x) * Math.min(1, dt * 4);
return;}
const cycle = speed > 0.4 ? speed * 0.62 : 0; this.phase += dt * cycle * 2.2;
const swing = Math.sin(this.phase) * Math.min(1, speed / 7) * 0.72;
const counter = Math.cos(this.phase * 2) * Math.min(1, speed / 7) * 0.14;
const drop = this.crouchBlend * 0.42; this.body.position.y = -drop;
this.body.rotation.x = this.crouchBlend * 0.12;
for (const leg of this.legs) {
const s = leg.side; leg.hip.rotation.x = swing * s + this.crouchBlend * 0.5;
leg.knee.rotation.x = Math.max(0, -swing * s * 1.15) + this.crouchBlend * 0.95;}
const aimLift = this.aimBlend;
for (const arm of this.arms) {
const s = arm.side;
if (s > 0) {
arm.shoulder.rotation.x = 0.72 + aimLift * 0.62 + this.recoilKick * 0.16;
arm.shoulder.rotation.z = -0.16 - aimLift * 0.1; arm.elbow.rotation.x = 1.02 - aimLift * 0.28;} else {
arm.shoulder.rotation.x = 1.02 + aimLift * 0.5 + this.recoilKick * 0.12;
arm.shoulder.rotation.z = 0.34 + aimLift * 0.24; arm.elbow.rotation.x = 0.86 - aimLift * 0.2;}
arm.shoulder.rotation.y = 0.1 * -s;}
this.gun.position.set(0.08 - aimLift * 0.06, 0.08 + aimLift * 0.13 - this.recoilKick * 0.02, aimLift * 0.04 - 0.3);
this.gun.rotation.set(0.12 * -this.recoilKick, aimLift * 0.04, -0.1);
this.chest.rotation.x = 0.08 * -this.crouchBlend + counter * 0.02 + this.recoilKick * 0.05;
this.head.rotation.x = this.crouchBlend * 0.1 - aimLift * 0.04;}
muzzleFlash() {
if (this._flash === void 0) {
const cone = new Mesh(new ConeGeometry(0.09, 0.3, 7), new MeshBasicMaterial({color: 0xffd9a0,transparent: true,opacity: 0.9,depthWrite: false}));
cone.rotation.x = -Math.PI / 2; cone.position.set(0, 0.02, -0.72);
this.gun.add(cone); this._flash = cone;
this._flashT = 0;}
this._flashT = 0.055; this._flash.visible = true;}
updateFlash(dt) {
if (this._flash === void 0) return;
if (this._flashT > 0) {
this._flashT -= dt; this._flash.material.opacity = Math.max(0, this._flashT / 0.055) * 0.9;
this._flash.scale.setScalar(0.8 + 0.6 * (1 - this._flashT / 0.055));
if (this._flashT <= 0) this._flash.visible = false;}}
dispose() {
this.root.traverse(o => {
if (o.isMesh) o.geometry.dispose?.();}); for (const m of Object.values(this.mats)) m.dispose?.();}}

// A limb drawn between two points, so forearms meet the hands exactly.
const UP = new Vector3(0, 0, 1);
function limb(mat, w, a, b, parent) {
const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = d.length();
const mesh = new Mesh(new BoxGeometry(w, w * 1.15, len), mat);
mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
mesh.quaternion.setFromUnitVectors(UP, d.normalize()); parent.add(mesh); return mesh;}
function hand(mat, x, y, z, parent, sleeveMat) {
const g = new Group; g.position.set(x, y, z);
boxPart(mat, 0.1, 0.115, 0.145, 0, 0, 0, g);
boxPart(mat, 0.042, 0.055, 0.085, -0.062, 0.016, -0.05, g);
for (let i = 0; i < 3; i++) boxPart(mat, 0.026, 0.045, 0.062, 0.012 + i * 0.03, -0.036, -0.075, g);
limb(mat, 0.094, [ 0, 0, 0.06 ], [ 0.008, -0.03, 0.17 ], g);
limb(sleeveMat, 0.104, [ 0.008, -0.03, 0.17 ], [ 0.012, -0.13, 0.46 ], g);
parent.add(g);
return g;}
export class ViewModel {
constructor() {
this.root = new Group; this.sway = new Group;
this.root.add(this.sway); this.gun = new Group;
this.sway.add(this.gun);
const steel = new MeshStandardMaterial({color:0x535d64,roughness:0.42,metalness:0.72});
const dark = new MeshStandardMaterial({color:0x2a3237,roughness:0.5,metalness:0.6});
const poly = new MeshStandardMaterial({color:0x1f272c,roughness:0.86,metalness:0.08});
const teal = new MeshStandardMaterial({color: PALETTE.warden,emissive: new Color(PALETTE.warden),emissiveIntensity: 0.5,roughness: 0.35,metalness: 0.3});
const glove = new MeshStandardMaterial({color:0x8d7154,emissive:new Color(0x2a2118),emissiveIntensity:0.55,roughness:0.74,metalness:0.05});
const sleeve = new MeshStandardMaterial({color:0x4a5259,emissive:new Color(0x121719),emissiveIntensity:0.42,roughness:0.9,metalness:0.04});
const blade = new MeshStandardMaterial({color:0x8f9aa2,roughness:0.22,metalness:0.95});
this.mats = {steel: steel,dark: dark,poly: poly,teal: teal,glove: glove,sleeve: sleeve,blade: blade};
const m = this.mats;
this.weapons = {
rifle: new Group,sidearm: new Group,knife: new Group,util: new Group};
const B = (mat, w, h, d, x, y, z, p) => boxPart(mat, w, h, d, x, y, z, p);
const C = (mat, r, len, x, y, z, p, seg = 10) => {
const c = new Mesh(new CylinderGeometry(r, r, len, seg), mat); c.rotation.x = Math.PI / 2;
c.position.set(x, y, z); p.add(c); return c;};
const R = this.weapons.rifle;
B(steel, 0.075, 0.1, 0.46, 0, 0, -0.1, R); B(dark, 0.068, 0.075, 0.3, 0, 0.004, -0.44, R);
C(steel, 0.014, 0.28, 0, 0.006, -0.66, R); C(dark, 0.026, 0.08, 0, 0.006, -0.8, R, 8);
for (let i = 0; i < 7; i++) B(dark, 0.05, 0.012, 0.014, 0, 0.052, -0.34 - i * 0.052, R);
B(dark, 0.04, 0.05, 0.1, 0, 0.075, -0.16, R); C(dark, 0.045, 0.19, 0, 0.115, -0.18, R, 12);
const lens = new Mesh(new CircleGeometry(0.042, 14), new MeshBasicMaterial({color: 0x0d2f36}));
lens.position.set(0, 0.115, -0.272); lens.rotation.y = Math.PI; R.add(lens);
const ret = new Mesh(new CircleGeometry(0.011, 10), new MeshBasicMaterial({color: 0x8ff5e6}));
ret.position.set(0, 0.115, -0.274); R.add(ret);
const mag = B(poly, 0.05, 0.2, 0.09, 0, -0.14, -0.03, R);
B(poly, 0.045, 0.14, 0.06, 0, -0.1, 0.09, R); B(dark, 0.06, 0.09, 0.22, 0, 0.006, 0.22, R);
B(poly, 0.05, 0.07, 0.1, 0, 0.014, 0.34, R); B(teal, 0.02, 0.03, 0.05, 0.043, 0.03, -0.02, R);
B(steel, 0.012, 0.012, 0.05, -0.04, 0.06, -0.12, R);
const loop = new Mesh(new TorusGeometry(0.022, 0.005, 5, 10), dark); loop.position.set(0.03, -0.11, 0.2);
R.add(loop);
const P = this.weapons.sidearm;
B(dark, 0.048, 0.062, 0.24, 0, 0.012, -0.1, P); B(steel, 0.042, 0.05, 0.19, 0, 0.012, -0.22, P);
B(poly, 0.044, 0.15, 0.07, 0, -0.09, 0.03, P); const pmag = B(steel, 0.03, 0.11, 0.045, 0, -0.115, 0.035, P);
B(steel, 0.012, 0.012, 0.05, 0, 0.04, -0.18, P); B(dark, 0.03, 0.03, 0.05, 0, 0.012, -0.34, P);
B(teal, 0.014, 0.014, 0.014, 0, 0.045, 0.06, P);
const K = this.weapons.knife;
B(poly, 0.035, 0.05, 0.15, 0, 0, 0.03, K); B(steel, 0.012, 0.012, 0.05, 0, -0.03, -0.06, K);
const bl = B(blade, 0.016, 0.05, 0.3, 0, 0.012, -0.2, K);
bl.rotation.x = -0.1; const tip = new Mesh(new ConeGeometry(0.024, 0.09, 4), blade);
tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0.012, -0.37); K.add(tip);
B(teal, 0.008, 0.008, 0.03, 0.012, 0.012, 0.06, K);
const U = this.weapons.util;
B(dark, 0.09, 0.12, 0.09, 0, 0, -0.06, U); B(poly, 0.1, 0.02, 0.1, 0, 0.062, -0.06, U);
const pin = new Mesh(new TorusGeometry(0.016, 0.005, 5, 9), steel);
pin.position.set(0.045, 0.07, -0.06); pin.rotation.y = Math.PI / 2;
U.add(pin); B(teal, 0.055, 0.012, 0.055, 0, 0.052, -0.06, U);
this.handles = {rifle: [ 0.022, -0.105, 0.09, -0.098, -0.132, -0.3 ],sidearm: [ 0.022, -0.092, 0.05, -0.082, -0.1, -0.13 ],knife: [ 0.024, -0.008, 0.05 ],util: [ 0.0, -0.06, -0.02, 0.0, 0.02, -0.1 ]};
this.arms = new Group; this.gun.add(this.arms);
this.handR = hand(glove, 0, 0, 0, this.arms, sleeve);
this.handL = hand(glove, 0, 0, 0, this.arms, sleeve);
this.flash = new Group;
const cone = new Mesh(new ConeGeometry(0.055, 0.2, 8), new MeshBasicMaterial({color: 0xffe1a8,transparent: true,opacity: 0.92,blending: 2,depthWrite: false}));
cone.rotation.x = -Math.PI / 2; cone.position.z = -0.06;
this.flash.add(cone);
for (let i = 0; i < 2; i++) {
const flare = boxPart(new MeshBasicMaterial({color: 0xffc46b,transparent: true,opacity: 0.8,blending: 2,depthWrite: false}), 0.24, 0.02, 0.02, 0, 0, -0.03, this.flash);
flare.rotation.z = i * Math.PI * 0.5;}
this.flash.visible = false; this.gun.add(this.flash);
this.muzzles = {rifle: [ 0, 0.006, -0.86 ],sidearm: [ 0, 0.012, -0.37 ],knife: [ 0, 0.012, -0.4 ],util: [ 0, 0.02, -0.12 ]};
this.mags = {rifle: mag,sidearm: pmag};
this.mag0 = {rifle: -0.14,sidearm: -0.115};
for (const g of Object.values(this.weapons)) this.gun.add(g);
this.basePos = {x: 0.185,y: -0.175,z: -0.50};
this.adsPos = {x: 0.0,y: -0.085,z: -0.30};
this.root.position.set(0.185, -0.175, -0.50); this.muzzleLight = new PointLight(0xffc06a, 0, 6, 2);
this.root.scale.setScalar(0.82);
this.muzzleLight.position.set(0, 0, -0.9); this.gun.add(this.muzzleLight);
this.kick = 0; this.kickVel = 0;
this.flashT = 0; this.swayX = 0;
this.swayY = 0; this.ads = 0;
this.reloadT = 0; this.reloadDur = 1;
this.bobT = 0; this.weapon = "";
this.utilT = 0; this.setWeapon("rifle");}
setWeapon(key) {
const want = this.weapons[key] === void 0 ? "rifle" : key;
if (this.weapon === want) return false;
for (const k of Object.keys(this.weapons)) this.weapons[k].visible = k === want;
this.weapon = want; const h = this.handles[want];
this.handR.position.set(h[0], h[1], h[2]);
this.handL.visible = h.length > 3;
if (h.length > 3) this.handL.position.set(h[3], h[4], h[5]);
const mz = this.muzzles[want];
this.flash.position.set(mz[0], mz[1], mz[2]);
this.muzzleLight.position.set(mz[0], mz[1], mz[2] - 0.1);
return true;}
utilThrow() {
this.utilT = 0.55;}
fire(strength = 1) {
this.kickVel += 5.4 * strength; this.flashT = 0.055;
this.flash.visible = true; this.flash.rotation.z = (this.flash.rotation.z + 1.1) % (Math.PI * 2);
this.muzzleLight.intensity = 9 * strength;}
startReload(duration) {
this.reloadT = duration; this.reloadDur = duration;}
update(dt, {ads: ads = 0,speed: speed = 0,lookDX: lookDX = 0,lookDY: lookDY = 0,alive: alive = true,lowered: lowered = 0}) {
this.ads += (ads - this.ads) * Math.min(1, dt * 13); this.kickVel += 210 * -this.kick * dt;
this.kickVel *= Math.exp(12 * -dt); this.kick += this.kickVel * dt;
if (this.kick < -0.02) {
this.kick = -0.02; this.kickVel = 0;}
this.swayX += (0.00085 * -lookDX - this.swayX) * Math.min(1, dt * 8);
this.swayY += (0.00085 * -lookDY - this.swayY) * Math.min(1, dt * 8);
this.swayX = Math.max(-0.05, Math.min(0.05, this.swayX));
this.swayY = Math.max(-0.05, Math.min(0.05, this.swayY)); this.bobT += dt * (2.4 + speed * 0.55);
const bobAmt = Math.min(1, speed / 8) * (1 - this.ads * 0.78);
const bobX = Math.cos(this.bobT * 2.1) * 0.011 * bobAmt;
const bobY = Math.abs(Math.sin(this.bobT * 2.1)) * 0.013 * bobAmt;
const target = {
x: this.basePos.x + (this.adsPos.x - this.basePos.x) * this.ads,
y: this.basePos.y + (this.adsPos.y - this.basePos.y) * this.ads,
z: this.basePos.z + (this.adsPos.z - this.basePos.z) * this.ads};
let reloadDip = 0; let reloadTilt = 0; let magOut = 0; let utilDip = 0;
if (this.reloadT > 0) {
this.reloadT = Math.max(0, this.reloadT - dt); const t = 1 - this.reloadT / this.reloadDur;
const curve = Math.sin(Math.PI * Math.min(1, t * 1.04));
reloadDip = curve * 0.11; reloadTilt = curve * 0.2;
magOut = t > 0.18 && t < 0.64 ? Math.sin((t - 0.18) / 0.46 * Math.PI) : 0;}
if (this.utilT > 0) {
this.utilT = Math.max(0, this.utilT - dt);
utilDip = Math.sin(Math.PI * Math.min(1, 1 - this.utilT / 0.55)) * 0.16;}
this.root.position.set(target.x + this.swayX + bobX, target.y + this.swayY + bobY - reloadDip - utilDip - lowered * 0.42, target.z + this.kick * 0.075);
this.gun.rotation.set(this.kick * 0.24 + this.swayY * 1.4 - reloadTilt, 1.6 * -this.swayX, lowered * 0.3 - reloadTilt * 0.15);
const mag = this.mags[this.weapon];
if (mag !== void 0) {
mag.position.y = this.mag0[this.weapon] - magOut * 0.16;
mag.visible = magOut < 0.96;}
const magHand = Math.min(1, magOut * 2.4);
this.handL.position.y = (this.handles[this.weapon][4] ?? -0.1) - magHand * 0.17;
this.arms.rotation.set(this.kick * 0.16 + this.swayY * 0.9, 1.2 * -this.swayX, 0);
this.flashT = Math.max(0, this.flashT - dt);
this.flash.visible = this.flashT > 0;
if (this.flashT > 0) this.flash.scale.setScalar(0.8 + 0.7 * (1 - this.flashT / 0.055));
this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 140);
if (!alive) this.root.position.y -= 0.5;}}

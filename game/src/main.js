import {Scene,PerspectiveCamera,WebGLRenderer,Vector3,PointLight,SphereGeometry,MeshBasicMaterial,Mesh,Sprite,SpriteMaterial,AdditiveBlending,BufferGeometry,BufferAttribute,LineSegments,LineBasicMaterial,CanvasTexture,PCFShadowMap,SRGBColorSpace,ACESFilmicToneMapping,Points,PointsMaterial} from "three";
import { TICK, MAX_STEPS, TEAM, WEAPONS, MOVE, MATCH, SITES, SHOTS, SHOT_SPOTS, DEMO, KEYS} from "./config.js";
import { Match} from "./sim.js";
import { World} from "./world.js";
import { FighterModel, ViewModel} from "./model.js";
import { AudioEngine} from "./audio.js";
import { MAP_BOUNDS} from "./map.js";
import { clamp, damp} from "./rng.js";
const params = new URLSearchParams(location.search);
const DEMO_MODE = params.get("demo") === "1";
const AUTOSTART = DEMO_MODE || params.get("autostart") === "1";
const SEED = Number(params.get("seed")) || DEMO.seed;
const SHOT = params.get("shot");
const SHOT_SPEC = SHOT !== null && Object.hasOwn(SHOTS, SHOT) ? { ...SHOTS[SHOT],simSeconds: Number(params.get("t") ?? SHOTS[SHOT].simSeconds)} : null;
const canvas = document.getElementById("view");
const renderer = new WebGLRenderer({canvas: canvas,antialias: true,powerPreference: "high-performance",stencil: false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
const gl = renderer.getContext();
const readPixel = new Uint8Array(4);
const readCentre = () => {
gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixel);
return [ readPixel[0], readPixel[1], readPixel[2], readPixel[3] ];};
const scene = new Scene;
const camera = new PerspectiveCamera(78, 16 / 9, 0.06, 320);
const lockPointer = () => {
if (DEMO_MODE || document.pointerLockElement === canvas) return;
try {
const asked = canvas.requestPointerLock?.();
if (asked && typeof asked.catch === "function") asked.catch(() => showResumePrompt());} catch { showResumePrompt(); }
setTimeout(() => {
if (document.pointerLockElement !== canvas && running && !engine.buyOpen) showResumePrompt();}, 450);};
function showResumePrompt() {
if (DEMO_MODE) return;
hud.resumeHint.hidden = false; engine.awaitingLock = true;}
function hideResumePrompt() {
hud.resumeHint.hidden = true; engine.awaitingLock = false;}
const engine = {
match: null,
accumulator: 0,
lastTime: 0,
paused: false,
demoTime: 0,
shotFrozen: false,
frames: 0,
lookDX: 0,
lookDY: 0,
shakeT: 0,
wasPhase: "buy",
buyOpen: false};
let running = false;
const match = () => engine.match;
const newMatch = () => new Match({seed: SEED,demo: DEMO_MODE});
engine.match = newMatch();
seedDemoState(engine.match);
const $ = id => document.getElementById(id);
const hud = {
phase:$("phase-label"), clock:$("clock"), objective:$("objective-state"), ammoMag:$("ammo-mag"),
ammoReserve:$("ammo-reserve"), weaponName:$("weapon-name"), money:$("money"), hpBar:$("hp-bar"),
hpNum:$("hp-num"), armorBar:$("armor-bar"), armorNum:$("armor-num"), slotSmoke:$("slot-smoke"),
slotFrag:$("slot-frag"), crosshair:$("crosshair"), chT:$("ch-t"), chB:$("ch-b"),
chL:$("ch-l"), chR:$("ch-r"), hitMarker:$("hit-marker"), damageArc:$("damage-arc"),
killBanner:$("kill-banner"), killfeed:$("killfeed"), radio:$("radio"), toast:$("center-toast"),
buyMenu:$("buy-menu"), buyMoney:$("buy-money"), buyTimer:$("buy-timer"), buyHint:$("buy-hint"),
minimap:$("minimap"), startScreen:$("start-screen"), pauseScreen:$("pause-screen"), matchEnd:$("match-end"),
matchEndTitle:$("match-end-title"), matchEndLine:$("match-end-line"), startBtn:$("start-btn"), resumeBtn:$("resume-btn"),
restartBtn:$("restart-btn"), againBtn:$("again-btn"), resumeHint:$("resume-hint"),
pipsW:$("pips-warden"), pipsC:$("pips-cinder"), location:$("loc"), cashNum:$("cash-num"),
scoreboard:$("scoreboard"), sbBody:$("sb-body"), sbClock:$("sb-clock"), sbTitle:$("sb-title")};
const pipsOf = (el, won, total) => { let h = ""; for (let i = 0; i < total; i++) h += `<i class="${i < won ? "on" : ""}"></i>`; el.innerHTML = h; };

const world = new World(scene);
const viewModel = new ViewModel;
camera.add(viewModel.root);
scene.add(camera);
const viewLight = new PointLight(0xdfefff, 2.6, 5, 2);
viewLight.position.set(0.3, 0.42, 0.3);
camera.add(viewLight);
const audio = new AudioEngine, bodies = new Map;
const addBody = f => {
const model = new FighterModel(f.team, f.role); scene.add(model.root);
bodies.set(f.id, model);};
for (const f of match().fighters) if (!f.isPlayer) addBody(f);
const TRACER_MAX = 24;
const tracerGeo = new BufferGeometry;
tracerGeo.setAttribute("position", new BufferAttribute(new Float32Array(TRACER_MAX * 6), 3));
tracerGeo.setAttribute("color", new BufferAttribute(new Float32Array(TRACER_MAX * 6), 3));
const tracerPos = tracerGeo.getAttribute("position");
const tracerCol = tracerGeo.getAttribute("color");
const tracerLines = new LineSegments(tracerGeo, new LineBasicMaterial({vertexColors: true,transparent: true,opacity: 0.92,depthWrite: false}));
tracerLines.frustumCulled = false;
scene.add(tracerLines);
const IMPACT_MAX = 28;
const impactGeo = new SphereGeometry(0.05, 6, 4);
const impactPool = [];
for (let i = 0; i < IMPACT_MAX; i++) {
const m = new Mesh(impactGeo, new MeshBasicMaterial({color: 0xffd7a0,transparent: true,opacity: 0.9,depthWrite: false}));
m.visible = false; scene.add(m);
impactPool.push(m);}
const SPARK_MAX = 96;
const sparkPos = new Float32Array(SPARK_MAX * 3);
const sparkGeo = new BufferGeometry;
sparkGeo.setAttribute("position", new BufferAttribute(sparkPos, 3));
const sparkDots = new Points(sparkGeo, new PointsMaterial({size: 0.075,color: 0xffcc8c,transparent: true,opacity: 0.95,blending: AdditiveBlending,depthWrite: false}));
sparkDots.frustumCulled = false;
scene.add(sparkDots);
const sparks = [];
function spawnSparks(x, y, z, nx, ny, nz, count = 8) {
for (let i = 0; i < count && sparks.length < SPARK_MAX; i++) {
const speed = 2.4 + Math.random() * 5.2;
sparks.push({x: x,y: y,z: z,vx: nx * speed + (Math.random() - 0.5) * 3.4,vy: ny * speed + Math.random() * 3.6,vz: nz * speed + (Math.random() - 0.5) * 3.4,life: 0.14 + Math.random() * 0.3});}}
const smokeTex = (() => {
const c = document.createElement("canvas"); c.width = 128;
c.height = 128; const g = c.getContext("2d");
const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62); grad.addColorStop(0, "rgba(216,226,230,0.96)");
grad.addColorStop(0.5, "rgba(178,190,196,0.66)"); grad.addColorStop(1, "rgba(150,162,168,0)");
g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
return new CanvasTexture(c);})();
const SMOKE_SPRITES = 36;
const smokePool = [];
for (let i = 0; i < SMOKE_SPRITES; i++) {
const sp = new Sprite(new SpriteMaterial({map: smokeTex,transparent: true,depthWrite: false,opacity: 0}));
sp.visible = false; scene.add(sp);
smokePool.push(sp);}
const blastSprite = new Sprite(new SpriteMaterial({color: 0xffca8a,transparent: true,opacity: 0,blending: AdditiveBlending,depthWrite: false}));
blastSprite.visible = false;
scene.add(blastSprite);
const flashTex = (() => {
const c = document.createElement("canvas"); c.width = 64;
c.height = 64; const g = c.getContext("2d");
const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
grad.addColorStop(0, "rgba(255,246,214,1)"); grad.addColorStop(0.28, "rgba(255,206,128,0.86)");
grad.addColorStop(0.6, "rgba(255,150,60,0.34)"); grad.addColorStop(1, "rgba(255,120,30,0)");
g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
return new CanvasTexture(c);})();
const muzzleSprite = new Sprite(new SpriteMaterial({map: flashTex,color: 0xffe0ac,transparent: true,opacity: 0,blending: AdditiveBlending,depthWrite: false,depthTest: false}));
muzzleSprite.visible = false;
muzzleSprite.scale.set(0.045, 0.045, 1);
camera.add(muzzleSprite);
muzzleSprite.position.set(0.155, -0.118, -1.02);
const keys = new Set;
const input = {
forward: false,
back: false,
left: false,
right: false,
jump: false,
crouch: false,
walk: false,
fire: false,
fireHeld: false,
use: false,
mouseDX: 0,
mouseDY: 0,
sensitivity: 0.0022};
let mouseDown = false, pendingReload = false;
const held = list => list.some(code => keys.has(code));
function readKeys() {
input.forward = held(KEYS.forward); input.back = held(KEYS.back);
input.left = held(KEYS.left); input.right = held(KEYS.right);
input.crouch = held(KEYS.crouch); input.walk = held(KEYS.walk);
input.use = held(KEYS.use);}
addEventListener("keydown", e => {
if (e.repeat) return; keys.add(e.code);
if (KEYS.pause.includes(e.code)) {
if (engine.buyOpen) closeBuy(); else togglePause();
return;}
if (KEYS.mute.includes(e.code)) {
audio.setMuted(!audio.muted); toast(audio.muted ? "SOUND OFF" : "SOUND ON");
return;}
if (KEYS.jump.includes(e.code) && running) input.jump = true;
if (KEYS.reload.includes(e.code) && running) pendingReload = true;
if (KEYS.buy.includes(e.code)) toggleBuy();
if (KEYS.slot1.includes(e.code)) selectSlot(1);
if (KEYS.slot2.includes(e.code)) selectSlot(2);
if (KEYS.slot3.includes(e.code)) selectSlot(3);
if (KEYS.smoke.includes(e.code)) throwUtil("smoke"); if (KEYS.frag.includes(e.code)) throwUtil("frag");
if (e.code === "Tab") { toggleScoreboard(); e.preventDefault(); return; }
if (e.code === "Space") e.preventDefault();}, {passive: false});
addEventListener("keyup", e => {
keys.delete(e.code); if (KEYS.jump.includes(e.code)) input.jump = false;});
addEventListener("mousedown", e => {
if (e.button !== 0) return;
if (!running) { start(); return; }
if (engine.awaitingLock || (!engine.buyOpen && document.pointerLockElement !== canvas)) { lockPointer(); return; }
mouseDown = true;});
addEventListener("mouseup", e => {
if (e.button === 0) mouseDown = false;});
addEventListener("mousemove", e => {
if (document.pointerLockElement !== canvas) return; input.mouseDX += e.movementX;
input.mouseDY += e.movementY;});
document.addEventListener("pointerlockchange", () => {
if (document.pointerLockElement === canvas) { hideResumePrompt(); return; }
if (running && !engine.paused && !DEMO_MODE && !engine.buyOpen) setPaused(true);});
addEventListener("contextmenu", e => e.preventDefault());
const feedNodes = [];
const radioNodes = [];
function toast(text, ms = 1500) {
set("toast",text); hud.toast.classList.add("on");
clearTimeout(toast.timer); toast.timer = setTimeout(() => hud.toast.classList.remove("on"), ms);}
function pushKillfeed(entry) {
const li = document.createElement("li"); if (entry.mine) li.classList.add("mine");
if (entry.head) li.classList.add("head"); const killer = document.createElement("span");
killer.textContent = entry.killer === null ? "STATION" : entry.killer;
killer.className = entry.killer === null ? "k-gun" : entry.killerTeam === TEAM.WARDEN ? "k-w" : "k-c";
const gun = document.createElement("span"); gun.className = "k-gun";
gun.textContent = entry.head ? ` ${entry.weapon} ✦ ` : ` ${entry.weapon} ▸ `;
const victim = document.createElement("span"); victim.textContent = entry.victim;
victim.className = entry.victimTeam === TEAM.WARDEN ? "k-w" : "k-c"; li.append(killer, gun, victim);
hud.killfeed.prepend(li); feedNodes.push(li);
while (feedNodes.length > 6) feedNodes.shift().remove();}
function pushRadio(text) {
const li = document.createElement("li"); li.textContent = text;
hud.radio.prepend(li); radioNodes.push(li);
while (radioNodes.length > 3) radioNodes.shift().remove();}
const fmt = s => {
const t = Math.max(0, Math.ceil(s));
return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;};
const setBar = (el, value, max) => {
el.style.width = `${clamp(value / max * 100, 0, 100)}%`;
el.classList.toggle("low", value / max <= 0.3);};
const buyButtons = [ ...document.querySelectorAll("#buy-menu .buy-item") ];
const DEFAULT_BUY_HINT = hud.buyHint.textContent;
function syncBuyButtons(p) {
for (const btn of buyButtons) {
const item = btn.dataset.item; const w = WEAPONS[item];
const cost = w !== void 0 ? w.cost : item === "kevlar" ? 650 : 300;
const owned = item === "kevlar" ? p.hasKevlar && p.armor > 0 : w !== void 0 ? p.weapon === item : false;
btn.classList.toggle("cant", p.money < cost); btn.classList.toggle("owned", owned);}}
const set=(k,v)=>hud[k].textContent=`${v}`;
const SB_HEAD = "  OPERATOR    K  A  D  HS%    DMG   CASH";
function drawScoreboard() {
const m = match();
set("sbTitle",m.phase === "roundEnd" ? `ROUND ${m.round} COMPLETE` : "SCOREBOARD");
set("sbClock",fmt(m.beacon.planted ? m.beacon.timer : Math.max(0, MATCH.roundTime - m.phaseT)));
const rows = m.fighters.slice().sort((a, b) => (a.team === b.team ? b.kills - a.kills : a.team === TEAM.WARDEN ? -1 : 1));
set("sbBody",SB_HEAD + "\n" + rows.map(f =>
(f.isPlayer ? "> " : "  ") + f.name.padEnd(9) + [f.kills, f.assists ?? 0, f.deaths].map(n => `${n}`.padStart(3)).join("") +
String((f.kills > 0 ? Math.round((f.headshots ?? 0) / f.kills * 100) : 0) + "%").padStart(5) +
String(Math.round(f.damageDealt ?? 0)).padStart(7) + `${f.money}`.padStart(7)).join("\n"));}
function toggleScoreboard() {
if (!running) return;
const show = hud.scoreboard.hidden; hud.scoreboard.hidden = !show;
if (show) drawScoreboard();}
function drawHud() {
const m = match(); const p = m.player; const rounds = MATCH.roundsToWin;
if (!running && !DEMO_MODE) {
pipsOf(hud.pipsW, 0, rounds); pipsOf(hud.pipsC, 0, rounds);
set("phase","STANDBY"); set("clock","0:00");
set("objective","AWAITING DEPLOY"); set("location","SPAWN");
return;}
pipsOf(hud.pipsW, m.score.warden, rounds); pipsOf(hud.pipsC, m.score.cinder, rounds);
set("location",m.nearestSite(p.pos.x, p.pos.z, SITES.A.radius + 5)?.site.label ?? (p.pos.z > 12 ? "SPAWN" : "MID"));
if (m.phase === "buy") {
set("phase","BUY PHASE"); set("clock",fmt(Math.max(0, MATCH.buyPhase - m.phaseT)));
hud.clock.classList.toggle("urgent", MATCH.buyPhase - m.phaseT < 5);} else if (m.phase === "live") {
set("phase",m.beacon.planted ? "BEACON ARMED" : "ROUND LIVE");
const left = m.beacon.planted ? m.beacon.timer : Math.max(0, MATCH.roundTime - m.phaseT);
set("clock",fmt(left)); hud.clock.classList.toggle("urgent", left < 10);} else {
set("phase","ROUND OVER"); set("clock",fmt(Math.max(0, MATCH.endPause - m.phaseT)));
hud.clock.classList.remove("urgent");}
const attacking = p.team === m.attackingTeam; let objective;
const planter = m.beacon.planting && m.beacon.carrier !== null ? m.byId(m.beacon.carrier) : null;
const carrier = planter !== null ? planter.plantProgress / MATCH.plantTime : 0;
if (m.beacon.planting && planter !== null) objective = `${planter.isPlayer ? "ARMING" : "BEACON ARMING"} CHARGE ${Math.round(carrier * 100)}%`;
else if (m.beacon.planted) objective = m.beacon.defusing ? `DEFUSING ${m.beacon.defuseT.toFixed(1)}s` : `BEACON ${m.beacon.site} ARMED ${fmt(m.beacon.timer)}`; else if (attacking) objective = m.beacon.carrier === p.id ? "CARRY BEACON TO A / B" : "ESCORT THE CARRIER"; else objective = "DEFEND A / B";
set("objective",objective); hud.objective.classList.toggle("armed", m.beacon.planted || m.beacon.planting);
setBar(hud.hpBar, p.health, MOVE.maxHealth); setBar(hud.armorBar, p.armor, 100);
set("hpNum",String(Math.round(p.health)));
set("armorNum",String(Math.round(p.armor))); const w = WEAPONS[p.weapon];
set("weaponName",w.name);
const mag = p.ammo[p.weapon] ?? 0; set("ammoMag",`${mag}`);
set("ammoReserve",String(p.reserve[p.weapon] ?? 0));
hud.ammoMag.classList.toggle("low", mag <= Math.ceil(w.mag * 0.2)); set("money",`${p.money}`);
set("cashNum",`${p.money}`);
const want = p.weapon === "knife" ? 3 : p.weapon === "sidearm" ? 2 : 1;
for (const pill of document.querySelectorAll("#sp .pill")) pill.classList.toggle("on", +pill.dataset.slot === want);
hud.slotSmoke.className = "slot" + (p.smoke > 0 ? " ready" : " empty");
hud.slotSmoke.innerHTML = `SMOKE <b>${p.smoke}</b>`;
hud.slotFrag.className = "slot" + (p.frag > 0 ? " ready" : " empty");
hud.slotFrag.innerHTML = `FRAG <b>${p.frag}</b>`;
const gap = clamp(m.currentSpread(p) * 980, 3.5, 30); hud.chT.setAttribute("y1", String(0.3 * -gap));
hud.chT.setAttribute("y2", String(-gap)); hud.chB.setAttribute("y1", String(gap * 0.3));
hud.chB.setAttribute("y2", `${gap}`); hud.chL.setAttribute("x1", String(0.3 * -gap));
hud.chL.setAttribute("x2", String(-gap)); hud.chR.setAttribute("x1", String(gap * 0.3));
hud.chR.setAttribute("x2", `${gap}`); hud.crosshair.classList.toggle("firing", p.recoilPitch > 0.012);
if (m.phase === "buy") {
set("buyMoney",`${p.money}`);
set("buyTimer",fmt(Math.max(0, MATCH.buyPhase - m.phaseT)));
syncBuyButtons(p);}}
const mmBase = document.createElement("canvas");
mmBase.width = 196;
mmBase.height = 196;
const mmCtx = hud.minimap.getContext("2d");
const mmX = x => (x - MAP_BOUNDS.x1) / (MAP_BOUNDS.x2 - MAP_BOUNDS.x1) * 176 + 10;
const mmZ = z => (z - MAP_BOUNDS.z1) / (MAP_BOUNDS.z2 - MAP_BOUNDS.z1) * 176 + 10;
(() => {
const g = mmBase.getContext("2d"); g.fillStyle = "rgba(6,11,14,0.92)";
g.fillRect(0, 0, 196, 196); g.strokeStyle = "rgba(126,158,172,0.3)";
g.lineWidth = 1;
for (let i = 0; i <= 8; i++) {
const t = 10 + i * 22;
g.beginPath(); g.moveTo(10, t); g.lineTo(186, t); g.stroke();
g.beginPath(); g.moveTo(t, 10); g.lineTo(t, 186); g.stroke();}
g.strokeStyle = "rgba(126,158,172,0.55)"; g.lineWidth = 1.4;
g.strokeRect(10, 10, 176, 176);
for (const key of [ "A", "B" ]) {
const site = SITES[key]; const x = mmX(site.center[0]);
const y = mmZ(site.center[2]); const r = site.radius / (MAP_BOUNDS.x2 - MAP_BOUNDS.x1) * 176;
g.fillStyle = "rgba(255,207,92,0.15)"; g.strokeStyle = "rgba(255,207,92,0.78)";
g.lineWidth = 1.2; g.beginPath();
g.arc(x, y, r, 0, Math.PI * 2); g.fill();
g.stroke(); g.fillStyle = "#ffcf5c";
g.font = "700 11px system-ui, sans-serif"; g.textAlign = "center";
g.fillText(key, x, y + 4);}
g.strokeStyle = "rgba(70,217,194,0.22)"; g.lineWidth = 2;
g.beginPath(); g.moveTo(mmX(0), mmZ(44));
g.lineTo(mmX(0), mmZ(-42)); g.stroke();
g.beginPath(); g.moveTo(mmX(36), mmZ(26));
g.lineTo(mmX(31), mmZ(-10)); g.stroke();
g.beginPath(); g.moveTo(mmX(-34), mmZ(26));
g.lineTo(mmX(-31), mmZ(-12)); g.stroke();})();
function drawMinimap() {
const m = match(); const p = m.player;
mmCtx.clearRect(0, 0, 196, 196); mmCtx.drawImage(mmBase, 0, 0);
for (const f of m.fighters) {
if (!f.alive) continue; const mate = f.team === p.team;
if (!mate && !m.spotted.has(f.id)) continue; const x = mmX(f.pos.x);
const y = mmZ(f.pos.z);
if (f.isPlayer) {
mmCtx.fillStyle = "#ffffff"; mmCtx.beginPath();
mmCtx.arc(x, y, 3.4, 0, Math.PI * 2); mmCtx.fill();
mmCtx.strokeStyle = "rgba(255,255,255,0.72)"; mmCtx.lineWidth = 1.6;
mmCtx.beginPath(); mmCtx.moveTo(x, y);
mmCtx.lineTo(x - Math.sin(p.yaw) * 13, y - Math.cos(p.yaw) * 13); mmCtx.stroke();} else {
mmCtx.fillStyle = mate ? "#46d9c2" : "#ff7a45"; mmCtx.beginPath();
mmCtx.arc(x, y, mate ? 2.8 : 3.1, 0, Math.PI * 2); mmCtx.fill();}}
if (m.beacon.planted) {
const x = mmX(m.beacon.x); const y = mmZ(m.beacon.z);
mmCtx.strokeStyle = "#ff4d5e"; mmCtx.lineWidth = 1.8;
mmCtx.beginPath(); mmCtx.arc(x, y, 5 + Math.sin(performance.now() / 170) * 1.6, 0, Math.PI * 2);
mmCtx.stroke();}}
function hitMarker(kill, head) {
hud.hitMarker.classList.add("on"); hud.hitMarker.classList.toggle("kill", kill);
hud.hitMarker.style.color = head ? "#ffd166" : ""; clearTimeout(hitMarker.timer);
hitMarker.timer = setTimeout(() => hud.hitMarker.classList.remove("on"), kill ? 240 : 130);}
function showBanner(text) {
set("killBanner",text); hud.killBanner.classList.add("on");
clearTimeout(showBanner.timer);
showBanner.timer = setTimeout(() => hud.killBanner.classList.remove("on"), 1500);}
let arcTimer = 0;
function onEvent(e) {
const m = match(); const p = m.player;
const ear = {x: p.pos.x,y: p.pos.y,z: p.pos.z,yaw: p.yaw};
switch (e.type) {
case "shot":
{ const at = {x: e.x,y: e.y,z: e.z};
audio.gunshot(e.weapon, e.id === p.id ? null : at, ear);
if (e.id === p.id) {
viewModel.fire(1); muzzleSprite.material.opacity = 0.8;
muzzleSprite.scale.setScalar(0.036 + Math.random() * 0.018);
muzzleSprite.visible = true;} else bodies.get(e.id)?.muzzleFlash(); break;}
case "impact":
spawnSparks(e.x, e.y, e.z, e.nx, e.ny, e.nz); break;
case "weaponSwitch":
if (e.id === p.id) syncViewModel(); break;
case "hitmarker":
if (e.attacker === p.id) {
audio.hitmarker(e.zone === "head"); hitMarker(e.killed, e.zone === "head");} else if (e.victim === p.id) audio.damageTaken(); break;
case "damageTaken":
hud.damageArc.classList.add("on"); clearTimeout(arcTimer);
arcTimer = setTimeout(() => hud.damageArc.classList.remove("on"), 280);
engine.shakeT = Math.max(engine.shakeT, 0.22); break;
case "killfeed":
pushKillfeed(e.entry);
if (e.entry.killer === p.name && e.entry.victimTeam !== p.team) showBanner(`KILLED ${e.entry.victim}`);
break;
case "death":
if (e.id === p.id) showBanner("YOU ARE DOWN"); audio.death();
break;
case "reloadStart":
if (e.id === p.id) viewModel.startReload(e.duration); audio.reload(0, null, ear);
break;
case "reloadEnd":
if (e.id === p.id) audio.reload(1, null, ear); break;
case "footstep":
audio.footstep({x: e.x,y: e.y,z: e.z}, ear, e.running);
break;
case "radio":
if (e.team === null || e.team === p.team) pushRadio(e.text); audio.radioChirp();
break;
case "planted":
audio.planted();
toast(`PLANTED ${e.site}`, 2600);
break;
case "defused":
audio.defused(); toast("BEACON DEFUSED", 2600);
break;
case "detonation":
audio.detonation(); engine.shakeT = 0.7;
blastSprite.position.set(e.x, 2.2, e.z); blastSprite.material.opacity = 0.9;
blastSprite.visible = true; break;
case "fragExplode":
audio.detonation(); engine.shakeT = Math.max(engine.shakeT, 0.4);
blastSprite.position.set(e.x, e.y + 0.4, e.z); blastSprite.material.opacity = 0.7;
blastSprite.visible = true; break;
case "smokePop":
audio.smokePop({x: e.x,y: e.y,z: e.z}, ear);
break;
case "buy":
if (e.id === p.id) audio.buy(); break;
case "dryFire":
if (e.id === p.id) {
audio.deny(); toast("MAGAZINE EMPTY", 900);}
break;
case "stinger":
if (e.kind === "win") audio.roundWin(); else audio.roundLoss(); break;
case "roundStart":
set("killfeed",""); feedNodes.length = 0;
set("radio",""); radioNodes.length = 0;
hud.killBanner.classList.remove("on"); break;
case "matchEnd":
audio.roundWin(); hud.matchEnd.hidden = false;
set("matchEndTitle",e.winner === p.team ? "VICTORY" : "DEFEAT");
set("matchEndLine",`${e.score.warden} — ${e.score.cinder}, ${m.round} rounds`);
if (document.pointerLockElement === canvas) document.exitPointerLock(); break;
default:
break;}}
engine.match.onEvent = onEvent;
function updateEffects(dt) {
const m = match(); let n = 0;
for (const t of m.tracers) {
if (n >= TRACER_MAX) break; const fade = clamp(t.life / 0.075, 0.15, 1);
const r = t.team === TEAM.WARDEN ? 0.42 : 1; const g = t.team === TEAM.WARDEN ? 0.95 : 0.62;
const b = t.team === TEAM.WARDEN ? 0.88 : 0.36; tracerPos.setXYZ(n * 2, t.x1, t.y1, t.z1);
tracerPos.setXYZ(n * 2 + 1, t.x2, t.y2, t.z2); tracerCol.setXYZ(n * 2, r * fade, g * fade, b * fade);
tracerCol.setXYZ(n * 2 + 1, r * fade, g * fade, b * fade); n++;}
tracerGeo.setDrawRange(0, n * 2);
if (n > 0) {
tracerPos.needsUpdate = true; tracerCol.needsUpdate = true;}
for (let i = sparks.length - 1; i >= 0; i--) {
const s = sparks[i]; s.life -= dt;
if (s.life <= 0) { sparks.splice(i, 1); continue; }
s.vy -= 13 * dt; s.x += s.vx * dt;
s.y += s.vy * dt; s.z += s.vz * dt;}
for (let i = 0; i < sparks.length; i++) {
const s = sparks[i]; sparkPos[i * 3] = s.x;
sparkPos[i * 3 + 1] = s.y; sparkPos[i * 3 + 2] = s.z;}
sparkGeo.setDrawRange(0, sparks.length);
if (sparks.length > 0) sparkGeo.getAttribute("position").needsUpdate = true;
for (let i = 0; i < IMPACT_MAX; i++) {
const mesh = impactPool[i]; const src = m.impacts[i];
if (src === void 0) {
mesh.visible = false; continue;}
const s = clamp(src.life / 0.5, 0.15, 1); mesh.visible = true;
mesh.position.set(src.x, src.y, src.z); mesh.scale.setScalar(0.7 + s * 0.8);
mesh.material.opacity = s * 0.9;}
if (m.beacon.planted && m.beacon.timer > 0) {
engine.beepIn = (engine.beepIn ?? 0.9) - dt;
if (engine.beepIn <= 0) { engine.beepIn = clamp(m.beacon.timer / 12, 0.16, 0.9); audio.countdown(true); }}
let sp = 0;
for (const cloud of m.smokes) {
if (!cloud.armed) continue; const left = clamp(cloud.life / 2.6, 0, 1);
for (let k = 0; k < 9 && sp < SMOKE_SPRITES; k++) {
const sprite = smokePool[sp]; const a = k / 9 * Math.PI * 2 + cloud.x * 0.11;
const rad = 1.8 + Math.sin(k * 2.1 + cloud.z) * 1.9; sprite.visible = true;
sprite.position.set(cloud.x + Math.cos(a) * rad, 1.0 + k * 7 % 10 * 0.26, cloud.z + Math.sin(a) * rad);
sprite.scale.setScalar(5.4 + Math.sin(k) * 1.5);
sprite.material.opacity = 0.46 * left * (0.72 + k % 3 * 0.14); sp++;}}
for (;sp < SMOKE_SPRITES; sp++) smokePool[sp].visible = false;
if (blastSprite.visible) {
blastSprite.material.opacity = Math.max(0, blastSprite.material.opacity - dt * 2.6);
blastSprite.scale.setScalar(3 + 6 * (0.9 - blastSprite.material.opacity));
if (blastSprite.material.opacity <= 0.002) blastSprite.visible = false;}
if (muzzleSprite.visible) {
muzzleSprite.material.opacity = Math.max(0, muzzleSprite.material.opacity - dt * 7.5);
if (muzzleSprite.material.opacity <= 0.002) muzzleSprite.visible = false;}
for (const f of m.fighters) if (!f.isPlayer) bodies.get(f.id)?.updateFlash(dt);}
const camPos = new Vector3;
let bobPhase = 0;
function updateCamera(dt) {
const m = match(); const p = m.player;
const eye = p.pos.y + MOVE.eyeStand - p.crouch * (MOVE.eyeStand - MOVE.eyeCrouch);
const speed = Math.hypot(p.vel.x, p.vel.z); bobPhase += dt * (2.1 + speed * 0.62) * (p.grounded ? 1 : 0.25);
const bobAmt = Math.min(1, speed / MOVE.walkSpeed) * (1 - p.crouch * 0.8);
const bobX = Math.cos(bobPhase) * 0.016 * bobAmt;
const bobY = Math.abs(Math.sin(bobPhase)) * 0.019 * bobAmt; camPos.set(p.pos.x, eye + bobY, p.pos.z);
if (engine.shakeT > 0) {
engine.shakeT = Math.max(0, engine.shakeT - dt); const amp = engine.shakeT * 0.1;
camPos.x += Math.sin(engine.shakeT * 130) * amp; camPos.y += Math.cos(engine.shakeT * 161) * amp;}
camera.position.copy(camPos); camera.rotation.set(0, 0, 0);
camera.rotateY(m.playerAim?.yaw ?? p.yaw); camera.rotateX(m.playerAim?.pitch ?? p.pitch);
camera.rotateZ(0.45 * -bobX); viewModel.root.position.y = p.crouch * -0.02;}
function syncViewModel() {
const w = match().player.weapon;
viewModel.setWeapon(w === "sidearm" ? "sidearm" : w === "knife" ? "knife" : "rifle");}
function updateViewModel(dt) {
const m = match(); const p = m.player;
syncViewModel();
const speed = Math.hypot(p.vel.x, p.vel.z);
viewModel.update(dt, {ads: p.crouch * 0.3,speed: speed,lookDX: engine.lookDX,lookDY: engine.lookDY,alive: p.alive,lowered: p.alive ? 0 : 1});
engine.lookDX = damp(engine.lookDX, 0, 11, dt); engine.lookDY = damp(engine.lookDY, 0, 11, dt);}
function updateBodies(dt) {
const m = match();
for (const f of m.fighters) {
if (f.isPlayer) continue; const model = bodies.get(f.id);
if (model === void 0) continue; model.root.position.set(f.pos.x, f.pos.y, f.pos.z);
model.root.rotation.y = f.yaw; const aiming = f.target !== null && m.phase === "live" && f.alive;
model.animate(dt, {speed: Math.hypot(f.vel.x, f.vel.z),crouch: f.crouch,aim: aiming ? 1 : 0,dead: !f.alive,shotKick: f.shotKick});}}
let demoTarget = 0;
let demoBought = false;
let demoPlaced = false;
function nearestEnemy(p) {
let best = null; let bestD = 1 / 0;
for (const f of match().fighters) {
if (!f.alive || f.team === p.team) continue; const d = Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z);
if (d < bestD) {
bestD = d; best = f;}}
return bestD < 58 ? best : null;}
const wrapPi = a => {
let d = a; while (d > Math.PI) d -= Math.PI * 2;
while (d < -Math.PI) d += Math.PI * 2; return d;};
function seedDemoState(m) {
if (!DEMO_MODE) return; m.player.money = 4500;}
function placeDemoPlayer(p) {
const num = (key, fallback) => {
const v = Number(params.get(key)); return Number.isFinite(v) && params.get(key) !== null ? v : fallback;}; const spot = SHOT_SPOTS[SHOT_SPEC.mode] ?? [ 0, 33, 0, 12 ];
const px = num("px", spot[0]), pz = num("pz", spot[1]);
const tx = num("tx", spot[2]), tz = num("tz", spot[3]);
p.pos = {x: px,y: 0,z: pz};
p.vel = {x: 0,y: 0,z: 0};
p.yaw = Math.atan2(-(tx - px), -(tz - pz)); p.pitch = num("pitch", 0);}
function demoDrive() {
const m = match(); const p = m.player;
input.fire=false; input.fireHeld=false;
if (DEMO_MODE && p.ammo[p.weapon] === 0 && !p.reloading) pendingReload = true;
if(m.phase==='buy') {
input.forward=false;
if (DEMO_MODE && !demoBought) {
demoBought = true; for (const item of DEMO.buyList) m.buy(p, item);}
return;}
if (SHOT_SPEC !== null && SHOT_SPEC.mode !== "buy" && !demoPlaced) {
demoPlaced = true; placeDemoPlayer(p);}
if (!p.alive) {
input.fire = false; input.forward = false;
return;}
const visible = m.botPerceive(p);
if (visible) {
const dx=visible.pos.x-p.pos.x, dz=visible.pos.z-p.pos.z; const yaw=Math.atan2(-dx,-dz);
const pitch=Math.atan2(visible.pos.y+1.32-(p.pos.y+MOVE.eyeStand-p.crouch*0.42),Math.hypot(dx,dz));
input.forward=false; input.crouch=true; input.mouseDX=-wrapPi(yaw-p.yaw)/input.sensitivity;
input.mouseDY=-(pitch-p.pitch)/input.sensitivity; input.fire=true; input.fireHeld=true;
if(p.ammo[p.weapon]===0)pendingReload=true; return;}
const path = SHOT_SPEC !== null ? [] : DEMO.waypoints;
while (demoTarget < path.length) {
const [tx, tz] = path[demoTarget];
if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 2.4) demoTarget++; else break;}
if (demoTarget < path.length) {
const [tx, tz] = path[demoTarget];
const diff = wrapPi(Math.atan2(-(tx - p.pos.x), -(tz - p.pos.z)) - p.yaw); input.mouseDX = 300 * -diff;
input.mouseDY = 0; input.forward = Math.abs(diff) < 0.9;
input.crouch = false; input.use = false;
input.fire = false; return;}
input.forward = false;
if (SHOT_SPEC !== null && SHOT_SPEC.mode === "site") {
const c = SITES.B.center; const sx = c[0] - p.pos.x, sz = c[2] - p.pos.z;
const sd = Math.hypot(sx, sz); const yaw = Math.atan2(-sx, -sz);
const pitch = Math.atan2(0.9 - (p.pos.y + MOVE.eyeStand - p.crouch * 0.42), sd); input.crouch = true;
input.fire = false; input.use = true;
input.mouseDX = 300 * -wrapPi(yaw - p.yaw); input.mouseDY = 300 * -wrapPi(pitch - p.pitch);
return;}
const enemy = nearestEnemy(p);
if (enemy === null) {
input.fire = false; input.crouch = false;
input.use = m.beacon.carrier === p.id || m.beacon.planted && p.team === m.defendingTeam; return;}
const dx = enemy.pos.x - p.pos.x; const dz = enemy.pos.z - p.pos.z;
const d = Math.hypot(dx, dz); const diff = wrapPi(Math.atan2(-dx, -dz) - p.yaw);
const eye = p.pos.y + MOVE.eyeStand - p.crouch * 0.42;
const wantPitch = Math.atan2(enemy.pos.y + 1.34 - eye, d); input.mouseDX = 240 * -diff;
input.mouseDY = 240 * -wrapPi(wantPitch - p.pitch); input.fire = d < 46 && Math.abs(diff) < 0.11;
input.crouch = d > 26;
input.use = m.beacon.carrier === p.id || m.beacon.planted && p.team === m.defendingTeam;}
function start() {
if (running) return; running = true;
engine.paused = false; engine.lastTime = performance.now();
hud.startScreen.hidden = true; hud.pauseScreen.hidden = true;
hud.matchEnd.hidden = true; audio.unlock();
audio.uiClick(); lockPointer();
if (match().phase === "buy") openBuy();}
function togglePause() {
if (!running) return; setPaused(!engine.paused);}
function setPaused(paused) {
engine.paused = paused; hud.pauseScreen.hidden = !paused;
if (paused) {
input.fire = false; mouseDown = false;
if (document.pointerLockElement === canvas) document.exitPointerLock();} else {
audio.unlock(); lockPointer();
engine.lastTime = performance.now();}}
function rebuildBodies() {
for (const model of bodies.values()) {
scene.remove(model.root); model.dispose();}
bodies.clear(); for (const f of match().fighters) if (!f.isPlayer) addBody(f);}
function restart() {
engine.match = newMatch(); seedDemoState(engine.match); engine.match.onEvent = onEvent;
demoTarget = 0; demoBought = false;
demoPlaced = false; engine.accumulator = 0;
engine.shotFrozen = false; engine.shakeT = 0;
hud.matchEnd.hidden = true; set("killfeed","");
feedNodes.length = 0; set("radio","");
radioNodes.length = 0; clearTimeout(arcTimer);
hud.damageArc.classList.remove("on"); rebuildBodies();
running = false; start();}
function openBuy() {
hud.buyMenu.hidden = false; engine.buyOpen = true;
if (document.pointerLockElement === canvas) document.exitPointerLock();}
function closeBuy() {
hud.buyMenu.hidden = true; engine.buyOpen = false;
if (running) lockPointer();}
function toggleBuy() {
if (!running || match().phase !== "buy") return; if (engine.buyOpen) closeBuy(); else openBuy();}
for (const btn of buyButtons) btn.addEventListener("click", () => {
const res = match().buy(match().player, btn.dataset.item);
if (res.ok) {
audio.buy();
set("buyHint",`BOUGHT ${res.item.toUpperCase()}`);} else {
audio.deny();
set("buyHint",`NO ${res.reason.toUpperCase()}`);}
clearTimeout(buyButtons.timer);
buyButtons.timer = setTimeout(() => {
set("buyHint",DEFAULT_BUY_HINT);}, 1700); drawHud();});
function selectSlot(slot) {
if (!running) return;
if (match().switchWeapon(match().player, slot)) audio.uiClick(); else audio.deny();
drawHud();}
function throwUtil(kind) {
if (!running || match().phase !== "live") return;
if (match().throwUtil(match().player, kind)) {
viewModel.setWeapon("util"); viewModel.utilThrow();
toast(kind === "smoke" ? "SMOKE OUT" : "FRAG OUT", 900);
setTimeout(() => syncViewModel(), 500);
return;}
audio.deny(); toast(kind === "smoke" ? "NO SMOKE LEFT" : "NO FRAG LEFT", 900);}
function renderOnly(dt) {
world.update(dt); updateBodies(dt);
updateCamera(dt); updateViewModel(dt);
updateEffects(dt); drawHud();
drawMinimap(); renderer.render(scene, camera);}
function frame(now) {
requestAnimationFrame(frame);
if (engine.lastTime === 0) {
engine.lastTime = now; renderOnly(1 / 60);
return;}
const dt = DEMO_MODE && SHOT_SPEC ? 1 / 15 : clamp((now - engine.lastTime) / 1000, 0, 0.25);
engine.lastTime = now; if (engine.shotFrozen) return;
if (!running || engine.paused) {
renderOnly(dt); return;}
readKeys(); input.fire = mouseDown;
input.fireHeld = input.fire; engine.accumulator += dt;
let steps = 0;
while (engine.accumulator >= TICK && steps < MAX_STEPS) {
const m = match(); if (DEMO_MODE) demoDrive();
m.applyPlayerInput(input, TICK);
if (pendingReload) {
m.beginReload(m.player); pendingReload = false;}
m.step(TICK); engine.lookDX += input.mouseDX;
engine.lookDY += input.mouseDY; input.mouseDX = 0;
input.mouseDY = 0; input.jump = false;
engine.accumulator -= TICK; steps++;}
if (steps === 0) {
renderer.render(scene, camera); return;}
engine.frames++; renderOnly(dt);
const m = match();
if (m.phase !== engine.wasPhase) {
if (m.phase === "live" && engine.buyOpen) closeBuy(); if (m.phase === "buy") audio.countdown(false);
engine.wasPhase = m.phase;}
if (SHOT_SPEC !== null && !engine.shotFrozen && m.time >= SHOT_SPEC.simSeconds) freezeForCapture();}
function freezeForCapture() {
engine.shotFrozen = true; mouseDown = false;
input.fire = false; let settle = 0;
const finish = () => {
settle++; renderOnly(0);
if (settle < 5) {
requestAnimationFrame(finish); return;}
const m = match(); window.__relayFrozen = true;
window.__relayState = {
frozen: true,
shot: SHOT,
simTime: Number(m.time.toFixed(3)),
frames: engine.frames,
round: m.round,
phase: m.phase,
score: { ...m.score},
kills: m.player.kills,
health: m.player.health,
ammo: m.player.ammo[m.player.weapon] ?? 0,
weapon: m.player.weapon,
aliveWarden: m.aliveCount(TEAM.WARDEN),
aliveCinder: m.aliveCount(TEAM.CINDER),
beaconPlanted: m.beacon.planted,
pos: {x: Number(m.player.pos.x.toFixed(2)),y: Number(m.player.pos.y.toFixed(2)),z: Number(m.player.pos.z.toFixed(2))},
yaw: Number(m.player.yaw.toFixed(3)),
pitch: Number(m.player.pitch.toFixed(3)),
demoTarget: demoTarget,
siteDist: Number(Math.hypot(SITES.B.center[0] - m.player.pos.x, SITES.B.center[2] - m.player.pos.z).toFixed(2)),
pixel: readCentre(),
calls: renderer.info.render.calls,
triangles: renderer.info.render.triangles};}; requestAnimationFrame(finish);}
window.relay = {
get match() {
return match();},
get frozen() {
return engine.shotFrozen === true;},
get state() {
return window.__relayState ?? null;},
info: () => ({ ...renderer.info.render}),
timeFrame: () => {
const t0 = performance.now(); renderOnly(1 / 60);
renderer.getContext().finish(); return Math.round(performance.now() - t0);},
scene: scene,
camera: camera,
renderer: renderer,
world: world,
frames: () => engine.frames,
debug: () => ({
running: running,
paused: engine.paused,
frozen: engine.shotFrozen,
acc: engine.accumulator,
last: engine.lastTime,
buyOpen: engine.buyOpen,
phase: engine.match.phase,
t: engine.match.time}),
captureDemo: () => {
if (!DEMO_MODE || !SHOT_SPEC) throw new Error('Capture requires demo and shot');
while (match().time < SHOT_SPEC.simSeconds) {
demoDrive(); match().applyPlayerInput(input, TICK);
if (pendingReload) { match().beginReload(match().player); pendingReload = false; }
match().step(TICK); input.mouseDX = input.mouseDY = 0;
input.jump = false; engine.frames++;}
if (match().phase !== 'buy') closeBuy(); freezeForCapture();},
start: start,
restart: restart,
pause: setPaused,
readPixel: readCentre};
function resize() {
const w = window.innerWidth; const h = window.innerHeight;
renderer.setSize(w, h, false); camera.aspect = w / h;
camera.updateProjectionMatrix();}
addEventListener("resize", resize);
resize();
hud.startBtn.addEventListener("click", start);
hud.resumeBtn.addEventListener("click", () => setPaused(false));
hud.restartBtn.addEventListener("click", restart);
hud.againBtn.addEventListener("click", restart);
renderer.compile(scene, camera);
renderOnly(1 / 60);
requestAnimationFrame(frame);
if (AUTOSTART) start();

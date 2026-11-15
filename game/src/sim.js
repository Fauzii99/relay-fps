import { TEAM, WEAPONS, BUY, UTIL, MATCH, SITES, SPAWNS, MOVE, BOT, SQUAD} from "./config.js";
import { CollisionWorld} from "./collision.js";
import { raycastFighter, damageAtRange, applyDamage, recoilForShot} from "./combat.js";
import { createRng, clamp, damp} from "./rng.js";
import { findPath, smoothPath, nearestNode, clearPathCache} from "./nav.js";
import { COVER} from "./map.js";
import { bomb} from "./bomb.js";
import { rounds} from "./rounds.js";
import { grenade} from "./grenade.js";
import { bots} from "./bots.js";
const ZERO = {x: 0,y: 0,z: 0};
function makeFighter(id, team, name, role, isPlayer = false) {
 return {
  id: id,
  team: team,
  name: name,
  role: role,
  isPlayer: isPlayer,
  pos: {x: 0,y: 0,z: 0, ...ZERO},
  vel: {x: 0,y: 0,z: 0},
  yaw: 0,
  pitch: 0,
  health: MOVE.maxHealth,
  armor: 0,
  alive: true,
  crouch: 0,
  ducking: false,
  grounded: true,
  walking: false,
  weapon: "sidearm",
  ammo: {sidearm: WEAPONS.sidearm.mag},
  reserve: {sidearm: WEAPONS.sidearm.reserve},
  reloading: 0,
  reloadDur: 0,
  fireCooldown: 0,
  shotIndex: 0,
  lastShotAt: -9,
  recoilPitch: 0,
  recoilYaw: 0,
  spreadBloom: 0,
  kills: 0,
  deaths: 0,
  damageDealt: 0,headshots: 0,assists: 0,damagers: null,
  money: MATCH.startMoney,
  spent: 0,
  hasKevlar: false,
  smoke: 0,
  frag: 0,
  utilHeld: null,
  path: [],
  pathIdx: 0,
  goal: null,
  goalNode: null,
  repathIn: 0,
  target: null,
  targetSeenAt: -9,
  aimError: 0,
  aimYaw: 0,
  aimPitch: 0,
  think: 0,
  strafe: 0,
  strafeIn: 0,
  holdSpot: null,
  holdUntil: 0,
  reactionUntil: 0,
  lane: "mid",
  state: "advance",
  plantProgress: 0,
  defuseProgress: 0,
  lastPos: {x: 0,z: 0},
  footstepIn: 0,shotKick: 0};}
const OWNED_ORDER = [ "marksman", "rifle", "smg", "sidearm" ];
const NAMES = {warden: [ "VOSS", "KESTREL", "HALDEN", "ORRIN", "MIRA", "TALC" ],cinder: [ "RAZE", "BRUTE", "SABLE", "KORVIN", "ASH", "DREK" ]};
export class Match {
 constructor({seed: seed = 1337,playerTeam: playerTeam = TEAM.WARDEN,demo: demo = false,onEvent: onEvent = null} = {}) {
  this.seed = seed; this.rng = createRng(seed);
  this.world = new CollisionWorld; this.onEvent = onEvent;
  this.playerTeam = playerTeam; this.enemyTeam = playerTeam === TEAM.WARDEN ? TEAM.CINDER : TEAM.WARDEN;
  this.demo = demo; this.fighters = [];
  this.nextId = 1; this.time = 0;
  this.ticks = 0; this.phase = "buy";
  this.phaseT = 0; this.round = 1;
  this.score = {warden: 0,cinder: 0};
  this.roundHistory = [];
  this.beacon = {
   carrier: null,
   planted: false,
   planting: false,
   defusing: false,
   site: null,
   x: 0,
   z: 0,
   timer: 0,
   plantT: 0,
   defuseT: 0,
   detonated: false,
   defused: false}; this.events = [];
  this.killfeed = []; this.radioFeed = [];
  this.spotted = new Set;
  this.impacts = []; this.tracers = [];
  this.damageMarkers = []; this.smokes = [];
  this.frags = []; this.roundWinner = null;
  this.roundReason = ""; this.matchWinner = null;
  this.plantSpot = null; this.defuseSpot = null;
  this.buildTeams(); this.startRound();}
 emit(event) {
  this.events.push(event); if (this.onEvent !== null) this.onEvent(event);}
 buildTeams() {
  for (let i = 0; i < SQUAD; i++) {
   const isPlayer = i === 0; const role = i === SQUAD - 1 ? "heavy" : "line";
   const w = makeFighter(this.nextId++, this.playerTeam, isPlayer ? "YOU" : NAMES[this.playerTeam][i], role, isPlayer);
   this.fighters.push(w);}
  for (let i = 0; i < SQUAD; i++) {
   const role = i === SQUAD - 1 ? "heavy" : "line";
   const c = makeFighter(this.nextId++, this.enemyTeam, NAMES[this.enemyTeam][i], role, false);
   this.fighters.push(c);}
  this.player = this.fighters[0];}
 squad(team) {
  return this.fighters.filter(f => f.team === team);}
 byId(id, living = true) {
  const f = this.fighters[id - 1]; if (f === void 0 || f.id !== id) return null;
  return living && !f.alive ? null : f;}
 aliveCount(team) {
  let n = 0; for (const f of this.fighters) if (f.team === team && f.alive) n++;
  return n;}
 step(dt) {
  this.time += dt; this.phaseT += dt;
  this.ticks++; this.pruneEffects(dt);
  if (this.phase === "matchEnd") return;
  if (this.phase === "buy") {
   this.updateBotsBuy();
   if (this.phaseT >= MATCH.buyPhase) {
    this.phase = "live"; this.phaseT = 0;
    this.emit({type: "phase",phase: "live",round: this.round});
    this.radio("Move up.");}
   this.updateBots(dt, false); this.updateBeacon(dt);
   return;}
  if (this.phase === "roundEnd") {
   this.updateBots(dt, false);
   if (this.phaseT >= MATCH.endPause) if (this.score.warden >= MATCH.roundsToWin || this.score.cinder >= MATCH.roundsToWin) {
    this.matchWinner = this.score.warden > this.score.cinder ? TEAM.WARDEN : TEAM.CINDER;
    this.phase = "matchEnd";
    this.emit({type: "matchEnd",winner: this.matchWinner,score: { ...this.score}});} else {
    this.round++; this.startRound();}
   return;}
  this.updateBots(dt, true); this.updateBeacon(dt);
  this.pushOutOfSolids();
  this.updateProjectiles(dt); this.checkRoundEnd();}
 pushOutOfSolids() {
  const solve = f => {
   const solved = this.world.resolve(f.pos.x, f.pos.z, MOVE.radius, f.pos.y, f.crouch > 0.5 ? MOVE.crouchHeight : MOVE.standHeight, MOVE.stepHeight);
   f.pos.x = solved.x; f.pos.z = solved.z;};
  for (const f of this.fighters) solve(f);
  for (let pass = 0; pass < 2; pass++) {
   for (const f of this.fighters) for (const o of this.fighters) {
    if (o === f || !o.alive || !f.alive) continue;
    const dx = f.pos.x - o.pos.x, dz = f.pos.z - o.pos.z, d = Math.hypot(dx, dz);
    const want = MOVE.radius * 2 + 0.1;
    if (d > want || d < 1e-5) continue;
    const push = (want - d) * 0.5; f.pos.x += dx / d * push; f.pos.z += dz / d * push;}
   for (const f of this.fighters) solve(f);}}
 pruneEffects(dt) {
  for (let i = this.tracers.length - 1; i >= 0; i--) {
   this.tracers[i].life -= dt; if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);}
  for (let i = this.impacts.length - 1; i >= 0; i--) {
   this.impacts[i].life -= dt; if (this.impacts[i].life <= 0) this.impacts.splice(i, 1);}
  for (let i = this.smokes.length - 1; i >= 0; i--) {
   const s = this.smokes[i];
   if (s.armed) s.life -= dt; else {
    s.fuse -= dt;
    if (s.fuse <= 0) {
     s.armed = true; s.life = UTIL.smoke.duration;
     this.emit({type: "smokePop",x: s.x,y: s.y,z: s.z,owner: s.owner,team: s.team});}}
   if (s.armed && s.life <= 0) this.smokes.splice(i, 1);}
  for (let i = this.frags.length - 1; i >= 0; i--) {
   const f = this.frags[i];
   if (!f.armed) {
    f.fuse -= dt; if (f.fuse <= 0) this.detonateFrag(f);}}}
 moveFighter(f, wantX, wantZ, dt, {jump: jump = false,crouch: crouch = false,walk: walk = false} = {}) {
  if (!f.alive) return;
  const speedBase = crouch ? MOVE.duckSpeed : walk ? MOVE.walkSpeed * 0.52 : MOVE.walkSpeed;
  const weaponSpeed = WEAPONS[f.weapon]?.moveSpeed ?? 1; const maxSpeed = speedBase * weaponSpeed;
  const targetLen = Math.hypot(wantX, wantZ); let tx = 0;
  let tz = 0;
  if (targetLen > 1e-5) {
   tx = wantX / targetLen * maxSpeed; tz = wantZ / targetLen * maxSpeed;}
  if (f.grounded) {
   const accel = MOVE.accelerate; f.vel.x += clamp(tx - f.vel.x, -accel * dt, accel * dt);
   f.vel.z += clamp(tz - f.vel.z, -accel * dt, accel * dt);
   if (targetLen < 1e-5) {
    const sp = Math.hypot(f.vel.x, f.vel.z); const drop = MOVE.friction * dt;
    const ns = Math.max(0, sp - drop); const k = sp > 1e-5 ? ns / sp : 0;
    f.vel.x *= k; f.vel.z *= k;}} else {
   f.vel.x += clamp(tx - f.vel.x, -MOVE.airAccel * dt, MOVE.airAccel * dt);
   f.vel.z += clamp(tz - f.vel.z, -MOVE.airAccel * dt, MOVE.airAccel * dt);}
  if (jump && f.grounded) {
   f.vel.y = MOVE.jumpSpeed; f.grounded = false;}
  f.vel.y -= MOVE.gravity * dt; const height = crouch ? MOVE.crouchHeight : MOVE.standHeight;
  let nx = f.pos.x + f.vel.x * dt; let nz = f.pos.z + f.vel.z * dt;
  const solved = this.world.resolve(nx, nz, MOVE.radius, f.pos.y, height, MOVE.stepHeight); nx = solved.x;
  nz = solved.z; let ny = f.pos.y + f.vel.y * dt;
  const support = this.world.supportHeight(nx, nz, MOVE.radius, f.pos.y + 0.02, MOVE.stepHeight);
  if (ny <= support + 1e-4) {
   ny = support; if (f.vel.y < 0) f.vel.y = 0;
   f.grounded = true;} else f.grounded = false; nx = clamp(nx, -39.2, 39.2);
  nz = clamp(nz, -47.2, 47.2); const horiz = Math.hypot(f.vel.x, f.vel.z);
  if (f.grounded && horiz > 1.2) {
   f.footstepIn -= dt * (crouch ? 0.5 : walk ? 0.7 : horiz / 3.4);
   if (f.footstepIn <= 0) {
    f.footstepIn = 0.54;
    this.emit({type: "footstep",id: f.id,x: nx,y: ny,z: nz,running: horiz > 6.4,crouch: crouch});}} else f.footstepIn = 0; f.pos.x = nx;
  f.pos.y = ny; f.pos.z = nz;
  f.ducking = crouch; f.walking = walk;
  f.crouch = damp(f.crouch, crouch ? 1 : 0, 14, dt);}
 currentSpread(f) {
  const w = WEAPONS[f.weapon]; const speed = Math.hypot(f.vel.x, f.vel.z);
  const moveFactor = clamp(speed / MOVE.walkSpeed, 0, 1); let spread = w.spreadBase;
  spread += w.spreadMove * moveFactor; if (!f.grounded) spread += w.spreadAir;
  spread -= (w.spreadBase - w.spreadCrouch) * f.crouch; spread += f.spreadBloom;
  return Math.max(0.0004, spread);}
 tryFire(f, {held: held = false} = {}) {
  if (!f.alive || this.phase !== "live") return false; const w = WEAPONS[f.weapon];
  if (f.reloadDur > 0) return false; if (f.fireCooldown > 0) return false;
  if (!w.auto && held && f.lastShotAt !== void 0 && this.time - f.lastShotAt < 0.09) return false;
  const mag = f.ammo[f.weapon] ?? 0;
  if (w.kind === "melee") f.ammo[f.weapon] = Math.max(mag, 1);
  else if (mag <= 0) {
   if (f.isPlayer) this.emit({type: "dryFire",id: f.id});
   return false;}
  if (w.kind !== "melee") f.ammo[f.weapon] = mag - 1; f.fireCooldown = 60 / w.rpm;
  f.lastShotAt = this.time; f.recoilPitch += w.recoilUp * recoilForShot(f.shotIndex).up;
  f.recoilYaw += w.recoilSide * recoilForShot(f.shotIndex).side;
  f.spreadBloom = Math.min(w.spreadBase * 3.4, f.spreadBloom + w.recoilUp * 0.42); f.shotIndex++;
  f.shotKick = 1; const spread = this.currentSpread(f);
  const [cx, cy] = this.rng.cone(spread); const yaw = f.yaw + Math.atan(cx);
  const pitch = clamp(f.pitch + Math.atan(cy), -1.52, 1.52);
  const dir = {x: -Math.sin(yaw) * Math.cos(pitch),y: Math.sin(pitch),z: -Math.cos(yaw) * Math.cos(pitch)};
  const eyeY = f.pos.y + (f.ducking ? MOVE.eyeCrouch : MOVE.eyeStand) - f.crouch * 0.42;
  const origin = {x: f.pos.x,y: eyeY,z: f.pos.z};
  const maxDist = w.range * 3;
  const wallHit = this.world.raycast(origin, dir, maxDist, b => b.kind === "rail" && b.y1 < origin.y);
  const wallT = wallHit === null ? maxDist : wallHit.t; let bestFighter = null;
  let bestHit = null;
  for (const other of this.fighters) {
   if (other === f || !other.alive || other.team === f.team) continue;
   const hit = raycastFighter(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, wallT, other);
   if (hit !== null && (bestHit === null || hit.t < bestHit.t)) {
    bestHit = hit; bestFighter = other;}}
  const shot = {
   id: this.nextId++,
   owner: f.id,
   team: f.team,
   x: origin.x,
   y: origin.y,
   z: origin.z,
   dx: dir.x,
   dy: dir.y,
   dz: dir.z,
   endX: 0,
   endY: 0,
   endZ: 0,
   hitWall: true,
   weapon: f.weapon,
   life: 0.16};
  if (bestFighter !== null && bestHit !== null) {
   const dist = bestHit.t; let dmg = damageAtRange(w, dist);
   dmg *= bestHit.mult; const res = applyDamage(bestFighter, dmg, bestHit.zone);
   f.damageDealt += res.dealt; shot.endX = origin.x + dir.x * dist;
   const marks = bestFighter.damagers ?? (bestFighter.damagers = []);
   if (!marks.includes(f.id)) marks.push(f.id);
   shot.endY = origin.y + dir.y * dist; shot.endZ = origin.z + dir.z * dist;
   shot.hitWall = false;
   this.emit({
    type: "hitmarker",
    attacker: f.id,
    victim: bestFighter.id,
    zone: bestHit.zone,
    damage: res.dealt,
    killed: res.killed,
    x: shot.endX,
    y: shot.endY,
    z: shot.endZ,
    team: f.team});
   if (bestFighter.isPlayer) {
    this.emit({type: "damageTaken",from: f.id,amount: res.dealt,zone: bestHit.zone});}
   if (bestFighter.alive) {
    bestFighter.lastAttacker = f.id; bestFighter.lastHurtAt = this.time;
    if (!bestFighter.isPlayer && bestFighter.target === null) {
     bestFighter.target = f.id; bestFighter.targetSeenAt = this.time;
     bestFighter.reactionUntil = this.time + 0.16;}}
   if (res.killed) this.killFighter(bestFighter, f, bestHit.zone, f.weapon);} else if (wallHit !== null) {
   shot.endX = wallHit.x; shot.endY = wallHit.y;
   shot.endZ = wallHit.z;
   this.impacts.push({x: wallHit.x,y: wallHit.y,z: wallHit.z,nx: wallHit.nx,ny: wallHit.ny,nz: wallHit.nz,life: 0.5,kind: "wall"});
   this.emit({type: "impact",x: wallHit.x,y: wallHit.y,z: wallHit.z,nx: wallHit.nx,ny: wallHit.ny,nz: wallHit.nz});
   this.alertBotsNear(wallHit.x, wallHit.y, wallHit.z, f);} else {
   shot.endX = origin.x + dir.x * maxDist; shot.endY = origin.y + dir.y * maxDist;
   shot.endZ = origin.z + dir.z * maxDist; shot.hitWall = false;}
  this.tracers.push({x1: shot.x,y1: shot.y,z1: shot.z,x2: shot.endX,y2: shot.endY,z2: shot.endZ,life: 0.075,weapon: f.weapon,team: f.team});
  this.emit({type: "shot",id: f.id,weapon: f.weapon,x: origin.x,y: origin.y,z: origin.z,team: f.team});
  return true;}
 advanceReload(f, dt) {
  if (f.reloadDur <= 0) return; f.reloading = Math.max(0, f.reloading - dt);
  if (f.reloading === 0) this.finishReload(f);}
 beginReload(f) {
  if (!f.alive || f.reloadDur > 0) return false; const w = WEAPONS[f.weapon];
  const reserve = f.reserve[f.weapon] ?? 0; const mag = f.ammo[f.weapon] ?? 0;
  if (reserve <= 0 || mag >= w.mag) return false; f.reloading = w.reloadTime;
  f.reloadDur = w.reloadTime; f.reloadStage = 0;
  this.emit({type: "reloadStart",id: f.id,weapon: f.weapon,duration: w.reloadTime});
  return true;}
 finishReload(f) {
  const w = WEAPONS[f.weapon]; const need = w.mag - (f.ammo[f.weapon] ?? 0);
  const take = Math.min(need, f.reserve[f.weapon] ?? 0); f.ammo[f.weapon] = (f.ammo[f.weapon] ?? 0) + take;
  f.reserve[f.weapon] = (f.reserve[f.weapon] ?? 0) - take; f.reloading = 0;
  f.reloadDur = 0;
  this.emit({type: "reloadEnd",id: f.id,weapon: f.weapon});}
 switchWeapon(f, slot) {
  if (!f.alive) return false;
  const want = slot === 1 ? "primary" : slot === 2 ? "sidearm" : "knife";
  const owned = k => (f.ammo[k] ?? 0) + (f.reserve[k] ?? 0) > 0;
  let pick = null;
  if (want === "primary") pick = OWNED_ORDER.find(k => k !== "sidearm" && k !== "knife" && owned(k)) ?? null;
  else if (want === "sidearm") pick = owned("sidearm") ? "sidearm" : null;
  else pick = "knife";
  if (pick === null || pick === f.weapon) return false;
  f.reloadDur = 0; f.reloading = 0;
  f.fireCooldown = Math.max(f.fireCooldown, 0.28);
  f.weapon = pick; f.shotIndex = 0;
  this.emit({type: "weaponSwitch",id: f.id,weapon: pick});
  return true;}
 killFighter(victim, killer, zone, weapon) {
  if (!victim.alive) return; victim.alive = false;
  victim.health = 0; victim.deaths++;
  victim.reloading = 0; victim.utilHeld = null;
  victim.crouch = 0;
  this.emit({type: "death",id: victim.id,x: victim.pos.x,y: victim.pos.y,z: victim.pos.z,team: victim.team});
  if (this.beacon.carrier === victim.id) {
   this.beacon.carrier = null;
   this.plantSpot = {x: victim.pos.x,z: victim.pos.z};
   this.emit({type: "beaconDrop",x: victim.pos.x,z: victim.pos.z});}
  if (killer !== null && killer.id !== victim.id) {
   if (killer.team === victim.team) {
    killer.money = Math.max(0, killer.money - MATCH.teamKillPenalty); killer.kills--;} else {
    killer.kills++; const w = WEAPONS[weapon];
   if (zone === "head") killer.headshots++;
   for (const id of victim.damagers ?? []) {
    if (id === killer.id) continue;
    const helper = this.byId(id);
    if (helper !== null && helper.team !== victim.team) helper.assists++;}
    killer.money = Math.min(MATCH.maxMoney, killer.money + (w?.killReward ?? 300));
    this.radio(`${killer.name} downed ${victim.name}${zone === "head" ? " (head)" : ""}.`, killer.team);}
   this.killfeed.unshift({
    killer: killer.name,
    killerTeam: killer.team,
    weapon: WEAPONS[weapon]?.name ?? weapon,
    victim: victim.name,
    victimTeam: victim.team,
    head: zone === "head",
    at: this.time,
    mine: killer.isPlayer || victim.isPlayer}); if (this.killfeed.length > 6) this.killfeed.pop();
   this.emit({type: "killfeed",entry: this.killfeed[0]});} else {
   this.killfeed.unshift({killer: null,killerTeam: null,weapon: "world",victim: victim.name,victimTeam: victim.team,head: false,at: this.time,mine: victim.isPlayer});
   this.emit({type: "killfeed",entry: this.killfeed[0]});}}
 buy(f, item) {
  if (!f.alive) return {ok: false,reason: "down"};
  if (this.phase !== "buy" && !(this.phase === "live" && this.phaseT < 3)) return {ok: false,reason: "closed"};
  if (!this.spawnZone(f)) return {ok: false,reason: "away from spawn"};
  if (item === "kevlar") {
   if (f.hasKevlar && f.armor > 0) return {ok: false,reason: "already have a vest"};
   if (f.money < BUY.kevlar.cost) return {ok: false,reason: "not enough money"};
   f.money -= BUY.kevlar.cost; f.spent += BUY.kevlar.cost;
   f.armor = BUY.kevlar.armour; f.hasKevlar = true;
   this.emit({type: "buy",id: f.id,item: item,cost: BUY.kevlar.cost});
   return {ok: true,item: item};}
  if (item === "smoke" || item === "frag") {
   const def = BUY[item];
   if (f[item] >= 2) return {
    ok: false,
    reason: `already carrying two ${item}s`};
   if (f.money < def.cost) return {ok: false,reason: "not enough money"};
   f.money -= def.cost; f.spent += def.cost;
   f[item] += def.count;
   this.emit({type: "buy",id: f.id,item: item,cost: def.cost});
   return {ok: true,item: item};}
  const w = WEAPONS[item];
  if (w === void 0) return {ok: false,reason: "no such item"};
  if (f.weapon === item) return {ok: false,reason: "already carrying it"};
  if (f.money < w.cost) return {ok: false,reason: "not enough money"};
  f.money -= w.cost; f.spent += w.cost;
  f.weapon = item; f.ammo[item] = w.mag;
  f.reserve[item] = w.reserve; f.shotIndex = 0;
  f.reloading = 0;
  this.emit({type: "buy",id: f.id,item: item,cost: w.cost});
  return {ok: true,item: item};}
 spawnZone(f) {
  const spawns = f.team === TEAM.WARDEN ? SPAWNS.warden : SPAWNS.cinder; const c = spawns[0];
  return Math.hypot(f.pos.x - c[0], f.pos.z - c[2]) < 15;}
 applyPlayerInput(input, dt) {
  const f = this.player; if (!f.alive) return;
  if (input.mouseDX !== 0 || input.mouseDY !== 0) {
   f.yaw -= input.mouseDX * input.sensitivity;
   f.pitch = clamp(f.pitch - input.mouseDY * input.sensitivity, -1.5, 1.5);}
  this.advanceReload(f, dt); if (f.fireCooldown > 0) f.fireCooldown -= dt;
  f.spreadBloom = Math.max(0, f.spreadBloom - dt * 0.055); const w = WEAPONS[f.weapon];
  f.recoilPitch = Math.max(0, f.recoilPitch - dt * w.recoilRecover);
  f.recoilYaw = damp(f.recoilYaw, 0, w.recoilRecover * 0.8, dt);
  f.shotKick = Math.max(0, f.shotKick - dt * 6);
  const effectivePitch = clamp(f.pitch + f.recoilPitch * 0.55, -1.52, 1.52);
  const effectiveYaw = f.yaw + f.recoilYaw * 0.5;
  const moveF = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const moveS = (input.right ? 1 : 0) - (input.left ? 1 : 0); const fx = -Math.sin(f.yaw);
  const fz = -Math.cos(f.yaw); const rx = Math.cos(f.yaw);
  const rz = -Math.sin(f.yaw); const wantX = fx * moveF + rx * moveS;
  const wantZ = fz * moveF + rz * moveS; f.plantHold = input.use === true;
  f.defuseHold = input.use === true;
  this.moveFighter(f, wantX, wantZ, dt, {jump: input.jump === true,crouch: input.crouch === true,walk: input.walk === true});
  this.playerAim = {yaw: effectiveYaw,pitch: effectivePitch};
  if (input.fire === true && this.phase === "live") {
   const fired = this.tryFireFrom(f, effectiveYaw, effectivePitch, {held: input.fireHeld === true});
   if (fired) this.playerViewKick = (this.playerViewKick ?? 0) + WEAPONS[f.weapon].recoilUp;}
  if (input.reload === true) this.beginReload(f);}
 tryFireFrom(f, yaw, pitch, opts) {
  const savedYaw = f.yaw; const savedPitch = f.pitch;
  f.yaw = yaw; f.pitch = pitch;
  const ok = this.tryFire(f, opts); f.yaw = savedYaw;
  f.pitch = savedPitch; return ok;}
 radio(text, team = null) {
  const entry = {text: text,at: this.time,team: team};
  this.radioFeed.unshift(entry); if (this.radioFeed.length > 3) this.radioFeed.pop();
  this.emit({type: "radio",text: text,team: team});}}
export function angleDiff(a, b) {
 let d = a - b; while (d > Math.PI) d -= Math.PI * 2;
 while (d < -Math.PI) d += Math.PI * 2; return d;}
export function turnToward(current, target, maxStep) {
 const d = angleDiff(target, current); if (Math.abs(d) <= maxStep) return target;
 return current + Math.sign(d) * maxStep;}
for (const [k, v] of Object.entries({ ...bomb, ...rounds, ...grenade, ...bots})) Match.prototype[k] = v;

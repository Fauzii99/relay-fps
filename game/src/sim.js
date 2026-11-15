import { TICK, TEAM, WEAPONS, BUY, UTIL, MATCH, SITES, SPAWNS, MOVE, BOT, HEADSHOT_MULT, SQUAD } from "./config.js";
import { CollisionWorld } from "./collision.js";
import { raycastFighter, damageAtRange, applyDamage, recoilForShot } from "./combat.js";
import { createRng, clamp, damp } from "./rng.js";
import { findPath, smoothPath, nearestNode, nodesNear, clearPathCache } from "./nav.js";
import { COVER, WAYPOINTS } from "./map.js";
const ZERO = { x: 0, y: 0, z: 0 };
function makeFighter(id, team, name, role, isPlayer = false) {
 return {
  id: id,
  team: team,
  name: name,
  role: role,
  isPlayer: isPlayer,
  pos: { x: 0, y: 0, z: 0, ...ZERO },
  vel: { x: 0, y: 0, z: 0 },
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
  ammo: { sidearm: WEAPONS.sidearm.mag },
  reserve: { sidearm: WEAPONS.sidearm.reserve },
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
  damageDealt: 0,
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
  lastPos: { x: 0, z: 0 },
  footstepIn: 0,
  shotKick: 0
 };
}
const OWNED_ORDER = [ "marksman", "rifle", "smg", "sidearm" ];
const NAMES = { warden: [ "VOSS", "KESTREL", "HALDEN", "ORRIN", "MIRA", "TALC" ], cinder: [ "RAZE", "BRUTE", "SABLE", "KORVIN", "ASH", "DREK" ] };
export class Match {
 constructor({seed: seed = 1337, playerTeam: playerTeam = TEAM.WARDEN, demo: demo = false, onEvent: onEvent = null} = {}) {
  this.seed = seed; this.rng = createRng(seed);
  this.world = new CollisionWorld; this.onEvent = onEvent;
  this.playerTeam = playerTeam; this.enemyTeam = playerTeam === TEAM.WARDEN ? TEAM.CINDER : TEAM.WARDEN;
  this.demo = demo; this.fighters = [];
  this.nextId = 1; this.time = 0;
  this.ticks = 0; this.phase = "buy";
  this.phaseT = 0; this.round = 1;
  this.score = { warden: 0, cinder: 0 };
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
   defused: false
  }; this.events = [];
  this.killfeed = []; this.radioFeed = [];
  this.spotted = new Set; this.shots = [];
  this.impacts = []; this.tracers = [];
  this.damageMarkers = []; this.smokes = [];
  this.frags = []; this.roundWinner = null;
  this.roundReason = ""; this.matchWinner = null;
  this.plantSpot = null; this.defuseSpot = null;
  this.buildTeams(); this.startRound();
 }
 emit(event) {
  this.events.push(event); if (this.onEvent !== null) this.onEvent(event);
 }
 buildTeams() {
  for (let i = 0; i < SQUAD; i++) {
   const isPlayer = i === 0; const role = i === SQUAD - 1 ? "heavy" : "line";
   const w = makeFighter(this.nextId++, this.playerTeam, isPlayer ? "YOU" : NAMES[this.playerTeam][i], role, isPlayer);
   this.fighters.push(w);
  }
  for (let i = 0; i < SQUAD; i++) {
   const role = i === SQUAD - 1 ? "heavy" : "line";
   const c = makeFighter(this.nextId++, this.enemyTeam, NAMES[this.enemyTeam][i], role, false);
   this.fighters.push(c);
  }
  this.player = this.fighters[0];
 }
 squad(team) {
  return this.fighters.filter(f => f.team === team);
 }
 byId(id, living = true) {
  const f = this.fighters[id - 1]; if (f === void 0 || f.id !== id) return null;
  return living && !f.alive ? null : f;
 }
 aliveCount(team) {
  let n = 0; for (const f of this.fighters) if (f.team === team && f.alive) n++;
  return n;
 }
 startRound() {
  clearPathCache(); this.phase = "buy";
  this.phaseT = 0; this.roundStartTime = this.time;
  this.roundWinner = null; this.roundReason = "";
  this.spotted.clear(); this.smokes.length = 0;
  this.frags.length = 0; this.shots.length = 0;
  this.impacts.length = 0; this.tracers.length = 0;
  this.beacon.carrier = null; this.beacon.planted = false;
  this.beacon.planting = false; this.beacon.defusing = false;
  this.beacon.site = null; this.beacon.timer = 0;
  this.beacon.plantT = 0; this.beacon.defuseT = 0;
  this.beacon.detonated = false; this.beacon.defused = false;
  const attackingTeam = this.round % 2 === 1 ? this.playerTeam === TEAM.WARDEN ? TEAM.CINDER : TEAM.WARDEN : this.playerTeam;
  this.attackingTeam = attackingTeam;
  this.defendingTeam = attackingTeam === TEAM.WARDEN ? TEAM.CINDER : TEAM.WARDEN;
  const wardenSpawn = SPAWNS.warden; const cinderSpawn = SPAWNS.cinder;
  const slotOf = { warden: 0, cinder: 0 };
  for (const f of this.fighters) {
   const spawns = f.team === TEAM.WARDEN ? wardenSpawn : cinderSpawn;
   const s = spawns[slotOf[f.team]++ % spawns.length];
   const clear = this.world.resolve(s[0], s[2], MOVE.radius + 0.5, 0, MOVE.standHeight, MOVE.stepHeight);
   f.pos = { x: clear.x, y: s[1], z: clear.z };
   f.vel = { x: 0, y: 0, z: 0 };
   f.alive = true; f.health = MOVE.maxHealth;
   f.armor = f.hasKevlar ? 100 : 0; f.crouch = 0;
   f.grounded = true; f.reloading = 0;
   f.fireCooldown = 0; f.recoilPitch = 0;
   f.recoilYaw = 0; f.spreadBloom = 0;
   f.shotIndex = 0; f.kills = 0;
   f.deaths = 0; f.damageDealt = 0;
   f.spent = 0; f.utilHeld = null;
   f.plantProgress = 0; f.defuseProgress = 0;
   f.state = "advance";
   f.lastPos = { x: s[0], z: s[2] };
   f.yaw = Math.atan2(-(0 - s[0]), -(6 - s[2])); f.pitch = 0;
   f.aimError = BOT.aimErrorBase; f.repathIn = 0;
   f.target = null; f.goal = null;
   f.path = []; f.pathIdx = 0;
   f.holdSpot = null; f.ammo[f.weapon] = WEAPONS[f.weapon].mag;
   f.reserve[f.weapon] = WEAPONS[f.weapon].reserve;
  }
  const attackers = this.squad(attackingTeam).filter(f => f.alive);
  const carrier = attackers.reduce((best, f) => {
   const d = Math.hypot(f.pos.x, f.pos.z - 6);
   return best === null || d < best.d ? { f: f, d: d } : best;
  }, null); if (carrier !== null) this.beacon.carrier = carrier.f.id;
  this.pickRoundPlan();
  this.emit({ type: "roundStart", round: this.round, attackingTeam: attackingTeam, defendingTeam: this.defendingTeam });
  this.radio(`${this.round === 1 ? "Match start." : `Round ${this.round}.`} ${attackingTeam === this.playerTeam ? "We take the beacon to A or B." : "They will come for the beacon. Hold the sites."}`);
 }
 pickRoundPlan() {
  const sites = [ "A", "B" ]; const pick = this.rng.next() < 0.5 ? 0 : 1;
  this.plan = { site: sites[(this.round + pick) % 2], lane: this.round % 3 === 0 ? "mid" : "lane" };
  if (this.demo) this.plan.site = "B"; const defenders = this.squad(this.defendingTeam);
  const perSite = [ "A", "B" ];
  defenders.forEach((f, i) => {
   if (i < 2) {
    f.lane = perSite[i % 2]; f.state = "hold";
    f.holdSpot = COVER.find(c => c.lane === f.lane) ?? null;
   } else if (i === 2) {
    f.lane = "mid"; f.state = "hold";
    f.holdSpot = COVER.find(c => c.lane === "mid" && c.z > 0) ?? null;
   } else {
    f.lane = i % 2 === 0 ? "A" : "B"; f.state = "rotate";
   }
  }); const attackers = this.squad(this.attackingTeam);
  attackers.forEach((f, i) => {
   f.lane = i === 0 ? "mid" : i % 2 === 0 ? this.plan.site : "mid"; f.state = "advance";
   f.holdSpot = null;
  }); this.plan.attackers = attackers.map(f => f.id);
 }
 step(dt) {
  this.time += dt; this.phaseT += dt;
  this.ticks++; this.pruneEffects(dt);
  if (this.phase === "matchEnd") return;
  if (this.phase === "buy") {
   this.updateBotsBuy();
   if (this.phaseT >= MATCH.buyPhase) {
    this.phase = "live"; this.phaseT = 0;
    this.emit({ type: "phase", phase: "live", round: this.round });
    this.radio("Buy phase closed. Move up.");
   }
   this.updateBots(dt, false); this.updateBeacon(dt);
   return;
  }
  if (this.phase === "roundEnd") {
   this.updateBots(dt, false);
   if (this.phaseT >= MATCH.endPause) if (this.score.warden >= MATCH.roundsToWin || this.score.cinder >= MATCH.roundsToWin) {
    this.matchWinner = this.score.warden > this.score.cinder ? TEAM.WARDEN : TEAM.CINDER;
    this.phase = "matchEnd";
    this.emit({ type: "matchEnd", winner: this.matchWinner, score: { ...this.score } });
   } else {
    this.round++; this.startRound();
   }
   return;
  }
  this.updateBots(dt, true); this.updateBeacon(dt);
  this.pushOutOfSolids();
  this.updateProjectiles(dt); this.checkRoundEnd();
 }
 pushOutOfSolids() {
  const solve = f => {
   const solved = this.world.resolve(f.pos.x, f.pos.z, MOVE.radius, f.pos.y, f.crouch > 0.5 ? MOVE.crouchHeight : MOVE.standHeight, MOVE.stepHeight);
   f.pos.x = solved.x; f.pos.z = solved.z;
  };
  for (const f of this.fighters) solve(f);
  for (let pass = 0; pass < 2; pass++) {
   for (const f of this.fighters) for (const o of this.fighters) {
    if (o === f || !o.alive || !f.alive) continue;
    const dx = f.pos.x - o.pos.x, dz = f.pos.z - o.pos.z, d = Math.hypot(dx, dz);
    const want = MOVE.radius * 2 + 0.1;
    if (d > want || d < 1e-5) continue;
    const push = (want - d) * 0.5; f.pos.x += dx / d * push; f.pos.z += dz / d * push;
   }
   for (const f of this.fighters) solve(f);
  }
 }
 pruneEffects(dt) {
  for (let i = this.tracers.length - 1; i >= 0; i--) {
   this.tracers[i].life -= dt; if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
  }
  for (let i = this.impacts.length - 1; i >= 0; i--) {
   this.impacts[i].life -= dt; if (this.impacts[i].life <= 0) this.impacts.splice(i, 1);
  }
  for (let i = this.damageMarkers.length - 1; i >= 0; i--) {
   this.damageMarkers[i].life -= dt; if (this.damageMarkers[i].life <= 0) this.damageMarkers.splice(i, 1);
  }
  for (let i = this.smokes.length - 1; i >= 0; i--) {
   const s = this.smokes[i];
   if (s.armed) s.life -= dt; else {
    s.fuse -= dt;
    if (s.fuse <= 0) {
     s.armed = true; s.life = UTIL.smoke.duration;
     this.emit({ type: "smokePop", x: s.x, y: s.y, z: s.z, owner: s.owner, team: s.team });
    }
   }
   if (s.armed && s.life <= 0) this.smokes.splice(i, 1);
  }
  for (let i = this.frags.length - 1; i >= 0; i--) {
   const f = this.frags[i];
   if (!f.armed) {
    f.fuse -= dt; if (f.fuse <= 0) this.detonateFrag(f);
   }
  }
 }
 moveFighter(f, wantX, wantZ, dt, {jump: jump = false, crouch: crouch = false, walk: walk = false} = {}) {
  if (!f.alive) return;
  const speedBase = crouch ? MOVE.duckSpeed : walk ? MOVE.walkSpeed * 0.52 : MOVE.walkSpeed;
  const weaponSpeed = WEAPONS[f.weapon]?.moveSpeed ?? 1; const maxSpeed = speedBase * weaponSpeed;
  const targetLen = Math.hypot(wantX, wantZ); let tx = 0;
  let tz = 0;
  if (targetLen > 1e-5) {
   tx = wantX / targetLen * maxSpeed; tz = wantZ / targetLen * maxSpeed;
  }
  if (f.grounded) {
   const accel = MOVE.accelerate; f.vel.x += clamp(tx - f.vel.x, -accel * dt, accel * dt);
   f.vel.z += clamp(tz - f.vel.z, -accel * dt, accel * dt);
   if (targetLen < 1e-5) {
    const sp = Math.hypot(f.vel.x, f.vel.z); const drop = MOVE.friction * dt;
    const ns = Math.max(0, sp - drop); const k = sp > 1e-5 ? ns / sp : 0;
    f.vel.x *= k; f.vel.z *= k;
   }
  } else {
   f.vel.x += clamp(tx - f.vel.x, -MOVE.airAccel * dt, MOVE.airAccel * dt);
   f.vel.z += clamp(tz - f.vel.z, -MOVE.airAccel * dt, MOVE.airAccel * dt);
  }
  if (jump && f.grounded) {
   f.vel.y = MOVE.jumpSpeed; f.grounded = false;
  }
  f.vel.y -= MOVE.gravity * dt; const height = crouch ? MOVE.crouchHeight : MOVE.standHeight;
  let nx = f.pos.x + f.vel.x * dt; let nz = f.pos.z + f.vel.z * dt;
  const solved = this.world.resolve(nx, nz, MOVE.radius, f.pos.y, height, MOVE.stepHeight); nx = solved.x;
  nz = solved.z; let ny = f.pos.y + f.vel.y * dt;
  const support = this.world.supportHeight(nx, nz, MOVE.radius, f.pos.y + 0.02, MOVE.stepHeight);
  if (ny <= support + 1e-4) {
   ny = support; if (f.vel.y < 0) f.vel.y = 0;
   f.grounded = true;
  } else f.grounded = false; nx = clamp(nx, -39.2, 39.2);
  nz = clamp(nz, -47.2, 47.2); const horiz = Math.hypot(f.vel.x, f.vel.z);
  if (f.grounded && horiz > 1.2) {
   f.footstepIn -= dt * (crouch ? 0.5 : walk ? 0.7 : horiz / 3.4);
   if (f.footstepIn <= 0) {
    f.footstepIn = 0.54;
    this.emit({ type: "footstep", id: f.id, x: nx, y: ny, z: nz, running: horiz > 6.4, crouch: crouch });
   }
  } else f.footstepIn = 0; f.pos.x = nx;
  f.pos.y = ny; f.pos.z = nz;
  f.ducking = crouch; f.walking = walk;
  f.crouch = damp(f.crouch, crouch ? 1 : 0, 14, dt);
 }
 currentSpread(f) {
  const w = WEAPONS[f.weapon]; const speed = Math.hypot(f.vel.x, f.vel.z);
  const moveFactor = clamp(speed / MOVE.walkSpeed, 0, 1); let spread = w.spreadBase;
  spread += w.spreadMove * moveFactor; if (!f.grounded) spread += w.spreadAir;
  spread -= (w.spreadBase - w.spreadCrouch) * f.crouch; spread += f.spreadBloom;
  return Math.max(0.0004, spread);
 }
 tryFire(f, {held: held = false} = {}) {
  if (!f.alive || this.phase !== "live") return false; const w = WEAPONS[f.weapon];
  if (f.reloadDur > 0) return false; if (f.fireCooldown > 0) return false;
  if (!w.auto && held && f.lastShotAt !== void 0 && this.time - f.lastShotAt < 0.09) return false;
  const mag = f.ammo[f.weapon] ?? 0;
  if (mag <= 0) {
   if (f.isPlayer) this.emit({ type: "dryFire", id: f.id });
   return false;
  }
  f.ammo[f.weapon] = mag - 1; f.fireCooldown = 60 / w.rpm;
  f.lastShotAt = this.time; f.recoilPitch += w.recoilUp * recoilForShot(f.shotIndex).up;
  f.recoilYaw += w.recoilSide * recoilForShot(f.shotIndex).side;
  f.spreadBloom = Math.min(w.spreadBase * 3.4, f.spreadBloom + w.recoilUp * 0.42); f.shotIndex++;
  f.shotKick = 1; const spread = this.currentSpread(f);
  const [cx, cy] = this.rng.cone(spread); const yaw = f.yaw + Math.atan(cx);
  const pitch = clamp(f.pitch + Math.atan(cy), -1.52, 1.52);
  const dir = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
  const eyeY = f.pos.y + (f.ducking ? MOVE.eyeCrouch : MOVE.eyeStand) - f.crouch * 0.42;
  const origin = { x: f.pos.x, y: eyeY, z: f.pos.z };
  const maxDist = w.range * 3;
  const wallHit = this.world.raycast(origin, dir, maxDist, b => b.kind === "rail" && b.y1 < origin.y);
  const wallT = wallHit === null ? maxDist : wallHit.t; let bestFighter = null;
  let bestHit = null;
  for (const other of this.fighters) {
   if (other === f || !other.alive || other.team === f.team) continue;
   const hit = raycastFighter(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, wallT, other);
   if (hit !== null && (bestHit === null || hit.t < bestHit.t)) {
    bestHit = hit; bestFighter = other;
   }
  }
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
   life: 0.16
  };
  if (bestFighter !== null && bestHit !== null) {
   const dist = bestHit.t; let dmg = damageAtRange(w, dist);
   dmg *= bestHit.mult; const res = applyDamage(bestFighter, dmg, bestHit.zone);
   f.damageDealt += res.dealt; shot.endX = origin.x + dir.x * dist;
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
    team: f.team
   });
   if (bestFighter.isPlayer) {
    this.damageMarkers.push({ life: 0.9, fromX: f.pos.x, fromZ: f.pos.z });
    this.emit({ type: "damageTaken", from: f.id, amount: res.dealt, zone: bestHit.zone });
   }
   if (bestFighter.alive) {
    bestFighter.lastAttacker = f.id; bestFighter.lastHurtAt = this.time;
    if (!bestFighter.isPlayer && bestFighter.target === null) {
     bestFighter.target = f.id; bestFighter.targetSeenAt = this.time;
     bestFighter.reactionUntil = this.time + 0.16;
    }
   }
   if (res.killed) this.killFighter(bestFighter, f, bestHit.zone, f.weapon);
  } else if (wallHit !== null) {
   shot.endX = wallHit.x; shot.endY = wallHit.y;
   shot.endZ = wallHit.z;
   this.impacts.push({ x: wallHit.x, y: wallHit.y, z: wallHit.z, nx: wallHit.nx, ny: wallHit.ny, nz: wallHit.nz, life: 0.5, kind: "wall" });
   this.emit({ type: "impact", x: wallHit.x, y: wallHit.y, z: wallHit.z, nx: wallHit.nx, ny: wallHit.ny, nz: wallHit.nz });
   this.alertBotsNear(wallHit.x, wallHit.y, wallHit.z, f);
  } else {
   shot.endX = origin.x + dir.x * maxDist; shot.endY = origin.y + dir.y * maxDist;
   shot.endZ = origin.z + dir.z * maxDist; shot.hitWall = false;
  }
  this.shots.push(shot); if (this.shots.length > 90) this.shots.shift();
  this.tracers.push({ x1: shot.x, y1: shot.y, z1: shot.z, x2: shot.endX, y2: shot.endY, z2: shot.endZ, life: 0.075, weapon: f.weapon, team: f.team });
  this.emit({ type: "shot", id: f.id, weapon: f.weapon, x: origin.x, y: origin.y, z: origin.z, team: f.team });
  return true;
 }
 advanceReload(f, dt) {
  if (f.reloadDur <= 0) return; f.reloading = Math.max(0, f.reloading - dt);
  if (f.reloading === 0) this.finishReload(f);
 }
 beginReload(f) {
  if (!f.alive || f.reloadDur > 0) return false; const w = WEAPONS[f.weapon];
  const reserve = f.reserve[f.weapon] ?? 0; const mag = f.ammo[f.weapon] ?? 0;
  if (reserve <= 0 || mag >= w.mag) return false; f.reloading = w.reloadTime;
  f.reloadDur = w.reloadTime; f.reloadStage = 0;
  this.emit({ type: "reloadStart", id: f.id, weapon: f.weapon, duration: w.reloadTime });
  return true;
 }
 finishReload(f) {
  const w = WEAPONS[f.weapon]; const need = w.mag - (f.ammo[f.weapon] ?? 0);
  const take = Math.min(need, f.reserve[f.weapon] ?? 0); f.ammo[f.weapon] = (f.ammo[f.weapon] ?? 0) + take;
  f.reserve[f.weapon] = (f.reserve[f.weapon] ?? 0) - take; f.reloading = 0;
  f.reloadDur = 0;
  this.emit({ type: "reloadEnd", id: f.id, weapon: f.weapon });
 }
 switchWeapon(f, slot) {
  if (!f.alive) return false;
  const want = slot === 1 ? "primary" : slot === 2 ? "sidearm" : "util";
  const owned = k => (f.ammo[k] ?? 0) + (f.reserve[k] ?? 0) > 0;
  let pick = null;
  if (want === "primary") pick = OWNED_ORDER.find(k => k !== "sidearm" && owned(k)) ?? null;
  else if (want === "sidearm") pick = owned("sidearm") ? "sidearm" : null;
  else pick = OWNED_ORDER.find(k => k !== "sidearm" && owned(k)) ?? (owned("sidearm") ? "sidearm" : null);
  if (pick === null || pick === f.weapon) return false;
  f.reloadDur = 0; f.reloading = 0;
  f.fireCooldown = Math.max(f.fireCooldown, 0.28);
  f.weapon = pick; f.shotIndex = 0;
  this.emit({ type: "weaponSwitch", id: f.id, weapon: pick });
  return true;
 }
 killFighter(victim, killer, zone, weapon) {
  if (!victim.alive) return; victim.alive = false;
  victim.health = 0; victim.deaths++;
  victim.reloading = 0; victim.utilHeld = null;
  victim.crouch = 0;
  this.emit({ type: "death", id: victim.id, x: victim.pos.x, y: victim.pos.y, z: victim.pos.z, team: victim.team });
  if (this.beacon.carrier === victim.id) {
   this.beacon.carrier = null;
   this.plantSpot = { x: victim.pos.x, z: victim.pos.z };
   this.emit({ type: "beaconDrop", x: victim.pos.x, z: victim.pos.z });
  }
  if (killer !== null && killer.id !== victim.id) {
   if (killer.team === victim.team) {
    killer.money = Math.max(0, killer.money - MATCH.teamKillPenalty); killer.kills--;
   } else {
    killer.kills++; const w = WEAPONS[weapon];
    killer.money = Math.min(MATCH.maxMoney, killer.money + (w?.killReward ?? 300));
    this.radio(`${killer.name} downed ${victim.name}${zone === "head" ? " with a headshot" : ""}.`, killer.team);
   }
   this.killfeed.unshift({
    killer: killer.name,
    killerTeam: killer.team,
    weapon: WEAPONS[weapon]?.name ?? weapon,
    victim: victim.name,
    victimTeam: victim.team,
    head: zone === "head",
    at: this.time,
    mine: killer.isPlayer || victim.isPlayer
   }); if (this.killfeed.length > 6) this.killfeed.pop();
   this.emit({ type: "killfeed", entry: this.killfeed[0] });
  } else {
   this.killfeed.unshift({ killer: null, killerTeam: null, weapon: "world", victim: victim.name, victimTeam: victim.team, head: false, at: this.time, mine: victim.isPlayer });
   this.emit({ type: "killfeed", entry: this.killfeed[0] });
  }
 }
 checkRoundEnd() {
  if (this.phase !== "live") return; const wAlive = this.aliveCount(TEAM.WARDEN);
  const cAlive = this.aliveCount(TEAM.CINDER);
  if (this.beacon.planted) {
   if (this.beacon.detonated) {
    this.endRound(this.attackingTeam, "beacon detonated"); return;
   }
   if (this.beacon.defused) {
    this.endRound(this.defendingTeam, "beacon defused"); return;
   }
   if (this.aliveCount(this.defendingTeam) === 0) return; return;
  }
  if (wAlive === 0) {
   this.endRound(TEAM.CINDER, "Aster Wardens eliminated"); return;
  }
  if (cAlive === 0) {
   this.endRound(TEAM.WARDEN, "Cinder Pact eliminated"); return;
  }
  if (this.phaseT >= MATCH.roundTime) this.endRound(TEAM.WARDEN === this.defendingTeam ? TEAM.WARDEN : TEAM.CINDER, "time expired, beacon secure");
 }
 endRound(winner, reason) {
  if (this.phase === "roundEnd" || this.phase === "matchEnd") return; this.phase = "roundEnd";
  this.phaseT = 0; this.roundWinner = winner;
  this.roundReason = reason; this.score[winner]++;
  this.roundHistory.push({ round: this.round, winner: winner, reason: reason, score: { ...this.score } });
  const loser = winner === TEAM.WARDEN ? TEAM.CINDER : TEAM.WARDEN; const winTeam = this.squad(winner);
  const loseTeam = this.squad(loser);
  for (const f of winTeam) {
   let pay = MATCH.winReward;
   if (this.beacon.detonated && f.team === this.attackingTeam) pay += MATCH.plantReward;
   if (this.beacon.defused && f.team === this.defendingTeam) pay += MATCH.defuseReward;
   f.money = Math.min(MATCH.maxMoney, f.money + pay); f.hasKevlar = f.armor > 0;
  }
  this.lossStreak ??= { warden: 0, cinder: 0 };
  this.lossStreak[loser] = (this.lossStreak[loser] ?? 0) + 1; this.lossStreak[winner] = 0;
  const lossPay = Math.min(MATCH.lossRewardMax, MATCH.lossRewardBase + MATCH.lossRewardStep * Math.max(0, this.lossStreak[loser] - 1));
  for (const f of loseTeam) {
   f.money = Math.min(MATCH.maxMoney, f.money + lossPay); f.hasKevlar = f.armor > 0;
  }
  this.emit({ type: "roundEnd", winner: winner, loser: loser, reason: reason, score: { ...this.score }, lossPay: lossPay, round: this.round });
  this.radio(winner === this.playerTeam ? `${reason}. Round ours.` : `${reason}. They take it. Reset.`, this.playerTeam);
  if (winner === this.playerTeam) this.emit({ type: "stinger", kind: "win" }); else this.emit({ type: "stinger", kind: "loss" });
 }
 nearestSite(x, z, radius = null) {
  let best = null;
  for (const key of [ "A", "B" ]) {
   const site = SITES[key]; const d = Math.hypot(x - site.center[0], z - site.center[2]);
   const r = radius ?? site.radius;
   if (d <= r && (best === null || d < best.d)) best = { site: site, d: d };
  }
  return best;
 }
 updateBeacon(dt) {
  const b = this.beacon; if (this.phase !== "live") return;
  if (b.carrier === null && !b.planted && this.plantSpot !== null) for (const f of this.fighters) {
   if (!f.alive || f.team !== this.attackingTeam) continue;
   const d = Math.hypot(f.pos.x - this.plantSpot.x, f.pos.z - this.plantSpot.z);
   if (d < 1.5) {
    b.carrier = f.id; this.plantSpot = null;
    this.emit({ type: "beaconPickup", id: f.id });
    break;
   }
  }
  if (b.planted) {
   const onBeacon = f => f.alive && f.team === this.defendingTeam && f.defuseHold === true && Math.hypot(f.pos.x - b.x, f.pos.z - b.z) < 1.7;
   let defuser;
   for (const f of this.fighters) if (onBeacon(f)) {
    defuser = f; break;
   }
   if (b.defuseT > 0) if (defuser === void 0) {
    b.defuseT = 0; b.defusing = false;
    this.emit({ type: "defuseCancel" });
   } else {
    b.defusing = true; b.defuseT = Math.max(0, b.defuseT - dt);
    if (b.defuseT === 0) {
     b.defused = true; b.defusing = false;
     this.emit({ type: "defused", x: b.x, z: b.z, by: defuser.id });
     this.radio("Beacon is defused. Sites are ours.", this.defendingTeam);
     defuser.money = Math.min(MATCH.maxMoney, defuser.money + MATCH.defuseReward);
    }
   } else if (defuser !== void 0) {
    b.defuseT = MATCH.defuseTime; b.defusing = true;
    this.emit({ type: "defuseStart", id: defuser.id });
   }
   if (!b.defused) {
    b.timer = Math.max(0, b.timer - dt);
    if (b.timer === 0 && !b.detonated) {
     b.detonated = true;
     this.emit({ type: "detonation", x: b.x, z: b.z });
     this.damageInRadius(b.x, b.z, 16, 220, null, "beacon");
    }
   }
   return;
  }
  const carrier = b.carrier === null ? null : this.byId(b.carrier);
  if (carrier === null) {
   b.planting = false; return;
  }
  const inSite = this.nearestSite(carrier.pos.x, carrier.pos.z);
  const holding = carrier.plantHold === true && inSite !== null && carrier.grounded; b.planting = holding;
  if (holding) {
   carrier.plantProgress = Math.min(MATCH.plantTime, carrier.plantProgress + dt);
   b.plantT = carrier.plantProgress;
   if (carrier.plantProgress >= MATCH.plantTime) {
    b.planted = true; b.site = inSite.site.id;
    b.x = carrier.pos.x; b.z = carrier.pos.z;
    b.timer = MATCH.bombTime; b.carrier = null;
    this.emit({ type: "planted", site: b.site, x: b.x, z: b.z, by: carrier.id });
    this.radio(`Beacon is planted on ${inSite.site.label}. Hold it.`, carrier.team);
    carrier.money = Math.min(MATCH.maxMoney, carrier.money + MATCH.plantReward);
   }
  } else if (!holding) {
   carrier.plantProgress = Math.max(0, carrier.plantProgress - dt * 1.6); b.plantT = carrier.plantProgress;
  }
 }
 throwUtil(f, kind) {
  if (!f.alive || this.phase !== "live") return false; if (kind === "smoke" && f.smoke <= 0) return false;
  if (kind === "frag" && f.frag <= 0) return false; if (kind === "smoke") f.smoke--; else f.frag--;
  const dir = { x: -Math.sin(f.yaw) * Math.cos(f.pitch), y: Math.sin(f.pitch), z: -Math.cos(f.yaw) * Math.cos(f.pitch) };
  const eyeY = f.pos.y + (f.ducking ? MOVE.eyeCrouch : MOVE.eyeStand) - f.crouch * 0.42;
  const origin = { x: f.pos.x + dir.x * 0.45, y: eyeY - 0.12, z: f.pos.z + dir.z * 0.45 };
  const speed = kind === "smoke" ? 15.5 : 18.0;
  const vel = { x: dir.x * speed, y: dir.y * speed + 3.4, z: dir.z * speed };
  const canister = {
   x: origin.x,
   y: origin.y,
   z: origin.z,
   vx: vel.x,
   vy: vel.y,
   vz: vel.z,
   bounces: 0,
   owner: f.id,
   team: f.team,
   fuse: kind === "smoke" ? UTIL.smoke.fuse : UTIL.frag.fuse,
   armed: false,
   life: 0,
   resting: false
  };
  if (kind === "smoke") this.smokes.push({ ...canister, kind: "smoke" }); else {
   canister.id = this.nextId++;
   this.frags.push({ ...canister, kind: "frag" });
  }
  this.emit({ type: "utilThrow", owner: f.id, kind: kind, x: origin.x, y: origin.y, z: origin.z, team: f.team });
  return true;
 }
 updateProjectiles(dt) {
  const integrate = c => {
   if (c.armed) return;
   if (!c.resting) {
    c.vy -= 22 * dt; let nx = c.x + c.vx * dt;
    let nz = c.z + c.vz * dt; let ny = c.y + c.vy * dt;
    const solved = this.world.resolve(nx, nz, 0.16, c.y, 0.3, 0.2);
    if (solved.x !== nx || solved.z !== nz) {
     c.vx *= -0.42; c.vz *= -0.42;
     nx = solved.x; nz = solved.z;
    }
    const floor = this.world.supportHeight(nx, nz, 0.16, c.y + 0.1, 0.25);
    if (ny <= floor + 0.09) {
     ny = floor + 0.09;
     if (Math.abs(c.vy) > 1.2) {
      c.vy = 0.36 * -c.vy; c.vx *= 0.62;
      c.vz *= 0.62; c.bounces++;
      this.emit({ type: "utilBounce", kind: c.kind, x: nx, y: ny, z: nz });
     } else {
      c.vy = 0; c.vx *= 0.86;
      c.vz *= 0.86; c.resting = Math.hypot(c.vx, c.vz) < 0.45;
     }
    }
    c.x = clamp(nx, -38.4, 38.4); c.z = clamp(nz, -46.4, 46.4);
    c.y = ny;
   }
  }; for (const s of this.smokes) integrate(s);
  for (const f of this.frags) integrate(f);
 }
 detonateFrag(frag) {
  frag.armed = true; const idx = this.frags.indexOf(frag);
  if (idx >= 0) this.frags.splice(idx, 1);
  const owner = frag.owner === null ? null : this.byId(frag.owner, false);
  this.emit({ type: "fragExplode", x: frag.x, y: frag.y, z: frag.z });
  this.damageInRadius(frag.x, frag.z, UTIL.frag.radius, UTIL.frag.damage, owner, "frag");
 }
 damageInRadius(x, z, radius, maxDamage, owner, kind) {
  for (const f of this.fighters) {
   if (!f.alive) continue; const d = Math.hypot(f.pos.x - x, f.pos.z - z);
   if (d > radius) continue;
   if (!this.world.lineOfSight(x, 0.6, z, f.pos.x, f.pos.y + 1.1, f.pos.z, b => b.kind === "rail")) continue;
   const falloff = 1 - Math.max(0, d - UTIL.frag.falloffFrom) / radius;
   const dmg = maxDamage * Math.max(0.12, falloff);
   if (owner !== null && owner.team === f.team) {
    const friendly = dmg * 0.4; const res = applyDamage(f, friendly, "torso");
    if (f.isPlayer) this.emit({ type: "damageTaken", from: owner.id, amount: res.dealt, zone: "frag" });
    if (res.killed) this.killFighter(f, null, "torso", "frag");
   } else {
    const res = applyDamage(f, dmg, "torso"); if (owner !== null) owner.damageDealt += res.dealt;
    if (f.isPlayer) {
     this.damageMarkers.push({ life: 0.9, fromX: x, fromZ: z });
     this.emit({ type: "damageTaken", from: owner?.id ?? null, amount: res.dealt, zone: "frag" });
    }
    if (res.killed) this.killFighter(f, owner, "torso", kind === "beacon" ? "beacon" : "frag");
   }
  }
 }
 buy(f, item) {
  if (!f.alive) return { ok: false, reason: "down" };
  if (this.phase !== "buy" && !(this.phase === "live" && this.phaseT < 3)) return { ok: false, reason: "closed" };
  if (!this.spawnZone(f)) return { ok: false, reason: "away from spawn" };
  if (item === "kevlar") {
   if (f.hasKevlar && f.armor > 0) return { ok: false, reason: "already have a vest" };
   if (f.money < BUY.kevlar.cost) return { ok: false, reason: "not enough money" };
   f.money -= BUY.kevlar.cost; f.spent += BUY.kevlar.cost;
   f.armor = BUY.kevlar.armour; f.hasKevlar = true;
   this.emit({ type: "buy", id: f.id, item: item, cost: BUY.kevlar.cost });
   return { ok: true, item: item };
  }
  if (item === "smoke" || item === "frag") {
   const def = BUY[item];
   if (f[item] >= 2) return {
    ok: false,
    reason: `already carrying two ${item}s`
   };
   if (f.money < def.cost) return { ok: false, reason: "not enough money" };
   f.money -= def.cost; f.spent += def.cost;
   f[item] += def.count;
   this.emit({ type: "buy", id: f.id, item: item, cost: def.cost });
   return { ok: true, item: item };
  }
  const w = WEAPONS[item];
  if (w === void 0) return { ok: false, reason: "no such item" };
  if (f.weapon === item) return { ok: false, reason: "already carrying it" };
  if (f.money < w.cost) return { ok: false, reason: "not enough money" };
  f.money -= w.cost; f.spent += w.cost;
  f.weapon = item; f.ammo[item] = w.mag;
  f.reserve[item] = w.reserve; f.shotIndex = 0;
  f.reloading = 0;
  this.emit({ type: "buy", id: f.id, item: item, cost: w.cost });
  return { ok: true, item: item };
 }
 spawnZone(f) {
  const spawns = f.team === TEAM.WARDEN ? SPAWNS.warden : SPAWNS.cinder; const c = spawns[0];
  return Math.hypot(f.pos.x - c[0], f.pos.z - c[2]) < 15;
 }
 updateBotsBuy() {
  if (this.phase !== "buy") return; if (this.buyDone === this.round) return;
  const bots = this.fighters.filter(f => !f.isPlayer);
  for (const f of bots) {
   const wantArmor = !f.hasKevlar && f.money >= BUY.kevlar.cost + 900; if (wantArmor) this.buy(f, "kevlar");
   const budget = f.money; let gun = null;
   if (budget >= WEAPONS.marksman.cost && this.rng.next() < 0.28) gun = "marksman"; else if (budget >= WEAPONS.rifle.cost) gun = "rifle"; else if (budget >= WEAPONS.smg.cost) gun = "smg";
   if (gun !== null && f.weapon !== gun) this.buy(f, gun);
   if (f.money >= BUY.frag.cost + 250 && this.rng.next() < 0.55) this.buy(f, "frag");
   if (f.money >= BUY.smoke.cost + 250 && this.rng.next() < 0.4) this.buy(f, "smoke");
  }
  this.buyDone = this.round;
 }
 updateBots(dt, live) {
  for (const f of this.fighters) {
   if (f.isPlayer || !f.alive) {
    f.shotKick = Math.max(0, f.shotKick - dt * 6); this.advanceReload(f, dt);
    if (f.fireCooldown > 0) f.fireCooldown -= dt; continue;
   }
   this.updateBot(f, dt, live);
  }
 }
 updateBot(f, dt, live) {
  this.advanceReload(f, dt); if (f.fireCooldown > 0) f.fireCooldown -= dt;
  f.shotKick = Math.max(0, f.shotKick - dt * 6); f.spreadBloom = Math.max(0, f.spreadBloom - dt * 0.055);
  f.recoilPitch = Math.max(0, f.recoilPitch - dt * (WEAPONS[f.weapon].recoilRecover * 0.55));
  if (!live) {
   this.botNavigate(f, dt, 0.6); this.botAimIdle(f, dt);
   return;
  }
  const seen = this.botPerceive(f);
  if (seen !== null) {
   if (f.target !== seen.id) {
    f.target = seen.id; f.targetSeenAt = this.time;
    const skill = BOT.skill + (f.team === this.attackingTeam ? 0.03 : 0.05);
    f.reactionUntil = this.time + BOT.reactionMin + (1 - skill) * (BOT.reactionMax - BOT.reactionMin);
    f.aimError = BOT.aimErrorBase * (1.25 - skill) + this.rng.next() * 0.014;
   }
   const last = f.lastSeen ?? (f.lastSeen = { x: 0, z: 0, t: 0 });
   last.x = seen.pos.x; last.z = seen.pos.z;
   last.t = this.time; this.spotted.add(seen.id);
  } else if (f.target !== null && this.time - (f.lastSeen?.t ?? 0) > 2.4) f.target = null;
  const target = f.target === null ? null : this.byId(f.target);
  const canShoot = target !== null && this.time >= f.reactionUntil && this.botHasLOS(f, target);
  let moveX = 0; let moveZ = 0;
  let speedScale = 1;
  if (canShoot) {
   f.strafeIn -= dt;
   if (f.strafeIn <= 0) {
    f.strafeIn = BOT.strafeInterval * (0.6 + this.rng.next() * 0.8); f.strafe = this.rng.sign();
   }
   const dx = target.pos.x - f.pos.x; const dz = target.pos.z - f.pos.z;
   const d = Math.hypot(dx, dz); const strafeX = -dz / Math.max(0.001, d) * f.strafe;
   const strafeZ = dx / Math.max(0.001, d) * f.strafe;
   const wantRange = f.weapon === "sidearm" ? 12 : f.weapon === "marksman" ? 30 : 18;
   const approach = clamp((d - wantRange) / 10, -1, 1); moveX = strafeX * 0.86 + dx / d * approach * 0.7;
   moveZ = strafeZ * 0.86 + dz / d * approach * 0.7;
   const crouch = d > 22 && this.rng.next() < 0.02 ? f.crouch > 0.5 : false;
   f.wantCrouch = crouch || f.holdSpot !== null && d > 16 && f.crouch > 0.4;
   const aimY = target.pos.y + 1.32 + target.crouch * -0.2;
   const wantYaw = Math.atan2(-(target.pos.x - f.pos.x), -(target.pos.z - f.pos.z));
   const eyeY = f.pos.y + MOVE.eyeStand - f.crouch * 0.42;
   const wantPitch = Math.atan2(aimY - eyeY, Math.hypot(target.pos.x - f.pos.x, target.pos.z - f.pos.z));
   const settle = clamp((this.time - f.targetSeenAt) / BOT.aimTime, 0, 1);
   const err = f.aimError * (1 - settle * 0.82); f.aimYaw = wantYaw + Math.sin(this.time * 2.4 + f.id) * err;
   f.aimPitch = wantPitch + Math.cos(this.time * 3.1 + f.id) * err * 0.55;
   f.yaw = turnToward(f.yaw, f.aimYaw, BOT.trackSpeed * dt);
   f.pitch = turnToward(f.pitch, f.aimPitch, BOT.trackSpeed * 0.7 * dt); const settled = settle > 0.55;
   if (settled) {
    const w = WEAPONS[f.weapon]; const burstOk = w.auto ? this.rng.next() < 0.86 : this.rng.next() < 0.5;
    if (burstOk) this.tryFire(f, { held: true });
   }
   if ((f.ammo[f.weapon] ?? 0) === 0) this.beginReload(f);
   if ((f.ammo[f.weapon] ?? 0) <= 3 && (f.reserve[f.weapon] ?? 0) > 0 && target !== null) this.beginReload(f);
   if (f.frag > 0 && d > 10 && d < 26 && this.rng.next() < 0.0016) this.throwUtil(f, "frag");
   if (f.smoke > 0 && d > 16 && this.rng.next() < 0.0009) this.throwUtil(f, "smoke");
  } else {
   f.wantCrouch = false; this.botThink(f, dt);
   const nav = this.botNavigate(f, dt, speedScale); moveX = nav.x;
   moveZ = nav.z; if (nav.done) this.botHold(f, dt);
   if ((f.ammo[f.weapon] ?? 0) < WEAPONS[f.weapon].mag * 0.4 && (f.reserve[f.weapon] ?? 0) > 0) this.beginReload(f);
   this.botBeaconWork(f, dt);
  }
  this.moveFighter(f, moveX, moveZ, dt, { crouch: f.wantCrouch === true, walk: f.state === "hold" && target === null });
 }
 botPerceive(f) {
  const eyeY = f.pos.y + MOVE.eyeStand - f.crouch * 0.42; let best = null;
  let bestScore = 1 / 0;
  for (const other of this.fighters) {
   if (!other.alive || other.team === f.team) continue; const dx = other.pos.x - f.pos.x;
   const dz = other.pos.z - f.pos.z; const d = Math.hypot(dx, dz);
   if (d > BOT.viewRange) continue; const angleTo = Math.atan2(-dx, -dz);
   const delta = Math.abs(angleDiff(angleTo, f.yaw)); const fov = BOT.fovDeg * Math.PI / 180;
   if (delta > fov * 0.5 && other.id !== f.lastAttacker && f.lastHurtAt === void 0) continue;
   if (this.smokeBlocks(f.pos, other.pos)) continue; const targetY = other.pos.y + 1.2;
   if (!this.world.lineOfSight(f.pos.x, eyeY, f.pos.z, other.pos.x, targetY, other.pos.z, b => b.kind === "rail")) continue;
   const score = d - (other.id === f.target ? 6 : 0);
   if (score < bestScore) {
    bestScore = score; best = other;
   }
  }
  return best;
 }
 botHasLOS(f, other) {
  if (this.smokeBlocks(f.pos, other.pos)) return false;
  const eyeY = f.pos.y + MOVE.eyeStand - f.crouch * 0.42;
  return this.world.lineOfSight(f.pos.x, eyeY, f.pos.z, other.pos.x, other.pos.y + 1.2, other.pos.z, b => b.kind === "rail");
 }
 smokeBlocks(a, b) {
  for (const s of this.smokes) {
   if (!s.armed) continue; const dx = b.x - a.x;
   const dz = b.z - a.z; const len2 = dx * dx + dz * dz;
   if (len2 < 1e-6) continue; let t = ((s.x - a.x) * dx + (s.z - a.z) * dz) / len2;
   t = clamp(t, 0, 1); const px = a.x + dx * t;
   const pz = a.z + dz * t; if (Math.hypot(px - s.x, pz - s.z) < UTIL.smoke.radius * 0.82) return true;
  }
  return false;
 }
 botThink(f, dt) {
  f.think -= dt; if (f.think > 0) return;
  f.think = 0.4 + this.rng.next() * 0.4;
  if (f.team === this.attackingTeam) if (this.beacon.planted) {
   f.state = "hold"; const site = SITES[this.beacon.site] ?? SITES.A;
   f.goal = this.pickCoverNear(site.center[0], site.center[2]); f.goalNode = null;
  } else if (this.beacon.carrier === f.id) {
   const site = SITES[this.plan.site];
   const node = nearestNode(site.center[0] + 4 * (this.rng.next() - 0.5), site.center[2] + 4 * (this.rng.next() - 0.5));
   f.path = this.buildPath(f, node); f.goal = null;
   f.state = "advance";
  } else if (this.beacon.carrier === null && this.plantSpot !== null) {
   const node = nearestNode(this.plantSpot.x, this.plantSpot.z); f.path = this.buildPath(f, node);
   f.state = "retrieve";
  } else {
   const site = SITES[this.plan.site]; const lane = f.lane;
   const seed = f.id * 37 % 11; const jitter = 9 * (seed / 11 - 0.5);
   const node = nearestNode(site.center[0] + jitter, site.center[2] + jitter * 0.7, lane);
   f.path = this.buildPath(f, node ?? nearestNode(site.center[0], site.center[2])); f.state = "advance";
  } else if (this.beacon.planted) {
   const site = SITES[this.beacon.site] ?? SITES.A;
   const dist = Math.hypot(f.pos.x - site.center[0], f.pos.z - site.center[2]);
   if (dist > 9) {
    const node = nearestNode(site.center[0], site.center[2]); f.path = this.buildPath(f, node);
    f.state = "retake";
   } else {
    f.state = "defuse"; f.path = [];
   }
  } else if (f.path.length === 0 || f.holdSpot === null) {
   const spot = f.holdSpot ?? this.pickCoverNear(SITES[f.lane === "B" ? "B" : "A"].center[0], SITES[f.lane === "B" ? "B" : "A"].center[2]);
   f.holdSpot = spot;
   if (spot !== null) {
    const node = nearestNode(spot.x, spot.z); f.path = this.buildPath(f, node);
   }
   f.state = "hold";
  }
 }
 buildPath(f, node) {
  if (node === null || node === void 0) return []; const startNode = nearestNode(f.pos.x, f.pos.z);
  if (startNode === null) return []; const ids = findPath(startNode.id, node.id);
  if (ids.length === 0) return []; return smoothPath(ids, this.world, f.pos.x, f.pos.z, f.pos.y);
 }
 pickCoverNear(x, z, lane = null) {
  let best = null; let bestD = 1 / 0;
  for (const c of COVER) {
   if (lane !== null && c.lane !== lane) continue; const d = Math.hypot(c.x - x, c.z - z);
   if (d < bestD) {
    bestD = d; best = c;
   }
  }
  return best;
 }
 botNavigate(f, dt, speedScale) {
  f.repathIn -= dt;
  if (f.path.length === 0 || f.pathIdx >= f.path.length) return { x: 0, z: 0, done: true };
  const wp = f.path[f.pathIdx]; const dx = wp.x - f.pos.x;
  const dz = wp.z - f.pos.z; const d = Math.hypot(dx, dz);
  if (d < 0.85) {
   f.pathIdx++;
   return { x: 0, z: 0, done: f.pathIdx >= f.path.length };
  }
  if (f.target === null) {
   const want = Math.atan2(-dx, -dz); f.yaw = turnToward(f.yaw, want, 6.5 * dt);
   f.pitch = turnToward(f.pitch, 0, 3 * dt);
  }
  return { x: dx / d * speedScale, z: dz / d * speedScale, done: false };
 }
 botAimIdle(f, dt) {
  f.aimSweep ??= this.rng.next() * Math.PI * 2;
  f.yaw = turnToward(f.yaw, f.yaw + Math.sin(this.time * 0.7 + f.aimSweep) * 0.004, 2 * dt);
 }
 botHold(f, dt) {
  if (f.holdSpot !== null) {
   const dx = f.holdSpot.x - f.pos.x; const dz = f.holdSpot.z - f.pos.z;
   if (Math.hypot(dx, dz) > 1.2) f.yaw = turnToward(f.yaw, Math.atan2(-dx, -dz), 5 * dt); else {
    const face = f.holdSpot.face * (Math.PI / 180); f.yaw = turnToward(f.yaw, face, 2.2 * dt);
   }
  }
 }
 botBeaconWork(f, dt) {
  const b = this.beacon;
  if (!b.planted && b.carrier === f.id) {
   const inSite = this.nearestSite(f.pos.x, f.pos.z); f.plantHold = inSite !== null;
   f.wantCrouch = inSite !== null;
  } else f.plantHold = false;
  if (b.planted && f.team === this.defendingTeam) {
   const d = Math.hypot(f.pos.x - b.x, f.pos.z - b.z); f.defuseHold = d < 1.6 && f.target === null;
   if (f.defuseHold) f.wantCrouch = true;
  } else f.defuseHold = false;
 }
 alertBotsNear(x, y, z, shooter) {
  for (const f of this.fighters) {
   if (!f.alive || f.isPlayer || f.team === shooter.team) continue;
   const d = Math.hypot(f.pos.x - x, f.pos.z - z);
   if (d < BOT.hearRange) if (f.target === null) {
    f.lastHeard = { x: shooter.pos.x, z: shooter.pos.z, t: this.time };
    const want = Math.atan2(-(x - f.pos.x), -(z - f.pos.z)); f.yaw = turnToward(f.yaw, want, 0.9);
    f.state = f.team === this.attackingTeam ? "advance" : "hold";
   }
  }
 }
 applyPlayerInput(input, dt) {
  const f = this.player; if (!f.alive) return;
  if (input.mouseDX !== 0 || input.mouseDY !== 0) {
   f.yaw -= input.mouseDX * input.sensitivity;
   f.pitch = clamp(f.pitch - input.mouseDY * input.sensitivity, -1.5, 1.5);
  }
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
  this.moveFighter(f, wantX, wantZ, dt, { jump: input.jump === true, crouch: input.crouch === true, walk: input.walk === true });
  this.playerAim = { yaw: effectiveYaw, pitch: effectivePitch };
  if (input.fire === true && this.phase === "live") {
   const fired = this.tryFireFrom(f, effectiveYaw, effectivePitch, { held: input.fireHeld === true });
   if (fired) this.playerViewKick = (this.playerViewKick ?? 0) + WEAPONS[f.weapon].recoilUp;
  }
  if (input.reload === true) this.beginReload(f);
 }
 tryFireFrom(f, yaw, pitch, opts) {
  const savedYaw = f.yaw; const savedPitch = f.pitch;
  f.yaw = yaw; f.pitch = pitch;
  const ok = this.tryFire(f, opts); f.yaw = savedYaw;
  f.pitch = savedPitch; return ok;
 }
 radio(text, team = null) {
  const entry = { text: text, at: this.time, team: team };
  this.radioFeed.unshift(entry); if (this.radioFeed.length > 3) this.radioFeed.pop();
  this.emit({ type: "radio", text: text, team: team });
 }
}
export function angleDiff(a, b) {
 let d = a - b; while (d > Math.PI) d -= Math.PI * 2;
 while (d < -Math.PI) d += Math.PI * 2; return d;
}
export function turnToward(current, target, maxStep) {
 const d = angleDiff(target, current); if (Math.abs(d) <= maxStep) return target;
 return current + Math.sign(d) * maxStep;
}

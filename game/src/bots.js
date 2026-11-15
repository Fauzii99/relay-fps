// game/src/bots.js — Bot decision-making: perception, pathing, cover, aim, and beacon work.
import { BOT, BUY, MOVE, SITES, UTIL, WEAPONS} from "./config.js";
import { COVER} from "./map.js";
import { findPath, nearestNode, smoothPath} from "./nav.js";
import { clamp} from "./rng.js";
import { angleDiff, turnToward} from "./sim.js";
export const bots = {
 updateBotsBuy() {
  if (this.phase !== "buy") return; if (this.buyDone === this.round) return;
  const bots = this.fighters.filter(f => !f.isPlayer);
  for (const f of bots) {
   const wantArmor = !f.hasKevlar && f.money >= BUY.kevlar.cost + 900; if (wantArmor) this.buy(f, "kevlar");
   const budget = f.money; let gun = null;
   if (budget >= WEAPONS.marksman.cost && this.rng.next() < 0.28) gun = "marksman"; else if (budget >= WEAPONS.rifle.cost) gun = "rifle"; else if (budget >= WEAPONS.smg.cost) gun = "smg";
   if (gun !== null && f.weapon !== gun) this.buy(f, gun);
   if (f.money >= BUY.frag.cost + 250 && this.rng.next() < 0.55) this.buy(f, "frag");
   if (f.money >= BUY.smoke.cost + 250 && this.rng.next() < 0.4) this.buy(f, "smoke");}
  this.buyDone = this.round;},
 updateBots(dt, live) {
  for (const f of this.fighters) {
   if (f.isPlayer || !f.alive) {
    f.shotKick = Math.max(0, f.shotKick - dt * 6); this.advanceReload(f, dt);
    if (f.fireCooldown > 0) f.fireCooldown -= dt; continue;}
   this.updateBot(f, dt, live);}},
 updateBot(f, dt, live) {
  this.advanceReload(f, dt); if (f.fireCooldown > 0) f.fireCooldown -= dt;
  f.shotKick = Math.max(0, f.shotKick - dt * 6); f.spreadBloom = Math.max(0, f.spreadBloom - dt * 0.055);
  f.recoilPitch = Math.max(0, f.recoilPitch - dt * (WEAPONS[f.weapon].recoilRecover * 0.55));
  if (!live) {
   this.botNavigate(f, dt, 0.6); this.botAimIdle(f, dt);
   return;}
  const seen = this.botPerceive(f);
  if (seen !== null) {
   if (f.target !== seen.id) {
    f.target = seen.id; f.targetSeenAt = this.time;
    const skill = BOT.skill + (f.team === this.attackingTeam ? 0.03 : 0.05);
    f.reactionUntil = this.time + BOT.reactionMin + (1 - skill) * (BOT.reactionMax - BOT.reactionMin);
    f.aimError = BOT.aimErrorBase * (1.25 - skill) + this.rng.next() * 0.014;}
   const last = f.lastSeen ?? (f.lastSeen = {x: 0,z: 0,t: 0});
   last.x = seen.pos.x; last.z = seen.pos.z;
   last.t = this.time; this.spotted.add(seen.id);} else if (f.target !== null && this.time - (f.lastSeen?.t ?? 0) > 2.4) f.target = null;
  const target = f.target === null ? null : this.byId(f.target);
  const canShoot = target !== null && this.time >= f.reactionUntil && this.botHasLOS(f, target);
  let moveX = 0; let moveZ = 0;
  let speedScale = 1;
  if (canShoot) {
   f.strafeIn -= dt;
   if (f.strafeIn <= 0) {
    f.strafeIn = BOT.strafeInterval * (0.6 + this.rng.next() * 0.8); f.strafe = this.rng.sign();}
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
    if (burstOk) this.tryFire(f, {held: true});}
   if ((f.ammo[f.weapon] ?? 0) === 0) this.beginReload(f);
   if ((f.ammo[f.weapon] ?? 0) <= 3 && (f.reserve[f.weapon] ?? 0) > 0 && target !== null) this.beginReload(f);
   if (f.frag > 0 && d > 10 && d < 26 && this.rng.next() < 0.0016) this.throwUtil(f, "frag");
   if (f.smoke > 0 && d > 16 && this.rng.next() < 0.0009) this.throwUtil(f, "smoke");} else {
   f.wantCrouch = false; this.botThink(f, dt);
   const nav = this.botNavigate(f, dt, speedScale); moveX = nav.x;
   moveZ = nav.z; if (nav.done) this.botHold(f, dt);
   if ((f.ammo[f.weapon] ?? 0) < WEAPONS[f.weapon].mag * 0.4 && (f.reserve[f.weapon] ?? 0) > 0) this.beginReload(f);
   this.botBeaconWork(f, dt);}
  this.moveFighter(f, moveX, moveZ, dt, {crouch: f.wantCrouch === true,walk: f.state === "hold" && target === null});},
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
    bestScore = score; best = other;}}
  return best;},
 botHasLOS(f, other) {
  if (this.smokeBlocks(f.pos, other.pos)) return false;
  const eyeY = f.pos.y + MOVE.eyeStand - f.crouch * 0.42;
  return this.world.lineOfSight(f.pos.x, eyeY, f.pos.z, other.pos.x, other.pos.y + 1.2, other.pos.z, b => b.kind === "rail");},
 smokeBlocks(a, b) {
  for (const s of this.smokes) {
   if (!s.armed) continue; const dx = b.x - a.x;
   const dz = b.z - a.z; const len2 = dx * dx + dz * dz;
   if (len2 < 1e-6) continue; let t = ((s.x - a.x) * dx + (s.z - a.z) * dz) / len2;
   t = clamp(t, 0, 1); const px = a.x + dx * t;
   const pz = a.z + dz * t; if (Math.hypot(px - s.x, pz - s.z) < UTIL.smoke.radius * 0.82) return true;}
  return false;},
 botThink(f, dt) {
  f.think -= dt; if (f.think > 0) return;
  f.think = 0.4 + this.rng.next() * 0.4;
  if (f.team === this.attackingTeam) if (this.beacon.planted) {
   f.state = "hold"; const site = SITES[this.beacon.site] ?? SITES.A;
   f.goal = this.pickCoverNear(site.center[0], site.center[2]); f.goalNode = null;} else if (this.beacon.carrier === f.id) {
   const site = SITES[this.plan.site];
   const node = nearestNode(site.center[0] + 4 * (this.rng.next() - 0.5), site.center[2] + 4 * (this.rng.next() - 0.5));
   f.path = this.buildPath(f, node); f.goal = null;
   f.state = "advance";} else if (this.beacon.carrier === null && this.plantSpot !== null) {
   const node = nearestNode(this.plantSpot.x, this.plantSpot.z); f.path = this.buildPath(f, node);
   f.state = "retrieve";} else {
   const site = SITES[this.plan.site]; const lane = f.lane;
   const seed = f.id * 37 % 11; const jitter = 9 * (seed / 11 - 0.5);
   const node = nearestNode(site.center[0] + jitter, site.center[2] + jitter * 0.7, lane);
   f.path = this.buildPath(f, node ?? nearestNode(site.center[0], site.center[2])); f.state = "advance";} else if (this.beacon.planted) {
   const site = SITES[this.beacon.site] ?? SITES.A;
   const dist = Math.hypot(f.pos.x - site.center[0], f.pos.z - site.center[2]);
   if (dist > 9) {
    const node = nearestNode(site.center[0], site.center[2]); f.path = this.buildPath(f, node);
    f.state = "retake";} else {
    f.state = "defuse"; f.path = [];}} else if (f.path.length === 0 || f.holdSpot === null) {
   const spot = f.holdSpot ?? this.pickCoverNear(SITES[f.lane === "B" ? "B" : "A"].center[0], SITES[f.lane === "B" ? "B" : "A"].center[2]);
   f.holdSpot = spot;
   if (spot !== null) {
    const node = nearestNode(spot.x, spot.z); f.path = this.buildPath(f, node);}
   f.state = "hold";}},
 buildPath(f, node) {
  if (node === null || node === void 0) return []; const startNode = nearestNode(f.pos.x, f.pos.z);
  if (startNode === null) return []; const ids = findPath(startNode.id, node.id);
  if (ids.length === 0) return []; return smoothPath(ids, this.world, f.pos.x, f.pos.z, f.pos.y);},
 pickCoverNear(x, z, lane = null) {
  let best = null; let bestD = 1 / 0;
  for (const c of COVER) {
   if (lane !== null && c.lane !== lane) continue; const d = Math.hypot(c.x - x, c.z - z);
   if (d < bestD) {
    bestD = d; best = c;}}
  return best;},
 botNavigate(f, dt, speedScale) {
  f.repathIn -= dt;
  if (f.path.length === 0 || f.pathIdx >= f.path.length) return {x: 0,z: 0,done: true};
  const wp = f.path[f.pathIdx]; const dx = wp.x - f.pos.x;
  const dz = wp.z - f.pos.z; const d = Math.hypot(dx, dz);
  if (d < 0.85) {
   f.pathIdx++;
   return {x: 0,z: 0,done: f.pathIdx >= f.path.length};}
  if (f.target === null) {
   const want = Math.atan2(-dx, -dz); f.yaw = turnToward(f.yaw, want, 6.5 * dt);
   f.pitch = turnToward(f.pitch, 0, 3 * dt);}
  return {x: dx / d * speedScale,z: dz / d * speedScale,done: false};},
 botAimIdle(f, dt) {
  f.aimSweep ??= this.rng.next() * Math.PI * 2;
  f.yaw = turnToward(f.yaw, f.yaw + Math.sin(this.time * 0.7 + f.aimSweep) * 0.004, 2 * dt);},
 botHold(f, dt) {
  if (f.holdSpot !== null) {
   const dx = f.holdSpot.x - f.pos.x; const dz = f.holdSpot.z - f.pos.z;
   if (Math.hypot(dx, dz) > 1.2) f.yaw = turnToward(f.yaw, Math.atan2(-dx, -dz), 5 * dt); else {
    const face = f.holdSpot.face * (Math.PI / 180); f.yaw = turnToward(f.yaw, face, 2.2 * dt);}}},
 botBeaconWork(f, dt) {
  const b = this.beacon;
  if (!b.planted && b.carrier === f.id) {
   const inSite = this.nearestSite(f.pos.x, f.pos.z); f.plantHold = inSite !== null;
   f.wantCrouch = inSite !== null;} else f.plantHold = false;
  if (b.planted && f.team === this.defendingTeam) {
   const d = Math.hypot(f.pos.x - b.x, f.pos.z - b.z); f.defuseHold = d < 1.6 && f.target === null;
   if (f.defuseHold) f.wantCrouch = true;} else f.defuseHold = false;},
 alertBotsNear(x, y, z, shooter) {
  for (const f of this.fighters) {
   if (!f.alive || f.isPlayer || f.team === shooter.team) continue;
   const d = Math.hypot(f.pos.x - x, f.pos.z - z);
   if (d < BOT.hearRange) if (f.target === null) {
    f.lastHeard = {x: shooter.pos.x,z: shooter.pos.z,t: this.time};
    const want = Math.atan2(-(x - f.pos.x), -(z - f.pos.z)); f.yaw = turnToward(f.yaw, want, 0.9);
    f.state = f.team === this.attackingTeam ? "advance" : "hold";}}}};

// game/src/grenade.js — Thrown utility: smoke and frag flight, detonation, radial damage.
import { MOVE, UTIL} from "./config.js";
import { applyDamage} from "./combat.js";
import { clamp} from "./rng.js";
export const grenade = {
 throwUtil(f, kind) {
  if (!f.alive || this.phase !== "live") return false; if (kind === "smoke" && f.smoke <= 0) return false;
  if (kind === "frag" && f.frag <= 0) return false; if (kind === "smoke") f.smoke--; else f.frag--;
  const dir = {x: -Math.sin(f.yaw) * Math.cos(f.pitch),y: Math.sin(f.pitch),z: -Math.cos(f.yaw) * Math.cos(f.pitch)};
  const eyeY = f.pos.y + (f.ducking ? MOVE.eyeCrouch : MOVE.eyeStand) - f.crouch * 0.42;
  const origin = {x: f.pos.x + dir.x * 0.45,y: eyeY - 0.12,z: f.pos.z + dir.z * 0.45};
  const speed = kind === "smoke" ? 15.5 : 18.0;
  const vel = {x: dir.x * speed,y: dir.y * speed + 3.4,z: dir.z * speed};
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
   resting: false};
  if (kind === "smoke") this.smokes.push({ ...canister,kind: "smoke"}); else {
   canister.id = this.nextId++;
   this.frags.push({ ...canister,kind: "frag"});}
  this.emit({type: "utilThrow",owner: f.id,kind: kind,x: origin.x,y: origin.y,z: origin.z,team: f.team});
  return true;},
 updateProjectiles(dt) {
  const integrate = c => {
   if (c.armed) return;
   if (!c.resting) {
    c.vy -= 22 * dt; let nx = c.x + c.vx * dt;
    let nz = c.z + c.vz * dt; let ny = c.y + c.vy * dt;
    const solved = this.world.resolve(nx, nz, 0.16, c.y, 0.3, 0.2);
    if (solved.x !== nx || solved.z !== nz) {
     c.vx *= -0.42; c.vz *= -0.42;
     nx = solved.x; nz = solved.z;}
    const floor = this.world.supportHeight(nx, nz, 0.16, c.y + 0.1, 0.25);
    if (ny <= floor + 0.09) {
     ny = floor + 0.09;
     if (Math.abs(c.vy) > 1.2) {
      c.vy = 0.36 * -c.vy; c.vx *= 0.62;
      c.vz *= 0.62; c.bounces++;
      this.emit({type: "utilBounce",kind: c.kind,x: nx,y: ny,z: nz});} else {
      c.vy = 0; c.vx *= 0.86;
      c.vz *= 0.86; c.resting = Math.hypot(c.vx, c.vz) < 0.45;}}
    c.x = clamp(nx, -38.4, 38.4); c.z = clamp(nz, -46.4, 46.4);
    c.y = ny;}}; for (const s of this.smokes) integrate(s);
  for (const f of this.frags) integrate(f);},
 detonateFrag(frag) {
  frag.armed = true; const idx = this.frags.indexOf(frag);
  if (idx >= 0) this.frags.splice(idx, 1);
  const owner = frag.owner === null ? null : this.byId(frag.owner, false);
  this.emit({type: "fragExplode",x: frag.x,y: frag.y,z: frag.z});
  this.damageInRadius(frag.x, frag.z, UTIL.frag.radius, UTIL.frag.damage, owner, "frag");},
 damageInRadius(x, z, radius, maxDamage, owner, kind) {
  for (const f of this.fighters) {
   if (!f.alive) continue; const d = Math.hypot(f.pos.x - x, f.pos.z - z);
   if (d > radius) continue;
   if (!this.world.lineOfSight(x, 0.6, z, f.pos.x, f.pos.y + 1.1, f.pos.z, b => b.kind === "rail")) continue;
   const falloff = 1 - Math.max(0, d - UTIL.frag.falloffFrom) / radius;
   const dmg = maxDamage * Math.max(0.12, falloff);
   if (owner !== null && owner.team === f.team) {
    const friendly = dmg * 0.4; const res = applyDamage(f, friendly, "torso");
    if (f.isPlayer) this.emit({type: "damageTaken",from: owner.id,amount: res.dealt,zone: "frag"});
    if (res.killed) this.killFighter(f, null, "torso", "frag");} else {
    const res = applyDamage(f, dmg, "torso"); if (owner !== null) owner.damageDealt += res.dealt;
    if (f.isPlayer) {
     this.emit({type: "damageTaken",from: owner?.id ?? null,amount: res.dealt,zone: "frag"});}
    if (res.killed) this.killFighter(f, owner, "torso", kind === "beacon" ? "beacon" : "frag");}}}};

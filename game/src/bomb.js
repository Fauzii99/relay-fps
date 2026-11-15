// game/src/bomb.js — The beacon: pickup, plant progress, defuse, and detonation timing.
import { MATCH, SITES} from "./config.js";
export const bomb = {
nearestSite(x, z, radius = null) {
let best = null;
for (const key of [ "A", "B" ]) {
const site = SITES[key]; const d = Math.hypot(x - site.center[0], z - site.center[2]);
const r = radius ?? site.radius;
if (d <= r && (best === null || d < best.d)) best = {site: site,d: d};}
return best;},
updateBeacon(dt) {
const b = this.beacon; if (this.phase !== "live") return;
if (b.carrier === null && !b.planted && this.plantSpot !== null) for (const f of this.fighters) {
if (!f.alive || f.team !== this.attackingTeam) continue;
const d = Math.hypot(f.pos.x - this.plantSpot.x, f.pos.z - this.plantSpot.z);
if (d < 1.5) {
b.carrier = f.id; this.plantSpot = null;
this.emit({type: "beaconPickup",id: f.id});
break;}}
if (b.planted) {
const onBeacon = f => f.alive && f.team === this.defendingTeam && f.defuseHold === true && Math.hypot(f.pos.x - b.x, f.pos.z - b.z) < 1.7;
let defuser;
for (const f of this.fighters) if (onBeacon(f)) {
defuser = f; break;}
if (b.defuseT > 0) if (defuser === void 0) {
b.defuseT = 0; b.defusing = false;
this.emit({type: "defuseCancel"});} else {
b.defusing = true; b.defuseT = Math.max(0, b.defuseT - dt);
if (b.defuseT === 0) {
b.defused = true; b.defusing = false;
this.emit({type: "defused",x: b.x,z: b.z,by: defuser.id});
this.radio("Beacon is defused. Sites are ours.", this.defendingTeam);
defuser.money = Math.min(MATCH.maxMoney, defuser.money + MATCH.defuseReward);}} else if (defuser !== void 0) {
b.defuseT = MATCH.defuseTime; b.defusing = true;
this.emit({type: "defuseStart",id: defuser.id});}
if (!b.defused) {
b.timer = Math.max(0, b.timer - dt);
if (b.timer === 0 && !b.detonated) {
b.detonated = true;
this.emit({type: "detonation",x: b.x,z: b.z});
this.damageInRadius(b.x, b.z, 16, 220, null, "beacon");}}
return;}
const carrier = b.carrier === null ? null : this.byId(b.carrier);
if (carrier === null) {
b.planting = false; return;}
const inSite = this.nearestSite(carrier.pos.x, carrier.pos.z);
const holding = carrier.plantHold === true && inSite !== null && carrier.grounded; b.planting = holding;
if (holding) {
carrier.plantProgress = Math.min(MATCH.plantTime, carrier.plantProgress + dt);
b.plantT = carrier.plantProgress;
if (carrier.plantProgress >= MATCH.plantTime) {
b.planted = true; b.site = inSite.site.id;
b.x = carrier.pos.x; b.z = carrier.pos.z;
b.timer = MATCH.bombTime; b.carrier = null;
this.emit({type: "planted",site: b.site,x: b.x,z: b.z,by: carrier.id});
this.radio(`Beacon planted on ${inSite.site.label}.`, carrier.team);
carrier.money = Math.min(MATCH.maxMoney, carrier.money + MATCH.plantReward);}} else if (!holding) {
carrier.plantProgress = Math.max(0, carrier.plantProgress - dt * 1.6); b.plantT = carrier.plantProgress;}}};

// game/src/rounds.js — Round lifecycle: reset, plans, win conditions, and payouts.
import { BOT, MATCH, MOVE, SPAWNS, TEAM, WEAPONS} from "./config.js";
import { COVER} from "./map.js";
import { clearPathCache} from "./nav.js";
export const rounds = {
 startRound() {
  clearPathCache(); this.phase = "buy";
  this.phaseT = 0; this.roundStartTime = this.time;
  this.roundWinner = null; this.roundReason = "";
  this.spotted.clear(); this.smokes.length = 0;
  this.frags.length = 0;
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
  const slotOf = {warden: 0,cinder: 0};
  for (const f of this.fighters) {
   const spawns = f.team === TEAM.WARDEN ? wardenSpawn : cinderSpawn;
   const s = spawns[slotOf[f.team]++ % spawns.length];
   const clear = this.world.resolve(s[0], s[2], MOVE.radius + 0.5, 0, MOVE.standHeight, MOVE.stepHeight);
   f.pos = {x: clear.x,y: s[1],z: clear.z};
   f.vel = {x: 0,y: 0,z: 0};
   f.alive = true; f.health = MOVE.maxHealth;
   f.armor = f.hasKevlar ? 100 : 0; f.crouch = 0;
   f.grounded = true; f.reloading = 0;
   f.fireCooldown = 0; f.recoilPitch = 0;
   f.recoilYaw = 0; f.spreadBloom = 0;
   f.shotIndex = 0; f.kills = 0;
   f.deaths = 0; f.damageDealt = 0;
   f.headshots = 0; f.assists = 0; f.damagers = [];
   f.spent = 0; f.utilHeld = null;
   f.plantProgress = 0; f.defuseProgress = 0;
   f.state = "advance";
   f.lastPos = {x: s[0],z: s[2]};
   f.yaw = Math.atan2(-(0 - s[0]), -(6 - s[2])); f.pitch = 0;
   f.aimError = BOT.aimErrorBase; f.repathIn = 0;
   f.target = null; f.goal = null;
   f.path = []; f.pathIdx = 0;
   f.holdSpot = null; f.ammo[f.weapon] = WEAPONS[f.weapon].mag;
   f.reserve[f.weapon] = WEAPONS[f.weapon].reserve;
   f.ammo.knife = 1; f.reserve.knife = 0;}
  const attackers = this.squad(attackingTeam).filter(f => f.alive);
  const carrier = attackers.reduce((best, f) => {
   const d = Math.hypot(f.pos.x, f.pos.z - 6);
   return best === null || d < best.d ? {f: f,d: d} : best;}, null); if (carrier !== null) this.beacon.carrier = carrier.f.id;
  this.pickRoundPlan();
  this.emit({type: "roundStart",round: this.round,attackingTeam: attackingTeam,defendingTeam: this.defendingTeam});
  this.radio(`${this.round === 1 ? "Match start." : `Round ${this.round}.`} ${attackingTeam === this.playerTeam ? "Take it." : "Hold."}`);},
 pickRoundPlan() {
  const sites = [ "A", "B" ]; const pick = this.rng.next() < 0.5 ? 0 : 1;
  this.plan = {site: sites[(this.round + pick) % 2],lane: this.round % 3 === 0 ? "mid" : "lane"};
  if (this.demo) this.plan.site = "B"; const defenders = this.squad(this.defendingTeam);
  const perSite = [ "A", "B" ];
  defenders.forEach((f, i) => {
   if (i < 2) {
    f.lane = perSite[i % 2]; f.state = "hold";
    f.holdSpot = COVER.find(c => c.lane === f.lane) ?? null;} else if (i === 2) {
    f.lane = "mid"; f.state = "hold";
    f.holdSpot = COVER.find(c => c.lane === "mid" && c.z > 0) ?? null;} else {
    f.lane = i % 2 === 0 ? "A" : "B"; f.state = "rotate";}}); const attackers = this.squad(this.attackingTeam);
  attackers.forEach((f, i) => {
   f.lane = i === 0 ? "mid" : i % 2 === 0 ? this.plan.site : "mid"; f.state = "advance";
   f.holdSpot = null;}); this.plan.attackers = attackers.map(f => f.id);},
 checkRoundEnd() {
  if (this.phase !== "live") return; const wAlive = this.aliveCount(TEAM.WARDEN);
  const cAlive = this.aliveCount(TEAM.CINDER);
  if (this.beacon.planted) {
   if (this.beacon.detonated) {
    this.endRound(this.attackingTeam, "beacon detonated"); return;}
   if (this.beacon.defused) {
    this.endRound(this.defendingTeam, "beacon defused"); return;}
   if (this.aliveCount(this.defendingTeam) === 0) return; return;}
  if (wAlive === 0) {
   this.endRound(TEAM.CINDER, "Aster Wardens eliminated"); return;}
  if (cAlive === 0) {
   this.endRound(TEAM.WARDEN, "Cinder Pact eliminated"); return;}
  if (this.phaseT >= MATCH.roundTime) this.endRound(TEAM.WARDEN === this.defendingTeam ? TEAM.WARDEN : TEAM.CINDER, "time expired, beacon secure");},
 endRound(winner, reason) {
  if (this.phase === "roundEnd" || this.phase === "matchEnd") return; this.phase = "roundEnd";
  this.phaseT = 0; this.roundWinner = winner;
  this.roundReason = reason; this.score[winner]++;
  this.roundHistory.push({round: this.round,winner: winner,reason: reason,score: { ...this.score}});
  const loser = winner === TEAM.WARDEN ? TEAM.CINDER : TEAM.WARDEN; const winTeam = this.squad(winner);
  const loseTeam = this.squad(loser);
  for (const f of winTeam) {
   let pay = MATCH.winReward;
   if (this.beacon.detonated && f.team === this.attackingTeam) pay += MATCH.plantReward;
   if (this.beacon.defused && f.team === this.defendingTeam) pay += MATCH.defuseReward;
   f.money = Math.min(MATCH.maxMoney, f.money + pay); f.hasKevlar = f.armor > 0;}
  this.lossStreak ??= {warden: 0,cinder: 0};
  this.lossStreak[loser] = (this.lossStreak[loser] ?? 0) + 1; this.lossStreak[winner] = 0;
  const lossPay = Math.min(MATCH.lossRewardMax, MATCH.lossRewardBase + MATCH.lossRewardStep * Math.max(0, this.lossStreak[loser] - 1));
  for (const f of loseTeam) {
   f.money = Math.min(MATCH.maxMoney, f.money + lossPay); f.hasKevlar = f.armor > 0;}
  this.emit({type: "roundEnd",winner: winner,loser: loser,reason: reason,score: { ...this.score},lossPay: lossPay,round: this.round});
  this.radio(winner === this.playerTeam ? `${reason}. Round ours.` : `${reason}. They take it. Reset.`, this.playerTeam);
  if (winner === this.playerTeam) this.emit({type: "stinger",kind: "win"}); else this.emit({type: "stinger",kind: "loss"});}};

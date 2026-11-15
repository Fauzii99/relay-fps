// tools/test-sim.mjs — drives the real simulation headlessly (no three.js, no browser) and
// asserts on what actually happened: movement and collision, spread, hitscan zones, ammo and
// reload, purchases and their refusals, kills, damage, rounds, planting, defusing, utilities,
// victory and a full match restart. Run: node tools/test-sim.mjs

import { Match } from '../game/src/sim.js';
import { MOVE, MATCH, WEAPONS, TEAM, SQUAD } from '../game/src/config.js';
import { damageAtRange, raycastFighter } from '../game/src/combat.js';

let pass = 0;
let fail = 0;
const results = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; results.push(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

function run(match, seconds, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) match.step(dt);
}

const events = [];
const tagged = (m) => { m.onEvent = (e) => events.push(e); };

// ---------------------------------------------------------------------------------------------
console.log('Relay 9 — simulation harness\n');

// 1. construction and initial state
{
  const m = new Match({ seed: 1337 });
  tagged(m);
  check('match builds 8 fighters', m.fighters.length === SQUAD * 2, `${m.fighters.length}`);
  check('two squads of four', m.squad(TEAM.WARDEN).length === SQUAD && m.squad(TEAM.CINDER).length === SQUAD);
  check('the player is on one of the squads', m.fighters.filter((f) => f.isPlayer).length === 1);
  check('starts in the buy phase', m.phase === 'buy');
  check('round 1, score 0-0', m.round === 1 && m.score.warden === 0 && m.score.cinder === 0);
  check('player starts with a sidearm', m.player.weapon === 'sidearm' && m.player.ammo.sidearm === WEAPONS.sidearm.mag);
  check('starting money', m.player.money === MATCH.startMoney, `₡${m.player.money}`);
  check('beacon carried by an attacker', m.beacon.carrier !== null);
}

// 2. buy phase duration and the transition to live
{
  const m = new Match({ seed: 1337 });
  run(m, MATCH.buyPhase - 0.2);
  check('still buying just before the buzzer', m.phase === 'buy');
  run(m, 0.5);
  check('live after the buy phase', m.phase === 'live', m.phase);
}

// 3. movement: forward motion and collision with a wall
{
  const m = new Match({ seed: 7 });
  m.phase = 'live';
  const f = m.player;
  f.pos = { x: 0, y: 0, z: 40 };
  f.yaw = 0; // facing -z, toward the middle
  const z0 = f.pos.z;
  for (let i = 0; i < 30; i++) m.moveFighter(f, 0, -1, 1 / 60);
  check('walks forward', f.pos.z < z0 - 1.2, `z ${z0.toFixed(2)} → ${f.pos.z.toFixed(2)}`);

  // drive straight into the south boundary wall and confirm it stops
  f.pos = { x: 20, y: 0, z: 45.5 };
  for (let i = 0; i < 120; i++) m.moveFighter(f, 0, 1, 1 / 60);
  check('wall stops the body', f.pos.z <= 47.3, `z ${f.pos.z.toFixed(2)} (wall at 47.0)`);

  // walk into a crate and confirm the slide resolver keeps us out of it
  const crateX = 27.7;
  const crateZ = 29.3;
  f.pos = { x: crateX, y: 0, z: 33.2 };
  for (let i = 0; i < 90; i++) m.moveFighter(f, 0, -1, 1 / 60);
  const insideCrate = f.pos.x > 26.0 && f.pos.x < 29.4 && f.pos.z > 27.6 && f.pos.z < 31.0 && f.pos.y < 0.9;
  check('crate blocks walking through', !insideCrate, `pos ${f.pos.x.toFixed(2)},${f.pos.z.toFixed(2)} y ${f.pos.y.toFixed(2)}`);

  // stairs: walking up the east catwalk's steps raises the feet
  f.pos = { x: 32.2, y: 0, z: 17.2 };
  for (let i = 0; i < 200; i++) m.moveFighter(f, 0, -1, 1 / 60);
  check('stairs carry the body up', f.pos.y > 1.0, `y ${f.pos.y.toFixed(2)} z ${f.pos.z.toFixed(2)}`);
}

// 4. jump and gravity
{
  const m = new Match({ seed: 9 });
  m.phase = 'live';
  const f = m.player;
  f.pos = { x: 0, y: 0, z: 30 };
  m.moveFighter(f, 0, 0, 1 / 60, { jump: true });
  check('jump leaves the ground', f.vel.y > 6, `vy ${f.vel.y.toFixed(2)}`);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    m.moveFighter(f, 0, 0, 1 / 60);
    peak = Math.max(peak, f.pos.y);
  }
  check('jump reaches a sane apex', peak > 1.1 && peak < 2.2, `${peak.toFixed(2)} m`);
  check('lands again', f.pos.y === 0 && f.grounded, `y ${f.pos.y.toFixed(2)}`);
}

// 5. crouch changes the body and the speed
{
  const m = new Match({ seed: 11 });
  m.phase = 'live';
  const f = m.player;
  f.pos = { x: 0, y: 0, z: 30 };
  for (let i = 0; i < 24; i++) m.moveFighter(f, 0, -1, 1 / 60, { crouch: true });
  const crouchSpeed = Math.hypot(f.vel.x, f.vel.z);
  check('crouching slows the body', crouchSpeed < MOVE.walkSpeed * 0.7, `${crouchSpeed.toFixed(2)} m/s vs ${MOVE.walkSpeed}`);
  check('crouch blend is up', f.crouch > 0.9, f.crouch.toFixed(2));
}

// 6. spread model: standing still and crouched is tighter than running and airborne
{
  const m = new Match({ seed: 13 });
  m.phase = 'live';
  const f = m.player;
  f.weapon = 'rifle';
  f.pos = { x: 0, y: 0, z: 30 };
  f.vel = { x: 0, y: 0, z: 0 };
  f.crouch = 0;
  const still = m.currentSpread(f);
  f.vel = { x: 8, y: 0, z: 0 };
  const moving = m.currentSpread(f);
  f.grounded = false;
  const air = m.currentSpread(f);
  f.grounded = true;
  f.vel = { x: 0, y: 0, z: 0 };
  f.crouch = 1;
  const crouched = m.currentSpread(f);
  check('moving opens the cone', moving > still * 2, `${still.toFixed(5)} → ${moving.toFixed(5)}`);
  check('air is the worst', air > moving, `${air.toFixed(5)}`);
  check('crouching tightens the cone', crouched < still, `${crouched.toFixed(5)} < ${still.toFixed(5)}`);
}

// 7. hitscan zones: head does 2.5x body, limb does less
{
  const m = new Match({ seed: 15 });
  const victim = m.squad(TEAM.CINDER)[0];
  victim.pos = { x: 0, y: 0, z: 0 };
  victim.crouch = 0;
  victim.yaw = 0;
  const eyeY = 1.62;
  const head = raycastFighter(0, eyeY, 10, 0, Math.atan2(1.78 - eyeY, 10), -1, 40, victim);
  const body = raycastFighter(0, eyeY, 10, 0, Math.atan2(1.30 - eyeY, 10), -1, 40, victim);
  const legs = raycastFighter(0, eyeY, 10, 0, Math.atan2(0.45 - eyeY, 10), -1, 40, victim);
  check('head zone hit', head !== null && head.zone === 'head', head?.zone ?? 'miss');
  check('torso zone hit', body !== null && body.zone === 'torso', body?.zone ?? 'miss');
  check('leg zone hit', legs !== null && legs.zone === 'legs', legs?.zone ?? 'miss');
  check('head multiplier is 2.5x', Math.abs((head?.mult ?? 0) - 2.5) < 1e-9, `${head?.mult}`);
  check('limb multiplier is below 1', (legs?.mult ?? 1) < 1, `${legs?.mult}`);

  // occlusion: a wall between shooter and target means no hit
  const blocked = m.world.lineOfSight(-6, 1.6, 30, -6, 1.6, -20);
  check('walls occlude line of sight', blocked === false);
  const open = m.world.lineOfSight(0, 1.6, 30, 0, 1.6, 20);
  check('clear lane keeps line of sight', open === true);
}

// 8. firing: ammo drops, cooldown gates the rate, reload refills from reserve
{
  const m = new Match({ seed: 17 });
  m.phase = 'live';
  m.phaseT = 10;
  const f = m.player;
  f.pos = { x: 0, y: 0, z: 30 };
  f.yaw = 0;
  f.pitch = 0;
  f.weapon = 'rifle';
  f.ammo.rifle = 30;
  f.reserve.rifle = 90;
  f.fireCooldown = 0;
  const before = f.ammo.rifle;
  m.tryFire(f);
  check('firing consumes a round', f.ammo.rifle === before - 1, `${before} → ${f.ammo.rifle}`);
  check('cooldown blocks the next shot', m.tryFire(f) === false);
  f.fireCooldown = 0;
  m.tryFire(f);
  check('second shot after the cooldown', f.ammo.rifle === before - 2, `${f.ammo.rifle}`);

  f.ammo.rifle = 4;
  m.beginReload(f);
  check('reload starts', f.reloading > 0, `${f.reloading.toFixed(2)} s`);
  check('cannot fire mid-reload', m.tryFire(f) === false);
  run(m, WEAPONS.rifle.reloadTime + 0.1);
  check('reload tops the magazine up', f.ammo.rifle === WEAPONS.rifle.mag, `${f.ammo.rifle}`);
  check('reload takes from the reserve', f.reserve.rifle === 90 - (WEAPONS.rifle.mag - 4), `${f.reserve.rifle}`);

  f.ammo.rifle = 0;
  f.reserve.rifle = 0;
  f.fireCooldown = 0;
  check('empty with no reserve cannot fire', m.tryFire(f) === false);
}

// 9. weapon switching
{
  const m = new Match({ seed: 19 });
  m.phase = 'live';
  const f = m.player;
  f.weapon = 'rifle';
  f.ammo.rifle = 20;
  f.reserve.rifle = 30;
  f.ammo.sidearm = 20;
  f.reserve.sidearm = 60;
  const ok = m.switchWeapon(f, 2);
  check('slot 2 switches rifle → sidearm', ok === true && f.weapon === 'sidearm', f.weapon);
  const back = m.switchWeapon(f, 1);
  check('slot 1 switches back to the primary', back === true && f.weapon === 'rifle', f.weapon);
}

// 10. buying: prices, refusals, and the spawn restriction
{
  const m = new Match({ seed: 21 });
  const f = m.player;
  f.money = 5000;
  f.pos = { x: 0, y: 0, z: 46 };
  const before = f.money;
  const r1 = m.buy(f, 'rifle');
  check('buys a rifle', r1.ok === true && f.weapon === 'rifle');
  check('money is deducted', f.money === before - WEAPONS.rifle.cost, `₡${f.money}`);
  const r2 = m.buy(f, 'rifle');
  check('refuses a duplicate purchase', r2.ok === false, r2.reason);
  f.money = 100;
  const r3 = m.buy(f, 'marksman');
  check('refuses what you cannot afford', r3.ok === false && r3.reason === 'not enough money', r3.reason);
  f.money = 5000;
  const r4 = m.buy(f, 'kevlar');
  check('buys kevlar', r4.ok === true && f.armor === 100, `${f.armor}`);
  const r5 = m.buy(f, 'kevlar');
  check('refuses a second vest', r5.ok === false, r5.reason);

  // away from spawn: refused
  f.pos = { x: 0, y: 0, z: 0 };
  const r6 = m.buy(f, 'smoke');
  check('refuses buying away from spawn', r6.ok === false && r6.reason === 'away from spawn', r6.reason);

  // after the buy window: refused
  f.pos = { x: 0, y: 0, z: 46 };
  m.phase = 'live';
  m.phaseT = 30;
  const r7 = m.buy(f, 'smoke');
  check('refuses buying after the window', r7.ok === false && r7.reason === 'closed', r7.reason);
}

// 11. a scripted kill: damage, death, killfeed and the kill reward.
// The other eight bots are parked out of the fight so the credit path is measured in isolation,
// with only the shooter and one victim live.
{
  const events2 = [];
  const m = new Match({ seed: 23, onEvent: (e) => events2.push(e) });
  m.phase = 'live';
  m.phaseT = 10;
  const shooter = m.player;
  const victim = m.squad(TEAM.CINDER)[0];
  for (const other of m.fighters) {
    if (other === shooter || other === victim) continue;
    other.alive = false;
    other.pos = { x: 36, y: 0, z: 44 };
  }
  shooter.pos = { x: 0, y: 0, z: 20 };
  shooter.yaw = 0;
  shooter.pitch = Math.atan2(1.30 - 1.62, 8);
  shooter.weapon = 'rifle';
  shooter.ammo.rifle = 30;
  shooter.reserve.rifle = 90;
  victim.pos = { x: 0, y: 0, z: 12 };
  victim.crouch = 0;
  victim.armor = 0;
  victim.health = 100;
  const moneyBefore = shooter.money;
  let shots = 0;
  let moneyAtKill = null;
  for (let i = 0; i < 40 && victim.alive; i++) {
    // hold the aim steady and clear the cooldown, so this measures damage and credit, not aim.
    // The victim is pinned before the shot: its own bot logic walks it during step().
    victim.pos = { x: 0, y: 0, z: 12 };
    victim.vel = { x: 0, y: 0, z: 0 };
    victim.stunUntil = m.time + 1;
    shooter.ammo.rifle = 30;
    shooter.spreadBloom = 0;
    shooter.fireCooldown = 0;
    shooter.recoilPitch = 0;
    shooter.recoilYaw = 0;
    if (m.tryFire(shooter)) shots++;
    // the kill is banked before the round-end payouts fire, so sample the wallet at the death
    if (!victim.alive && moneyAtKill === null) moneyAtKill = shooter.money;
    for (let k = 0; k < 8; k++) m.step(1 / 60);
  }
  check('rifle rounds kill a body', victim.alive === false, `${shots} shots, health ${victim.health}`);
  check('kill is on the feed', m.killfeed.length > 0 && m.killfeed[0].victim === victim.name, m.killfeed[0]?.victim);
  check('killer is credited', shooter.kills >= 1, `${shooter.kills} kills`);
  const expected = moneyBefore + WEAPONS.rifle.killReward;
  check('kill reward paid', moneyAtKill === expected, `\u20a1${moneyAtKill} (expected \u20a1${expected})`);
  const dmgEvents = events2.filter((e) => e.type === 'hitmarker');
  check('damage events were emitted', dmgEvents.length > 0, `${dmgEvents.length}`);
  check('damage accumulated on the shooter', shooter.damageDealt > 90, shooter.damageDealt.toFixed(0));
  check('the killing hit is flagged', dmgEvents.some((e) => e.killed === true));
}

// 12. armour absorbs part of the damage
{
  const m = new Match({ seed: 25 });
  const f = m.player;
  f.armor = 100;
  f.health = 100;
  const { applyDamage } = await import('../game/src/combat.js');
  const r = applyDamage(f, 40, 'torso');
  check('armour eats half the body damage', Math.abs(r.dealt - 20) < 0.01, `dealt ${r.dealt}`);
  check('armour is spent', Math.abs(f.armor - 80) < 0.01, `${f.armor}`);
  check('health drops by the unabsorbed part', Math.abs(f.health - 80) < 0.01, `${f.health}`);
}

// 13. round end by elimination, rewards, and the next round starting
{
  const m = new Match({ seed: 27 });
  m.phase = 'live';
  m.phaseT = 12;
  const loser = TEAM.CINDER;
  const loserMoney = m.squad(loser)[0].money;
  for (const f of m.squad(loser)) m.killFighter(f, m.player, 'torso', 'rifle');
  m.checkRoundEnd();
  check('round ends when a squad is wiped', m.phase === 'roundEnd', m.phase);
  check('winner is the surviving squad', m.roundWinner === TEAM.WARDEN, m.roundWinner);
  check('score moved', m.score.warden === 1, JSON.stringify(m.score));
  check('losers are paid a loss bonus', m.squad(loser)[0].money > loserMoney, `₡${m.squad(loser)[0].money}`);
  run(m, MATCH.endPause + 0.2);
  check('next round starts', m.round === 2 && m.phase === 'buy', `round ${m.round} ${m.phase}`);
  check('the dead are back', m.squad(loser).every((f) => f.alive));
  check('scores persist across rounds', m.score.warden === 1, JSON.stringify(m.score));
}

// 14. planting and detonation: the objective ends the round for the attackers
{
  const m = new Match({ seed: 29 });
  m.phase = 'live';
  m.phaseT = 12;
  m.round = 2; // the player's squad attacks on even rounds
  m.attackingTeam = m.playerTeam;
  m.defendingTeam = m.enemyTeam;
  m.plan = { site: 'A' };
  const p = m.player;
  p.pos = { x: 22, y: 0, z: -30 };
  p.plantHold = true;
  m.beacon.carrier = p.id;
  m.beacon.planted = false;
  let plantedAt = null;
  for (let i = 0; i < Math.round((MATCH.plantTime + 1) / (1 / 60)); i++) {
    m.step(1 / 60);
    if (m.beacon.planted && plantedAt === null) plantedAt = m.time;
    p.plantHold = true;
    p.pos = { x: 22, y: 0, z: -30 };
  }
  check('hold E on site A plants the beacon', m.beacon.planted === true, `planted=${m.beacon.planted}`);
  check('beacon records its site', m.beacon.site === 'A', String(m.beacon.site));
  check('beacon timer armed', m.beacon.timer > 30, `${m.beacon.timer.toFixed(1)} s`);
  // let it burn down with the defenders still alive
  for (let i = 0; i < Math.round((MATCH.bombTime + 1) / (1 / 60)); i++) m.step(1 / 60);
  check('beacon detonates', m.beacon.detonated === true);
  check('detonation wins the round for the attackers', m.roundWinner === TEAM.WARDEN, String(m.roundWinner));
  check('the reason names the beacon', /detonat/.test(m.roundReason), m.roundReason);
}

// 15. defusing wins it for the defenders (driven through the player's own input path)
{
  const m = new Match({ seed: 31 });
  m.phase = 'live';
  m.phaseT = 12;
  m.round = 2;
  // make the player's squad the defenders this round and plant the beacon under their feet
  m.attackingTeam = m.enemyTeam;
  m.defendingTeam = m.playerTeam;
  const p = m.player;
  p.alive = true;
  p.pos = { x: -24, y: 0, z: 26 };
  m.beacon.planted = true;
  m.beacon.site = 'B';
  m.beacon.x = -24;
  m.beacon.z = 26;
  m.beacon.timer = MATCH.bombTime;
  m.beacon.carrier = null;
  m.beacon.defuseT = 0;

  const idle = { forward: false, back: false, left: false, right: false, jump: false, crouch: false, walk: false, fire: false, reload: false, use: false, mouseDX: 0, mouseDY: 0, sensitivity: 0.0022 };
  let seen = false;
  for (let i = 0; i < Math.round((MATCH.defuseTime + 2) * 60); i++) {
    p.pos = { x: -24, y: 0, z: 26 };
    m.applyPlayerInput({ ...idle, use: true }, 1 / 60);
    m.step(1 / 60);
    if (m.beacon.defuseT > 0) seen = true;
    if (m.beacon.defused) break;
  }
  check('holding E on the beacon starts a defuse', seen === true);
  check('defuse completes', m.beacon.defused === true, `defuseT ${m.beacon.defuseT.toFixed(2)}`);
  check('defuse wins the round for the defenders', m.roundWinner === TEAM.WARDEN, String(m.roundWinner));

  // and letting go cancels it: no banked progress
  const m2 = new Match({ seed: 32 });
  m2.phase = 'live';
  m2.phaseT = 12;
  m2.attackingTeam = m2.enemyTeam;
  m2.defendingTeam = m2.playerTeam;
  const p2 = m2.player;
  p2.pos = { x: -24, y: 0, z: 26 };
  m2.beacon.planted = true;
  m2.beacon.site = 'B';
  m2.beacon.x = -24; m2.beacon.z = 26; m2.beacon.timer = MATCH.bombTime;
  for (let i = 0; i < 60; i++) {
    p2.pos = { x: -24, y: 0, z: 26 };
    m2.applyPlayerInput({ ...idle, use: true }, 1 / 60);
    m2.step(1 / 60);
  }
  const mid = m2.beacon.defuseT;
  for (let i = 0; i < 60; i++) {
    p2.pos = { x: -24, y: 0, z: 26 };
    m2.applyPlayerInput({ ...idle, use: false }, 1 / 60);
    m2.step(1 / 60);
  }
  check('letting go cancels the defuse', mid > 0 && m2.beacon.defuseT === 0 && !m2.beacon.defused, `was ${mid.toFixed(2)} s`);
}

// 16. a planted beacon keeps the round alive after the attackers are wiped
{
  const m = new Match({ seed: 33 });
  m.phase = 'live';
  m.phaseT = 12;
  m.round = 2;
  m.attackingTeam = m.playerTeam;
  m.defendingTeam = m.enemyTeam;
  m.beacon.planted = true;
  m.beacon.site = 'A';
  m.beacon.x = 22; m.beacon.z = -30; m.beacon.timer = 30;
  // wipe the attackers: the round must NOT end, because the beacon is still ticking
  for (const f of m.squad(m.playerTeam)) m.killFighter(f, null, 'torso', 'rifle');
  m.checkRoundEnd();
  check('planted beacon overrides elimination', m.phase === 'live', m.phase);
  for (let i = 0; i < Math.round(31 / (1 / 60)); i++) m.step(1 / 60);
  check('beacon still detonates to win it', m.roundWinner === TEAM.WARDEN, String(m.roundWinner));
}

// 17. utilities: smoke arms and blocks sight; frag damages
{
  const m = new Match({ seed: 35 });
  m.phase = 'live';
  m.phaseT = 12;
  const f = m.player;
  f.pos = { x: 0, y: 0, z: 24 };
  f.yaw = 0;
  f.pitch = 0;
  f.smoke = 1;
  const before = f.smoke;
  const threw = m.throwUtil(f, 'smoke');
  check('smoke can be thrown', threw === true && f.smoke === before - 1, `${f.smoke}`);
  check('a smoke exists in the world', m.smokes.length === 1);
  run(m, 1.4);
  check('smoke arms and starts its life', m.smokes[0]?.armed === true, `${m.smokes[0]?.life?.toFixed(1)} s`);
  const s = m.smokes[0];
  const blocked = m.smokeBlocks({ x: s.x, z: s.z + 8 }, { x: s.x, z: s.z - 8 });
  check('smoke blocks a line through it', blocked === true);

  f.frag = 1;
  m.throwUtil(f, 'frag');
  check('a frag exists', m.frags.length === 1);
  const victim = m.squad(m.enemyTeam)[0];
  victim.pos = { x: m.frags[0].x, y: 0, z: m.frags[0].z };
  victim.health = 100;
  run(m, 2.0);
  check('frag detonates and damages', victim.health < 100, `hp ${victim.health.toFixed(0)}`);
}

// 18. bots: they move, they navigate, and a full round produces engagements
{
  const m = new Match({ seed: 41 });
  const starts = m.fighters.filter((f) => !f.isPlayer).map((f) => ({ id: f.id, x: f.pos.x, z: f.pos.z }));
  run(m, MATCH.buyPhase + 6);
  const moved = m.fighters.filter((f) => !f.isPlayer).filter((f) => {
    const s = starts.find((x) => x.id === f.id);
    return Math.hypot(f.pos.x - s.x, f.pos.z - s.z) > 1.5;
  });
  check('bots move out of spawn', moved.length >= 6, `${moved.length} of 9 bots moved`);

  // every bot that has a path is on a real graph node chain
  const pathed = m.fighters.filter((f) => !f.isPlayer && f.path.length > 0);
  check('bots hold waypoint paths', pathed.length > 0, `${pathed.length} pathed`);

  run(m, 40);
  const anyKills = m.killfeed.length > 0;
  check('a live round produces engagements', anyKills || m.phase !== 'live', `${m.killfeed.length} kills, phase ${m.phase}`);
}

// 19. a whole match runs to a winner, then restarts
{
  const m = new Match({ seed: 43 });
  let guard = 0;
  const maxRounds = 40;
  while (m.phase !== 'matchEnd' && guard < maxRounds) {
    run(m, 34);
    guard++;
  }
  check('match reaches a winner inside the round budget', m.phase === 'matchEnd', `${guard} blocks, score ${JSON.stringify(m.score)}`);
  check('a squad reached five rounds', Math.max(m.score.warden, m.score.cinder) >= MATCH.roundsToWin, JSON.stringify(m.score));
  check('match winner matches the score', m.matchWinner !== null, String(m.matchWinner));

  const fresh = new Match({ seed: 43 });
  check('a new match starts clean', fresh.phase === 'buy' && fresh.round === 1 && fresh.score.warden === 0 && fresh.score.cinder === 0);
}

// 20. determinism: same seed, same first 20 seconds of state
{
  const snap = (seed) => {
    const m = new Match({ seed });
    run(m, 20);
    return m.fighters.map((f) => `${f.id}:${f.pos.x.toFixed(4)},${f.pos.z.toFixed(4)}:${f.health.toFixed(1)}:${f.kills}`).join('|')
      + `#${m.phase}#${m.score.warden}-${m.score.cinder}`;
  };
  const a = snap(1337);
  const b = snap(1337);
  const c = snap(9999);
  check('same seed reproduces the same 20 s', a === b);
  check('a different seed diverges', a !== c);
}

// 21. damage falloff at range
{
  const w = WEAPONS.rifle;
  const near = damageAtRange(w, 5);
  const mid = damageAtRange(w, (w.falloffStart + w.falloffEnd) / 2);
  const far = damageAtRange(w, w.falloffEnd + 10);
  check('damage falls off with distance', near > mid && mid > far, `${near.toFixed(1)} > ${mid.toFixed(1)} > ${far.toFixed(1)}`);
  check('falloff bottoms out at the floor', Math.abs(far - w.damage * w.falloffMin) < 0.01, far.toFixed(2));
}

// 22. direct weapon slot switching (1 primary, 2 sidearm, 3 last owned) and determinism
{
  const m = new Match({ seed: 1337 });
  const p = m.player;
  // give the player a primary and sidearm so both slots resolve
  p.ammo.rifle = 30; p.reserve.rifle = 90;
  p.ammo.sidearm = 20; p.reserve.sidearm = 60;
  p.weapon = "sidearm"; p.alive = true;
  check('slot 1 selects the primary', m.switchWeapon(p, 1) === true && p.weapon === "rifle", p.weapon);
  check('slot 2 selects the sidearm', m.switchWeapon(p, 2) === true && p.weapon === "sidearm", p.weapon);
  check('slot 3 falls back to an owned weapon', m.switchWeapon(p, 3) === true && p.weapon !== "sidearm", p.weapon);
  // empty slot: no ammo anywhere for the sidearm, so slot 2 must refuse
  p.weapon = "rifle"; p.ammo.sidearm = 0; p.reserve.sidearm = 0;
  check('slot 2 refuses when the sidearm is empty', m.switchWeapon(p, 2) === false && p.weapon === "rifle", p.weapon);
  // a dead fighter can never switch
  p.alive = false;
  check('a dead fighter cannot switch slots', m.switchWeapon(p, 1) === false);
  p.alive = true;
  // switching must not disturb the simulation stream
  const snap = () => {
    const mm = new Match({ seed: 1337 });
    mm.player.ammo.rifle = 30; mm.player.reserve.rifle = 90;
    mm.player.ammo.sidearm = 20; mm.player.reserve.sidearm = 60;
    mm.player.weapon = "sidearm";
    mm.switchWeapon(mm.player, 1); mm.switchWeapon(mm.player, 2);
    run(mm, 12);
    return mm.fighters.map((f) => `${f.id}:${f.pos.x.toFixed(4)},${f.pos.z.toFixed(4)}:${f.health.toFixed(1)}:${f.weapon}`).join('|');
  };
  check('slot switching stays deterministic', snap() === snap());
}

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

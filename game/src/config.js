export const TICK = 1 / 60;
export const MAX_STEPS = 5;
export const TEAM = {WARDEN: "warden",CINDER: "cinder"};
export const PALETTE = {
warden: 0x46d9c2,wardenDeep: 0x12866f,cinder: 0xff7a45,
cinderDeep: 0xa8340f,concrete: 0x8d9298,concreteDark: 0x545a60,
metal: 0x6b7379,metalDark: 0x3b4247,hazard: 0xf2b23a,
site: 0xffcf5c,fog: 0x8a5b45,sky: 0xc96b43,
 ember: 0xff5a2a};
export const HEADSHOT_MULT = 2.5;
export const LIMB_MULT = 0.72;
export const WEAPONS = {
 sidearm: {
name: "CQ-9 TAP",slot: 1,kind: "pistol",
damage: 26,headDamage: 26 * HEADSHOT_MULT,rpm: 320,
mag: 20,reserve: 80,reloadTime: 1.55,
spreadBase: 0.0042,spreadMove: 0.021,spreadAir: 0.055,
spreadCrouch: 0.0022,recoilUp: 0.0105,recoilSide: 0.0042,
recoilRecover: 5.4,range: 60,falloffStart: 18,
falloffEnd: 60,falloffMin: 0.62,penetration: 0.0,
auto: false,moveSpeed: 1.0,sound: "pistol",
cost: 0,
  killReward: 300},
 smg: {
name: "RASP-4 NEEDLER",slot: 1,kind: "smg",
damage: 21,headDamage: 21 * HEADSHOT_MULT,rpm: 780,
mag: 30,reserve: 90,reloadTime: 1.95,
spreadBase: 0.0072,spreadMove: 0.0125,spreadAir: 0.05,
spreadCrouch: 0.0044,recoilUp: 0.0088,recoilSide: 0.0052,
recoilRecover: 6.2,range: 55,falloffStart: 14,
falloffEnd: 50,falloffMin: 0.55,penetration: 0.0,
auto: true,moveSpeed: 0.97,sound: "smg",
cost: 1250,
  killReward: 600},
 rifle: {
name: "VK-7 LANCER",slot: 1,kind: "rifle",
damage: 33,headDamage: 33 * HEADSHOT_MULT,rpm: 600,
mag: 30,reserve: 90,reloadTime: 2.35,
spreadBase: 0.0028,spreadMove: 0.032,spreadAir: 0.075,
spreadCrouch: 0.0016,recoilUp: 0.0165,recoilSide: 0.006,
recoilRecover: 5.0,range: 90,falloffStart: 26,
falloffEnd: 80,falloffMin: 0.7,penetration: 0.12,
auto: true,moveSpeed: 0.94,sound: "rifle",
cost: 2100,
  killReward: 300},
 marksman: {
name: "HR-3 SENTINEL",slot: 1,kind: "marksman",
damage: 78,headDamage: 78 * HEADSHOT_MULT,rpm: 95,
mag: 10,reserve: 30,reloadTime: 2.9,
spreadBase: 0.0011,spreadMove: 0.055,spreadAir: 0.1,
spreadCrouch: 0.0006,recoilUp: 0.034,recoilSide: 0.008,
recoilRecover: 3.6,range: 140,falloffStart: 50,
falloffEnd: 140,falloffMin: 0.86,penetration: 0.45,
auto: false,moveSpeed: 0.86,sound: "marksman",
cost: 3200,
  killReward: 100},
 knife: {
name: "K-2 CLEAVER",slot: 3,kind: "melee",
damage: 55,headDamage: 55 * HEADSHOT_MULT,rpm: 110,
mag: 1e9,reserve: 0,reloadTime: 0,
spreadBase: 0.0,spreadMove: 0.0,spreadAir: 0.0,
spreadCrouch: 0.0,recoilUp: 0.004,recoilSide: 0.001,
recoilRecover: 8.0,range: 2.4,falloffStart: 1.6,
falloffEnd: 2.4,falloffMin: 0.5,penetration: 0.0,
auto: false,moveSpeed: 1.06,sound: "knife",
cost: 0,
  killReward: 400}};
export const BUY = {
kevlar: {name: "KEVLAR VEST",cost: 650,armour: 100},smoke: {name: "VEIL SMOKE",cost: 300,count: 1},
 frag: {name: "SPLIT FRAG",cost: 300,count: 1}};
export const UTIL = {smoke: {fuse: 1.2,duration: 18,radius: 6.2},frag: {fuse: 1.7,damage: 90,radius: 7.0,falloffFrom: 1.6}};
export const SQUAD = 4;
export const MATCH = {
roundsToWin: 5,buyPhase: 15,roundTime: 105,
bombTime: 40,plantTime: 3.2,defuseTime: 7.0,
endPause: 4.2,startMoney: 800,maxMoney: 16000,
winReward: 3250,lossRewardBase: 1400,lossRewardStep: 400,
lossRewardMax: 2900,plantReward: 300,defuseReward: 300,
 teamKillPenalty: 700};
export const SITES = {A: {id: "A",label: "SITE A",center: [ 25.5, 0, -34.5 ],radius: 2.6,hex: 0x3fd9ff,lamp: 0x7fe4ff},B: {id: "B",label: "SITE B",center: [ -18.5, 0, 29.5 ],radius: 2.4,hex: 0xffa832,lamp: 0xffbf5c}};
export const SPAWNS = {
warden: [ [ 0, 0.2, 44.2 ], [ 3.6, 0.2, 43.4 ], [ -3.6, 0.2, 43.4 ], [ 6.8, 0.2, 41.6 ], [ -6.8, 0.2, 41.6 ] ],
 cinder: [ [ 0, 0.2, -42.2 ], [ 3.6, 0.2, -41.4 ], [ -3.6, 0.2, -41.4 ], [ 6.8, 0.2, -39.6 ], [ -6.8, 0.2, -39.6 ] ]};
export const MOVE = {
walkSpeed: 9.4,duckSpeed: 4.3,airSpeed: 9.4,
accelerate: 62,friction: 42,airAccel: 12,
jumpSpeed: 8.6,gravity: 24,standHeight: 1.78,
crouchHeight: 1.14,eyeStand: 1.62,eyeCrouch: 1.02,
radius: 0.42,stepHeight: 0.52,
 maxHealth: 100};
export const BOT = {
fovDeg: 112,viewRange: 86,reactionMin: 0.16,
reactionMax: 0.42,aimTime: 0.55,aimErrorBase: 0.055,
aimErrorMin: 0.014,trackSpeed: 4.6,strafeInterval: 1.15,
repathInterval: 1.5,hearRange: 42,
 skill: 0.62};
export const SHOTS = {
buy: {simSeconds: 4.2,mode: "buy"},combat: {simSeconds: 20.5,mode: "combat",stage: true,range: 8.0},site: {simSeconds: 30.0,mode: "site"},
 hud: {simSeconds: 21.0,mode: "combat",stage: true,range: 7.2}};
export const SHOT_SPOTS = {combat: [ -1, 17, 0, 4 ],site: [ -26, 31, -8, 18 ],hud: [ -1.2, 17.2, 0, 4 ]};
export const DEMO = {seed: 1337,waypoints: [ [ 0, 36 ], [ -4.6, 33 ], [ 4.4, 28 ], [ 0, 24 ], [ -3.4, 20 ], [ 3.2, 16 ], [ 0, 11 ], [ -8.4, 10 ], [ -16, 4 ], [ -31, 6 ], [ -36, 12 ], [ -30, 18 ], [ -26, 24 ] ],buyList: [ "kevlar", "rifle", "frag", "smoke" ]};
export const KEYS = {
forward: [ "KeyW", "ArrowUp" ],back: [ "KeyS", "ArrowDown" ],left: [ "KeyA", "ArrowLeft" ],
right: [ "KeyD", "ArrowRight" ],jump: [ "Space" ],crouch: [ "ControlLeft", "ControlRight", "KeyC" ],
walk: [ "ShiftLeft", "ShiftRight" ],reload: [ "KeyR" ],buy: [ "KeyB" ],
use: [ "KeyE" ],pause: [ "Escape" ],mute: [ "KeyM" ],
slot1: [ "Digit1" ], slot2: [ "Digit2" ], slot3: [ "Digit3" ],
smoke: [ "Digit4", "KeyG" ],
 frag: [ "Digit5", "KeyF" ]};

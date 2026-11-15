import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, Group, DirectionalLight, HemisphereLight, AmbientLight, PointLight, Fog, PlaneGeometry, DoubleSide, MeshBasicMaterial, CircleGeometry, TorusGeometry, SpotLight, BufferGeometry, BufferAttribute, Points, PointsMaterial, SphereGeometry, BackSide, Color, InstancedMesh, Matrix4 } from "three";
import { surfaceMaps, stencilTexture, emitterTexture, panelGlowTexture, makeSign } from "./textures.js";
import { SOLIDS, CATWALK_SOLIDS, props, SITE_PADS, MAP_BOUNDS, WAYPOINTS } from "./map.js";
import { PALETTE } from "./config.js";
const UNIT_BOX = new BoxGeometry(1, 1, 1);
function boxMesh(mat, x1, y0, z1, x2, y1, z2, shadows = true) {
 const mesh = new Mesh(UNIT_BOX, mat); const w = Math.max(0.02, x2 - x1);
 const h = Math.max(0.02, y1 - y0); const d = Math.max(0.02, z2 - z1);
 mesh.scale.set(w, h, d); mesh.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
 mesh.castShadow = shadows; mesh.receiveShadow = true;
 return mesh;
}
const UNIT_MATRIX = new Matrix4;
function instanceBoxes(parent, mat, boxes, shadows = true) {
 if (boxes.length === 0) return null; const mesh = new InstancedMesh(UNIT_BOX, mat, boxes.length);
 const S = new Matrix4;
 for (let i = 0; i < boxes.length; i++) {
  const b = boxes[i]; const w = Math.max(0.02, b.x2 - b.x1);
  const h = Math.max(0.02, b.y1 - b.y0); const d = Math.max(0.02, b.z2 - b.z1);
  S.copy(UNIT_MATRIX); S.makeScale(w, h, d);
  S.setPosition((b.x1 + b.x2) / 2, (b.y0 + b.y1) / 2, (b.z1 + b.z2) / 2); mesh.setMatrixAt(i, S);
 }
 mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = shadows;
 mesh.receiveShadow = true; mesh.frustumCulled = false;
 parent.add(mesh); return mesh;
}
export class World {
 constructor(scene) {
  this.scene = scene; this.group = new Group;
  scene.add(this.group); this.dynamic = new Group;
  scene.add(this.dynamic); this.siteMarkers = new Map;
  this.time = 0; this.buildMaterials();
  this.buildLights(); this.buildGeometry();
  this.buildProps(); this.buildSites();
  this.buildSigns();
  this.buildSkybox();
 }
 buildSigns() {
  const plates = [
   [ "SITE A", 22, -20.6, 0 ], [ "SITE B", -24, 16.6, Math.PI ],
   [ "MID", -6.4, 6, Math.PI / 2 ], [ "SPAWN", 0, 42, Math.PI ] ];
  for (const [ label, x, z, ry ] of plates) {
   const plate = new Mesh(new PlaneGeometry(4.2, 1.05), new MeshBasicMaterial({ map: makeSign(label), transparent: true }));
   plate.position.set(x, 3.15, z); plate.rotation.y = ry; this.group.add(plate);
  }
 }
 buildMaterials() {
  const concrete = surfaceMaps("concrete"), steel = surfaceMaps("steel"), hazard = surfaceMaps("hazard"), deck = surfaceMaps("deck");
  const std = (set, look) => new MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, ...look });
  const teal = emitterTexture("#46d9c2");
  this.mats = {
   wall: std(concrete, { color: 0xc89e72, roughness: 0.94, metalness: 0.03 }),
   block: std(steel, { color: 0xa8815c, roughness: 0.58, metalness: 0.38 }),
   crate: std(steel, { color: 0x7a4b2a, roughness: 0.82, metalness: 0.14 }),
   barrier: std(hazard, { color: 0xffe8c8, roughness: 0.72, metalness: 0.18 }),
   pillar: std(steel, { color: 0x8d6b4d, roughness: 0.44, metalness: 0.62 }),
   deck: std(deck, { color: 0xb08a62, roughness: 0.64, metalness: 0.34 }),
   stair: std(deck, { color: 0xa07c58, roughness: 0.7, metalness: 0.3 }),
   rail: std(steel, { color: 0xc9a884, roughness: 0.36, metalness: 0.8 }),
   pipe: std(steel, { color: 0x94714f, roughness: 0.42, metalness: 0.72 }),
   tank: std(steel, { color: 0x8a6746, roughness: 0.5, metalness: 0.58 }),
   trim: new MeshStandardMaterial({ color: 0x3a2517, roughness: 0.5, metalness: 0.55 }),
   emitter: new MeshStandardMaterial({ map: teal, emissiveMap: teal, emissive: new Color(0x2ad8bc), emissiveIntensity: 1.6, roughness: 0.34, metalness: 0.5 }),
   sign: new MeshStandardMaterial({ map: panelGlowTexture(), emissiveMap: panelGlowTexture(), emissive: new Color(0x39c9c4), emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.3 }),
   hazard: std(hazard, { color: 0xffe8c8, roughness: 0.8, metalness: 0.12 }),
   floor: std({ map: deck.map.clone(), normalMap: deck.normalMap.clone(), roughnessMap: deck.roughnessMap.clone() }, { color: 0xc9a882, roughness: 0.9, metalness: 0.08 })
  };
  for (const t of [ this.mats.floor.map, this.mats.floor.normalMap, this.mats.floor.roughnessMap ]) t.repeat.set(18, 22);
 }
 buildLights() {
  const scene = this.scene; scene.fog = new Fog(PALETTE.fog, 46, 190);
  scene.background = new Color(PALETTE.sky); const key = new DirectionalLight(0xffdfb8, 5.6);
  key.position.set(-38, 62, 44); key.target.position.set(2, 0, -4);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -58; key.shadow.camera.right = 58;
  key.shadow.camera.top = 58; key.shadow.camera.bottom = -58;
  key.shadow.camera.near = 6; key.shadow.camera.far = 190;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.028;
  key.shadow.radius = 1.5; scene.add(key);
  scene.add(key.target); this.key = key;
  const hemi = new HemisphereLight(0xffd9b0, 0x6b4a3a, 1.15); scene.add(hemi);
  scene.add(new AmbientLight(0xd9a888, 0.3)); const rim = new DirectionalLight(0xff8f4a, 1.5);
  rim.position.set(34, 30, -60); rim.target.position.set(0, 0, -10);
  scene.add(rim); scene.add(rim.target);
  for (const site of SITE_PADS) {
   const lamp = new PointLight(0xffcb70, 34, 30, 2); lamp.position.set(site.center[0], 6.4, site.center[2]);
   scene.add(lamp);
  }
  const mid = new PointLight(0x74e6de, 22, 36, 2); mid.position.set(0, 7.2, 6);
  scene.add(mid); const spotA = new SpotLight(0xcfe4ff, 34, 30, 0.72, 0.5, 1.6);
  spotA.position.set(34, 9.4, -6); spotA.target.position.set(34, 3.3, 2);
  scene.add(spotA); scene.add(spotA.target);
  const spotB = new SpotLight(0xcfe4ff, 30, 30, 0.72, 0.5, 1.6); spotB.position.set(-34, 9.4, 10);
  spotB.target.position.set(-34, 3.3, 2); scene.add(spotB);
  scene.add(spotB.target);
 }
 buildGeometry() {
  const floor = new Mesh(new PlaneGeometry(124, 140), this.mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  this.group.add(floor);
  const byMat = new Map;
  const push = (mat, box) => {
   let list = byMat.get(mat);
   if (list === void 0) {
    list = []; byMat.set(mat, list);
   }
   list.push(box);
  };
  for (const s of SOLIDS) {
   push(this.mats[s.kind] ?? this.mats.wall, s);
   if (s.kind === "block" && s.y1 > 5) push(this.mats.trim, { x1: s.x1 - 0.14, x2: s.x2 + 0.14, z1: s.z1 - 0.14, z2: s.z2 + 0.14, y0: s.y1 - 0.42, y1: s.y1 });
   if (s.kind === "wall") {
    const wide = s.x2 - s.x1 > s.z2 - s.z1;
    push(this.mats.trim, wide ? { x1: s.x1, x2: s.x2, z1: s.z1 - 0.05, z2: s.z2 + 0.05, y0: 2.3, y1: 2.46 } : { x1: s.x1 - 0.05, x2: s.x2 + 0.05, z1: s.z1, z2: s.z2, y0: 2.3, y1: 2.46 });
    push(this.mats.hazard, wide ? { x1: s.x1, x2: s.x2, z1: s.z1 - 0.06, z2: s.z2 + 0.06, y0: 0, y1: 0.16 } : { x1: s.x1 - 0.06, x2: s.x2 + 0.06, z1: s.z1, z2: s.z2, y0: 0, y1: 0.16 });
   }
  }
  for (const s of CATWALK_SOLIDS) push(this.mats[s.kind] ?? this.mats.deck, s);
  for (const [mat, boxes] of byMat) instanceBoxes(this.group, mat, boxes);
 }
 buildProps() {
  const g = this.group;
  for (const p of props) if (p.kind === "pipe") {
   const len = Math.hypot(p.x2 - p.x1, p.z2 - p.z1); const geo = new CylinderGeometry(p.r, p.r, len, 10, 1);
   const mesh = new Mesh(geo, this.mats.pipe); mesh.rotation.z = Math.PI / 2;
   mesh.position.set((p.x1 + p.x2) / 2, p.y, (p.z1 + p.z2) / 2);
   if (Math.abs(p.z2 - p.z1) > Math.abs(p.x2 - p.x1)) mesh.rotation.y = Math.PI / 2; mesh.castShadow = true;
   mesh.receiveShadow = true; g.add(mesh);
   const n = Math.max(2, Math.round(len / 8));
   for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n; const bx = p.x1 + (p.x2 - p.x1) * t;
    const bz = p.z1 + (p.z2 - p.z1) * t;
    g.add(boxMesh(this.mats.trim, bx - 0.1, p.y - p.r - 0.32, bz - 0.1, bx + 0.1, p.y - p.r, bz + 0.1));
   }
  } else if (p.kind === "tank") {
   const body = new Mesh(new CylinderGeometry(p.r, p.r, p.h, 16, 1), this.mats.tank);
   body.position.set(p.x, p.h / 2, p.z); body.castShadow = true;
   body.receiveShadow = true; g.add(body);
   const cap = new Mesh(new CylinderGeometry(p.r * 0.62, p.r * 0.62, 0.24, 16, 1), this.mats.trim);
   cap.position.set(p.x, p.h + 0.1, p.z); g.add(cap);
   for (const yy of [ p.h * 0.28, p.h * 0.68 ]) {
    const band = new Mesh(new TorusGeometry(p.r + 0.03, 0.055, 6, 20), this.mats.hazard);
    band.rotation.x = Math.PI / 2; band.position.set(p.x, yy, p.z);
    g.add(band);
   }
  } else if (p.kind === "sign") {
   const post = boxMesh(this.mats.trim, p.x - 0.07, 0, p.z - 0.07, p.x + 0.07, 2.4, p.z + 0.07); g.add(post);
   const panel = new Mesh(new PlaneGeometry(2.2, 0.72), this.mats.sign); panel.position.set(p.x, 2.66, p.z);
   panel.rotation.y = p.ry; g.add(panel);
   const stencil = new Mesh(new PlaneGeometry(2.2, 0.72), new MeshBasicMaterial({ map: stencilTexture(p.text, "#dff8f4"), transparent: true, depthWrite: false }));
   stencil.position.set(p.x, 2.66, p.z); stencil.rotation.y = p.ry;
   stencil.translateZ(0.012); g.add(stencil);
  }
  for (const cw of [ 0, 1 ]) {
   const deck = cw === 0 ? { x1: 30, z1: -16, x2: 38, z2: 12 } : { x1: -38, z1: -6, x2: -30, z2: 18 };
   const step = 2.6;
   for (let z = deck.z1; z <= deck.z2 + 0.01; z += step) {
    const px = cw === 0 ? deck.x1 + 0.15 : deck.x2 - 0.15;
    g.add(boxMesh(this.mats.rail, px - 0.06, 3.3, z - 0.06, px + 0.06, 4.4, z + 0.06));
   }
   const px = cw === 0 ? deck.x1 + 0.15 : deck.x2 - 0.15;
   g.add(boxMesh(this.mats.rail, px - 0.05, 4.32, deck.z1, px + 0.05, 4.44, deck.z2));
   g.add(boxMesh(this.mats.rail, px - 0.04, 3.86, deck.z1, px + 0.04, 3.94, deck.z2));
  }
 }
 buildSites() {
  for (const site of SITE_PADS) {
   const glowMat = this.mats.emitter.clone();
   glowMat.emissive = new Color(site.hex);
   glowMat.color = new Color(site.hex);
   const [cx, , cz] = site.center;
   const pad = new Mesh(new CircleGeometry(site.radius, 44), glowMat); pad.rotation.x = -Math.PI / 2;
   pad.position.set(cx, 0.035, cz); pad.receiveShadow = false;
   this.group.add(pad);
   const ring = new Mesh(new TorusGeometry(site.radius + 0.12, 0.075, 8, 48), glowMat);
   ring.rotation.x = Math.PI / 2; ring.position.set(cx, 0.09, cz);
   this.group.add(ring); const pylon = new Group;
   for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 * i + Math.PI / 4; const px = Math.cos(a) * (site.radius + 1.15);
    const pz = Math.sin(a) * (site.radius + 1.15);
    const body = boxMesh(this.mats.trim, -0.16, 0, -0.16, 0.16, 1.5, 0.16); body.position.set(px, 0.75, pz);
    pylon.add(body); const cap = boxMesh(glowMat, -0.19, 1.5, -0.19, 0.19, 1.62, 0.19);
    cap.position.set(px, 1.56, pz); pylon.add(cap);
   }
   pylon.position.set(cx, 0, cz); this.group.add(pylon);
   const housing = new Group;
   const base = new Mesh(new CylinderGeometry(0.62, 0.78, 0.34, 12), this.mats.trim); base.position.y = 0.17;
   base.castShadow = true; housing.add(base);
   const column = new Mesh(new CylinderGeometry(0.3, 0.36, 1.05, 12), this.mats.tank);
   column.position.y = 0.86; column.castShadow = true;
   housing.add(column); const collar = new Mesh(new TorusGeometry(0.34, 0.06, 8, 20), glowMat);
   collar.rotation.x = Math.PI / 2; collar.position.y = 1.3;
   housing.add(collar); const core = new Mesh(new CylinderGeometry(0.17, 0.17, 0.5, 8), glowMat);
   core.position.y = 1.62; housing.add(core);
   housing.position.set(cx + 1.6, 0, cz - 1.6); this.group.add(housing);
   const glow = new PointLight(site.lamp, 16, 17, 2); glow.position.set(cx, 2.2, cz);
   this.group.add(glow);
   this.siteMarkers.set(site.id, { pad: pad, ring: ring, pylon: pylon, housing: housing, glow: glow, core: core });
  }
 }
 buildSkybox() {
  let s = 0x51ed270b;
  const rnd = () => {
   s = s * 1664525 + 1013904223 >>> 0; return s / 4294967296;
  }; const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
   const theta = rnd() * Math.PI * 2; const phi = Math.acos(1 - rnd() * 1.05);
   const r = 250; positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
   positions[i * 3 + 1] = Math.cos(phi) * r * 0.8 + 40;
   positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new BufferGeometry; starGeo.setAttribute("position", new BufferAttribute(positions, 3));
  const stars = new Points(starGeo, new PointsMaterial({ color: 0xd8e6ef, transparent: true, opacity: 0.82, size: 1.7, sizeAttenuation: false }));
  stars.frustumCulled = false; this.scene.add(stars);
  const limb = new Mesh(new SphereGeometry(300, 24, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.12), new MeshBasicMaterial({ color: 0x1d3f4e, side: BackSide, fog: false }));
  limb.position.set(10, -216, -70); this.scene.add(limb);
 }
 update(dt) {
  this.time += dt; const pulse = 0.72 + 0.28 * Math.sin(this.time * 2.1);
  for (const marker of this.siteMarkers.values()) {
   marker.glow.intensity = 6 + pulse * 5; marker.pad.material.emissiveIntensity = 0.95 + pulse * 0.5;
  }
 }
}

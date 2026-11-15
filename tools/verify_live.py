"""Live verification: pad clearance in the running game, keys 1/2/3 weapon switching."""
import json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337&shot=combat"

JS = """() => {
  const m = window.relay.match, p = m.player, out = {};
  // --- pad clearance measured from the live scene graph
  out.pads = [];
  for (const [id, marker] of window.relay.world.siteMarkers) {
    const pad = marker.pad, ring = marker.ring;
    const cx = pad.position.x, cz = pad.position.z;
    const R = pad.geometry.parameters.radius;
    const ringR = R + 0.12 + 0.075;
    let nearest = Infinity, which = null;
    for (const s of m.world.boxes ?? []) {}
    // use the collision world's own resolve() to probe the ring perimeter
    let blocked = 0;
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const px = cx + Math.cos(a) * ringR, pz = cz + Math.sin(a) * ringR;
      const fix = m.world.resolve(px, pz, 0.05, 0, 1.78, 0.5);
      const d = Math.hypot(fix.x - px, fix.z - pz);
      if (d > 0.001) blocked++;
      if (d < nearest) { nearest = d; which = [px.toFixed(2), pz.toFixed(2)]; }
    }
    // floor height at pad centre and at 4 ring points, must all be flat deck (~0)
    const floor = m.world.supportHeight(cx, cz, R * 0.9, 0, 0.5);
    out.pads.push({ id, center: [+cx.toFixed(2), +cz.toFixed(2)], radius: R,
                    ringR: +ringR.toFixed(3), ringPointsBlocked: blocked,
                    minPush: +nearest.toFixed(3), floorY: +floor.toFixed(3),
                    clears: blocked === 0 });
  }
  // --- plant trigger radius must equal the pad radius
  out.siteRadiusMatch = { A: m.nearestSite(25.5, -34.5, null)?.site.radius,
                          B: m.nearestSite(-18.5, 29.5, null)?.site.radius };
  out.insideA = m.nearestSite(25.5 + 2.5, -34.5, null)?.site.id ?? null;
  out.outsideA = m.nearestSite(25.5 + 2.8, -34.5, null)?.site.id ?? null;
  out.insideB = m.nearestSite(-18.5 + 2.3, 29.5, null)?.site.id ?? null;
  out.outsideB = m.nearestSite(-18.5 + 2.6, 29.5, null)?.site.id ?? null;

  // --- weapon slots 1/2/3
  p.alive = true; p.weapon = "sidearm";
  p.ammo.rifle = 30; p.reserve.rifle = 90;
  p.ammo.sidearm = 20; p.reserve.sidearm = 60;
  p.ammo.knife = 1;
  const s1 = m.switchWeapon(p, 1); const w1 = p.weapon;
  const s2 = m.switchWeapon(p, 2); const w2 = p.weapon;
  const s3 = m.switchWeapon(p, 3); const w3 = p.weapon;
  out.slots = { slot1: { ok: s1, weapon: w1 }, slot2: { ok: s2, weapon: w2 }, slot3: { ok: s3, weapon: w3 } };
  // knife always available even broke
  p.ammo.rifle = 0; p.reserve.rifle = 0; p.ammo.smg = 0; p.reserve.smg = 0; p.weapon = "sidearm";
  out.slot3WhenBroke = { ok: m.switchWeapon(p, 3), weapon: p.weapon };

  // --- wall material matte
  const wall = window.relay.world.mats.wall;
  out.wallMaterial = { roughness: wall.roughness, metalness: wall.metalness,
                       normalScale: wall.normalMap ? wall.normalScale.x : null };
  return out;
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                                 "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
    page = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL, wait_until="load", timeout=60000)
    page.evaluate("window.relay.captureDemo()")
    page.wait_for_function("() => window.__relayFrozen === true", timeout=180000)
    print(json.dumps(page.evaluate(JS), indent=2))
    print("errors:", errs[:5])
    b.close()

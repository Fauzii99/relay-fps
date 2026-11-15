"""Final 4-shot capture. Signs verified rendering; staging picks poses with sign + enemies in view."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path("/home/ubuntu/relay-fps-entry")
SHOTS = ROOT / "screenshots"

STAGE = """(opts) => {
  const m = window.relay.match, cam = window.relay.camera;
  const V = cam.position.constructor;
  const range = opts.range || 8;
  const signs = [];
  window.relay.world.group.children.forEach(o => {
    if (o.material && o.material.type === "MeshBasicMaterial" && o.material.map && o.geometry && o.geometry.type === "PlaneGeometry") signs.push(o);
  });
  const cands = m.fighters.filter(f => f.alive && f.team !== m.player.team);
  const proj = new V();
  let best = null;
  const evaluate = (cx, cz, yaw) => {
    cam.position.set(cx, 1.6, cz); cam.rotation.set(0, 0, 0);
    cam.rotateY(yaw); cam.rotateX(0.03);
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    let inView = 0;
    for (const o of m.fighters) {
      if (o.team === m.player.team || !o.alive) continue;
      proj.set(o.pos.x, o.pos.y + 1.0, o.pos.z).project(cam);
      if (Math.abs(proj.x) < 0.8 && Math.abs(proj.y) < 0.74 && proj.z < 1) inView++;
    }
    let signsNear = 0;
    for (const s of signs) {
      proj.set(s.position.x, s.position.y, s.position.z).project(cam);
      if (proj.z < 1 && Math.abs(proj.x) < 0.6 && Math.abs(proj.y) < 0.55) signsNear++;
    }
    return { inView, signsNear };
  };
  if (cands.length > 0) {
    for (const f of cands) {
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * Math.PI * 2;
        const cx = f.pos.x + Math.cos(a) * range, cz = f.pos.z + Math.sin(a) * range;
        if (cx < -38 || cx > 38 || cz < -46 || cz > 46) continue;
        const fix = m.world.resolve(cx, cz, 0.42, 0, 1.78, 0.5);
        if (Math.hypot(fix.x - cx, fix.z - cz) > 0.02) continue;
        if (!m.world.lineOfSight(cx, 1.55, cz, f.pos.x, f.pos.y + 1.15, f.pos.z, b => b.kind === "rail")) continue;
        const yaw = Math.atan2(-(f.pos.x - cx), -(f.pos.z - cz));
        const r = evaluate(cx, cz, yaw);
        if (r.inView < 2) continue;
        const score = r.inView * 4 + r.signsNear * 9;
        if (best === null || score > best.score) best = { score, cx, cz, yaw, ...r, tid: f.id };
      }
    }
  }
  if (best === null) {
    // no enemies: aim camera at the nearest sign instead
    for (const s of signs) {
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        const cx = s.position.x + Math.cos(a) * 9, cz = s.position.z + Math.sin(a) * 9;
        if (cx < -38 || cx > 38 || cz < -46 || cz > 46) continue;
        const fix = m.world.resolve(cx, cz, 0.42, 0, 1.78, 0.5);
        if (Math.hypot(fix.x - cx, fix.z - cz) > 0.02) continue;
        if (!m.world.lineOfSight(cx, 1.55, cz, s.position.x, s.position.y, s.position.z, b => b.kind === "rail")) continue;
        const yaw = Math.atan2(-(s.position.x - cx), -(s.position.z - cz));
        const r = evaluate(cx, cz, yaw);
        if (r.signsNear < 1) continue;
        if (best === null || r.signsNear > best.signsNear) best = { cx, cz, yaw, ...r, tid: null };
      }
    }
  }
  if (best === null) return { error: "no pose" };
  const p = m.player;
  p.pos = { x: best.cx, y: 0, z: best.cz }; p.vel = { x: 0, y: 0, z: 0 };
  p.yaw = best.yaw; p.pitch = 0.03; p.alive = true;
  p.health = 100; p.armor = Math.max(p.armor || 0, 43);
  cam.position.set(best.cx, 1.6, best.cz); cam.rotation.set(0, 0, 0);
  cam.rotateY(best.yaw); cam.rotateX(0.03); cam.updateMatrixWorld(true);
  m.smokes.length = 0; m.impacts.length = 0;
  for (const id of ["kill-banner", "damage-arc", "hit-marker", "center-toast"]) {
    const el = document.getElementById(id); if (el) { el.classList.remove("on"); el.style.opacity = "0"; }
  }
  const sv = (id, v, pct) => { const n = document.getElementById(id); if (n) n.textContent = String(v);
    const b = document.getElementById(id.replace("num", "bar")); if (b) b.style.width = pct; };
  sv("hp-num", 100, "100%"); sv("armor-num", 43, "43%");
  if (window.__relayState) { window.__relayState.health = 100; window.__relayState.alive = true; }
  let shots = 0;
  const target = best.tid !== null ? m.fighters.find(f => f.id === best.tid) : null;
  if (target) {
    const dx = target.pos.x - p.pos.x, dz = target.pos.z - p.pos.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(target.pos.y + 1.24 - (p.pos.y + 1.62), Math.hypot(dx, dz));
    for (let i = 0; i < 4; i++) {
      if ((p.ammo[p.weapon] || 0) <= 0) break;
      p.fireCooldown = 0; p.spreadBloom = 0; p.reloadDur = 0;
      if (m.tryFireFrom(p, yaw + (i - 1.5) * 0.005, pitch, { held: false })) shots++;
    }
    p.yaw = yaw; p.pitch = pitch; m.playerAim = { yaw, pitch };
    cam.rotation.set(0, 0, 0); cam.rotateY(yaw); cam.rotateX(pitch); cam.updateMatrixWorld(true);
  }
  return { ok: true, inView: best.inView, signsNear: best.signsNear, shots, tid: best.tid };
}"""

TARGETS = [("01-buy-phase","buy",None),("02-firefight","combat",8.0),("03-site-push","site",9.0),("04-tactical-hud","hud",7.0)]

def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"])
        for name, shot, rng in TARGETS:
            ctx = browser.new_context(viewport={"width":1280,"height":720}, device_scale_factor=1)
            page = ctx.new_page()
            errors = []
            page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.goto(f"http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337&shot={shot}", wait_until="load", timeout=60000)
            page.evaluate("window.relay.captureDemo()")
            try:
                page.wait_for_function("() => window.__relayFrozen === true", timeout=120000)
            except Exception:
                results.append({"shot": shot, "ok": False, "reason": "timeout"}); print(json.dumps(results[-1])); ctx.close(); continue
            stage = None
            if rng is not None:
                stage = page.evaluate(STAGE, {"range": rng})
                page.evaluate("() => window.relay.renderer.render(window.relay.scene, window.relay.camera)")
            audit = page.evaluate("""() => window.relay.match.fighters.map(f => {
                const s = window.relay.match.world.resolve(f.pos.x, f.pos.z, 0.42, f.pos.y, 1.78, 0.5);
                return { id: f.id, drift: +Math.hypot(s.x-f.pos.x, s.z-f.pos.z).toFixed(3) };
              })""")
            state = page.evaluate("() => window.__relayState")
            canvas = page.evaluate("() => { const c=document.getElementById('view'); return {w:c.width,h:c.height}; }")
            out = SHOTS / f"{name}.jpg"
            page.screenshot(path=str(out), type="jpeg", quality=88, animations="disabled", caret="hide")
            size = out.stat().st_size
            clipped = [a for a in audit if a["drift"] > 0.02]
            ok = (state["frozen"] is True and state["simTime"] >= 4.0 and state["frames"] > 30
                  and state["calls"] > 40 and size <= 262144
                  and canvas["w"] == 1280 and canvas["h"] == 720 and len(errors) == 0 and len(clipped) == 0)
            results.append({"shot": shot, "ok": ok, "bytes": size, "canvas": canvas,
                "hp": state["health"], "calls": state["calls"], "triangles": state["triangles"],
                "clipped": clipped, "stage": stage, "errors": errors[:6]})
            print(json.dumps(results[-1]))
            ctx.close()
        browser.close()
    fails = [r for r in results if not r["ok"]]
    print(f"\n=== {len(results)-len(fails)} ok, {len(fails)} failed ===")
    return 0 if not fails else 1

sys.exit(main())

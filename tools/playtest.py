"""Scripted headless playtest: DEPLOY -> B -> 1/2/3 -> ESC pause/resume -> plant.

Asserts zero console errors and correct UI state at each step.
"""
import json, sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8127/"

def state(pg):
    return pg.evaluate("""() => ({
      running: window.relay.debug().running,
      paused: window.relay.debug().paused,
      buyOpen: !!window.relay.debug().buyOpen,
      phase: window.relay.debug().phase,
      weapon: window.relay.match.player.weapon,
      awaitingLock: !!window.__awaitingLock,
      resumeHintHidden: document.getElementById('resume-hint').hidden,
      buyHidden: document.getElementById('buy-menu').hidden,
      pauseHidden: document.getElementById('pause-screen').hidden,
      ammo: window.relay.match.player.ammo[window.relay.match.player.weapon]
    })""")

def main():
    errors = []
    steps = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
                                    "--enable-unsafe-swiftshader","--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width":1280,"height":720})
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.goto(URL, wait_until="load", timeout=60000)

        # 0. title screen: HUD must not show demo scores
        pre = pg.evaluate("""() => ({
          warden: document.getElementById('score-warden').textContent,
          cinder: document.getElementById('score-cinder').textContent,
          aliveW: document.getElementById('alive-warden').textContent,
          aliveC: document.getElementById('alive-cinder').textContent,
          phase: document.getElementById('phase-label').textContent
        })""")
        steps.append({"step": "pre-deploy HUD", "state": pre,
                      "ok": pre["warden"] == "0" and pre["cinder"] == "0"
                            and pre["aliveW"] == "0" and pre["aliveC"] == "0"})

        # 1. DEPLOY
        pg.click("#start-btn")
        pg.wait_for_timeout(400)
        s = state(pg)
        steps.append({"step": "deploy", "state": s, "ok": s["running"] and s["phase"] == "buy"})

        def ensure_buy_open():
            """Press B until the buy menu is open (start() auto-opens it, so the first B may close)."""
            pg.evaluate("() => { window.relay.match.phase = 'buy'; window.relay.match.phaseT = 0; }")
            for _ in range(3):
                s = state(pg)
                if s["buyOpen"]:
                    return s
                pg.keyboard.press("KeyB"); pg.wait_for_timeout(300)
            return state(pg)

        def ensure_buy_closed():
            for _ in range(3):
                s = state(pg)
                if not s["buyOpen"]:
                    return s
                pg.keyboard.press("KeyB"); pg.wait_for_timeout(300)
            return state(pg)

        # 2. buy menu open must NOT pause
        pg.evaluate("() => { window.relay.match.phase = 'buy'; window.relay.match.phaseT = 0; }")
        opened = ensure_buy_open()
        pg.wait_for_timeout(250)
        s = state(pg)
        steps.append({"step": "buy open does not pause", "state": s,
                      "ok": opened["buyOpen"] and s["buyOpen"] and s["buyHidden"] is False and not s["paused"]})

        # 3. click a buy card while menu is open
        clicked = pg.evaluate("""() => {
          const btn = document.querySelector('.buy-item[data-item="rifle"]');
          if (!btn) return {ok:false, why:'no button'};
          const r = btn.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
          const reachable = el === btn || btn.contains(el);
          btn.click();
          return {ok: reachable, hint: document.getElementById('buy-hint').textContent};
        }""")
        steps.append({"step": "buy card clickable", "state": clicked, "ok": clicked["ok"]})

        # 4. B closes the buy menu
        closed = ensure_buy_closed()
        pg.wait_for_timeout(250)
        s = state(pg)
        steps.append({"step": "B closes buy", "state": s, "ok": s["buyHidden"] is True and not s["paused"]})

        # 5. ESC with the buy menu closed opens pause
        pg.evaluate("() => { window.relay.match.phase = 'live'; }")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        s = state(pg)
        steps.append({"step": "ESC pauses (menu closed)", "state": s, "ok": s["paused"] and s["pauseHidden"] is False})

        # 6. RESUME
        pg.click("#resume-btn")
        pg.wait_for_timeout(900)
        s = state(pg)
        steps.append({"step": "resume unpauses", "state": s, "ok": not s["paused"]})

        # 7. weapon slots 1 / 2 / 3 (grant a primary first so slot 1 and 3 can resolve)
        pg.evaluate("""() => {
          const p = window.relay.match.player;
          p.ammo.rifle = 30; p.reserve.rifle = 90;
          p.ammo.sidearm = 20; p.reserve.sidearm = 60;
          p.weapon = 'sidearm'; p.alive = true;
        }""")
        slot_results = []
        for key, label in (("Digit1", "slot1"), ("Digit2", "slot2"), ("Digit3", "slot3")):
            pg.keyboard.press(key)
            pg.wait_for_timeout(260)
            st = state(pg)
            slot_results.append({"key": label, "weapon": st["weapon"]})
        # slot1 must land on the rifle, slot2 on the sidearm
        by = {r["key"]: r["weapon"] for r in slot_results}
        steps.append({"step": "weapon slots 1/2/3", "state": slot_results,
                      "ok": by["slot1"] == "rifle" and by["slot2"] == "sidearm" and by["slot3"] != "sidearm"})

        # 8. ESC while buy menu open closes the menu, does not pause
        pg.evaluate("() => { window.relay.match.phase = 'buy'; }")
        pg.keyboard.press("KeyB")
        pg.wait_for_timeout(300)
        before = state(pg)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(300)
        after = state(pg)
        steps.append({"step": "ESC closes buy instead of pausing", "state": {"before": before, "after": after},
                      "ok": before["buyOpen"] and after["buyOpen"] is False and not after["paused"]})

        # 9. plant: hold E on the beacon site (step the sim directly; headless rAF is throttled)
        plant = pg.evaluate("""() => {
          const m = window.relay.match;
          m.phase = 'live'; m.phaseT = 0;
          const b = m.beacon;
          b.planted = false; b.detonated = false; b.defused = false;
          b.timer = 0; b.plantT = 0; b.planting = false;
          const S = { A: [22,0,-30], B: [-24,0,26] };
          const c = S[m.plan.site] || S.A;
          const p = m.player;
          p.alive = true; p.health = 100;
          p.pos = { x: c[0], y: 0, z: c[2] };
          p.vel = { x: 0, y: 0, z: 0 };
          p.grounded = true; p.crouch = 0;
          p.plantProgress = 0; p.defuseProgress = 0;
          b.carrier = p.id;
          // hold E and step the fixed 128 Hz tick until the plant completes
          const TICK = 1 / 128;
          let steps = 0;
          while (!m.beacon.planted && steps < 600) {
            m.applyPlayerInput({ fire: false, fireHeld: false, forward: false, back: false,
              left: false, right: false, crouch: false, walk: false, jump: false, use: true,
              reload: false, mouseDX: 0, mouseDY: 0 }, TICK);
            m.step(TICK); steps++;
          }
          return { site: m.plan.site, carrier: b.carrier, steps,
                   planted: m.beacon.planted, plantedSite: m.beacon.site ?? null,
                   progress: +(p.plantProgress ?? 0).toFixed(2) };
        }""")
        steps.append({"step": "plant completes (E hold)", "state": plant,
                      "ok": plant["planted"] is True and plant["plantedSite"] is not None})

        b.close()

    fails = [s for s in steps if not s["ok"]]
    print(json.dumps({"steps": steps, "consoleErrors": errors[:10],
                      "ok": len(fails) == 0 and len(errors) == 0}, indent=1))
    print(f"\n=== {len(steps)-len(fails)}/{len(steps)} steps ok, {len(errors)} console errors ===")
    return 0 if (not fails and not errors) else 1

sys.exit(main())

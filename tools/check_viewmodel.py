"""Headless check: slots 1/2/3/4 swap the 3D viewmodel, reload keeps it upright, gloved arms present."""
import json, sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337"

PROBE = """() => {
  const vm = window.__vm || null;
  const out = { ok: true, errors: [] };
  const g = window.relay;
  if (!g) return { ok: false, errors: ['no window.relay'] };
  return out;
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                                 "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    page.goto(URL, wait_until="load", timeout=60000)
    page.wait_for_function("() => window.relay && window.relay.debugViewModel !== undefined", timeout=60000)

    # Panel: which weapon groups are visible, arms/hands present, muzzle position follows slot.
    def state():
        return page.evaluate("() => window.relay.debugViewModel()")

    results = {}
    results["boot"] = state()

    # Enter live round so weapon switching is allowed.
    page.evaluate("() => window.relay.forceLive()")
    page.wait_for_timeout(400)

    for slot in (1, 2, 3):
        page.keyboard.press(f"Digit{slot}")
        page.wait_for_timeout(260)
        results[f"slot{slot}"] = state()

    # Slot 4 = utility throw (smoke). Needs one in inventory; force it.
    page.evaluate("() => window.relay.giveUtil('smoke', 2)")
    page.keyboard.press("Digit4")
    page.wait_for_timeout(200)
    results["slot4"] = state()

    # Reload must keep the gun upright: roll/pitch within tolerance both mid and after.
    page.keyboard.press("Digit1")
    page.wait_for_timeout(300)
    page.keyboard.press("KeyR")
    rolls = []
    for _ in range(10):
        page.wait_for_timeout(90)
        rolls.append(page.evaluate("() => window.relay.debugViewModel().roll"))
    results["reloadRolls"] = rolls
    results["reloadMaxAbsRoll"] = max(abs(r) for r in rolls)
    page.wait_for_timeout(1400)
    results["afterReload"] = state()
    results["errors"] = errs[:8]

    print(json.dumps(results, indent=1))
    b.close()

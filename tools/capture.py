"""Final capture: 4 shots, 1280x720, staged framing injected from tools/stage.js."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path("/home/ubuntu/relay-fps-entry")
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
STAGE = (ROOT / "tools" / "stage.js").read_text()

TARGETS = [
    ("01-buy-phase", "buy", None),
    ("02-firefight", "combat", 7.0),
    ("03-site-push", "site", None),
    ("04-tactical-hud", "hud", 7.2),
]

def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"])
        for name, shot, stage_range in TARGETS:
            ctx = browser.new_context(viewport={"width":1280,"height":720}, device_scale_factor=1)
            page = ctx.new_page()
            errors = []
            page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.add_init_script(STAGE)
            page.goto(f"http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337&shot={shot}", wait_until="load", timeout=60000)
            page.evaluate("window.relay.captureDemo()")
            try:
                page.wait_for_function("() => window.__relayFrozen === true", timeout=120000)
            except Exception:
                results.append({"shot": shot, "ok": False, "reason": "timeout", "errors": errors[:8]})
                print(json.dumps(results[-1])); ctx.close(); continue
            stage = None
            if stage_range is not None:
                stage = page.evaluate("(r) => window.__relayStage({range: r})", stage_range)
                page.evaluate("() => { window.relay.renderer.render(window.relay.scene, window.relay.camera); }")
            state = page.evaluate("() => window.__relayState")
            canvas = page.evaluate("() => { const c=document.getElementById('view'); return {w:c.width,h:c.height}; }")
            out = SHOTS / f"{name}.jpg"
            page.screenshot(path=str(out), type="jpeg", quality=88, animations="disabled", caret="hide")
            size = out.stat().st_size
            nonblank = sum(state["pixel"][:3])
            ok = (state["frozen"] is True and state["simTime"] >= 4.0 and state["frames"] > 30
                  and state["calls"] > 40 and nonblank > 12 and size <= 262144
                  and canvas["w"] == 1280 and canvas["h"] == 720 and len(errors) == 0)
            results.append({"shot": shot, "ok": ok, "file": str(out), "bytes": size,
                "simTime": state["simTime"], "frames": state["frames"], "calls": state["calls"],
                "triangles": state["triangles"], "pixel": state["pixel"],
                "hp": state["health"], "kills": state["kills"], "canvas": canvas,
                "stage": stage, "errors": errors[:8]})
            print(json.dumps(results[-1]))
            ctx.close()
        browser.close()
    fails = [r for r in results if not r["ok"]]
    print(f"\n=== {len(results)-len(fails)} ok, {len(fails)} failed ===")
    return 0 if not fails else 1

sys.exit(main())

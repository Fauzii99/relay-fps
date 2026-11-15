"""Re-capture only the site-plant shot."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

src = Path("/home/ubuntu/relay-fps-entry/tools/capture.py").read_text()
start = src.index('PLANT = """') + len('PLANT = """')
PLANT = src[start:src.index('"""', start)]

SHOTS = Path("/home/ubuntu/relay-fps-entry/screenshots")
URL = "http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337&shot=site"

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                                 "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    page.goto(URL, wait_until="load", timeout=60000)
    page.evaluate("window.relay.captureDemo()")
    page.wait_for_function("() => window.__relayFrozen === true", timeout=180000)
    stage = page.evaluate(PLANT, {"site": "A", "padRadius": 2.6, "pct": 0.73})
    page.evaluate("() => window.relay.timeFrame()")
    hud = page.evaluate("""() => {
        const t = (id) => { const e = document.getElementById(id); return e ? (e.textContent||'').trim() : null; };
        return {objective: t('objective-state'), phase: t('phase-label'), clock: t('clock'), loc: t('loc')};
    }""")
    out = SHOTS / "02-site-plant.jpg"
    page.screenshot(path=str(out), type="jpeg", quality=88, animations="disabled", caret="hide")
    print(json.dumps({"stage": stage, "hud": hud, "bytes": out.stat().st_size, "errors": errs[:5]}))
    b.close()

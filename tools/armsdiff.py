from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                                  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
    p = br.new_context(viewport={"width": 1280, "height": 720}).new_page()
    errs = []
    p.on("pageerror", lambda e: errs.append(str(e)))
    p.goto("http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337", wait_until="load", timeout=60000)
    p.wait_for_function("() => window.relay && window.relay.armsToggle", timeout=60000)
    p.wait_for_timeout(1600)
    p.evaluate("() => { window.relay.forceLive(); window.relay.freeze(true); }")
    p.wait_for_timeout(200)
    p.evaluate("() => { window.relay.armsToggle(false); window.relay.timeFrame(); }")
    p.screenshot(path="/tmp/c-off.jpg", type="jpeg", quality=95, timeout=120000)
    p.evaluate("() => { window.relay.armsToggle(true); window.relay.timeFrame(); }")
    p.screenshot(path="/tmp/c-on.jpg", type="jpeg", quality=95, timeout=120000)
    print("saved errs=%s" % errs[:2])
    br.close()

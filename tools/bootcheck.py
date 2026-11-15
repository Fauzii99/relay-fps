"""Boot check: window.relay defined, HUD present, zero console errors."""
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8127/index.html?demo=1&autostart=1"

async def main():
    out = {"errors": [], "console": [], "relay": None, "hud": {}}
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        p = await b.new_page(viewport={"width": 1280, "height": 720})
        p.on("console", lambda m: (out["console"].append(f"{m.type}: {m.text}"),
                                   out["errors"].append(m.text) if m.type == "error" else None))
        p.on("pageerror", lambda e: out["errors"].append(f"pageerror: {e}"))
        await p.goto(URL, wait_until="load")
        await p.wait_for_timeout(4000)
        out["relay"] = await p.evaluate("() => typeof window.relay")
        out["keys"] = await p.evaluate("() => window.relay ? Object.keys(window.relay).slice(0,40) : []")
        out["hud"] = await p.evaluate("""() => {
            const g = (id) => { const e = document.getElementById(id);
                if (!e) return "MISSING";
                const cs = getComputedStyle(e);
                return {text: (e.textContent||"").trim().slice(0,60), clip: cs.clip, opacity: cs.opacity, vis: cs.visibility}; };
            return {vitals: g("vitals"), radio: g("radio-wrap"), weapon: g("weapon-panel"),
                    roundbar: g("round-bar"), scoreboard: g("scoreboard")};
        }""")
        await p.screenshot(path="/tmp/boot.png")
        await b.close()
    print(json.dumps(out, indent=2)[:3000])
    return 0 if out["relay"] == "object" and not out["errors"] else 1

sys.exit(asyncio.run(main()))

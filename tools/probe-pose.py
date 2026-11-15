import asyncio,sys
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]); page=await b.new_page(viewport={"width":1280,"height":720}); await page.goto("http://127.0.0.1:8127/?demo=1&autostart=1&seed=1337&shot="+sys.argv[1],wait_until="load",timeout=60000); await page.evaluate("window.relay.captureDemo()"); await page.wait_for_function("()=>window.__relayFrozen===true",timeout=120000); print(await page.evaluate("""()=>{let c=window.relay.camera,p=window.relay.match.player,look=new (window.relay.camera.position.constructor)(); c.getWorldDirection(look); return {pos:{x:p.pos.x,y:p.pos.y,z:p.pos.z,yaw:p.yaw,pitch:p.pitch},camera:{x:c.position.x,y:c.position.y,z:c.position.z,rx:c.rotation.x,ry:c.rotation.y,rz:c.rotation.z,look:{x:look.x,y:look.y,z:look.z}},state:window.__relayState}}""")); await page.screenshot(path=sys.argv[2],type="jpeg",quality=85); await b.close()
asyncio.run(main())

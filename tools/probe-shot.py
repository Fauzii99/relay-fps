import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page(viewport={'width':1280,'height':720});errs=[];page.on('pageerror',lambda e:errs.append(str(e)));await page.goto('http://127.0.0.1:8127/?autostart=1&demo=1&shot='+sys.argv[1],wait_until='domcontentloaded',timeout=20000);await page.wait_for_function('window.RELAY_DEBUG !== undefined',{timeout:30000});await page.wait_for_timeout(1500);print('state',await page.evaluate('window.RELAY_DEBUG.debug()'));print('player',await page.evaluate('window.RELAY_DEBUG.player()'));print('errs',errs);await page.screenshot(path=sys.argv[2]);await b.close()
asyncio.run(main())

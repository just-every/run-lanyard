import assert from 'node:assert/strict'

/** Exercise the shared tooltips on the clause's visible screen. */
export async function iconTooltips(page){
 const scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}))
 const controls=page.locator('button,a,summary,[role=button]')
 for(let i=0;i<await controls.count();i++){
  const control=controls.nth(i)
  if(!await control.isVisible())continue
  const empty=!(await control.innerText()).trim(),tip=await control.getAttribute('data-tooltip')
  if(empty)assert.ok(tip,'visible icon control requires a tooltip: '+await control.evaluate(e=>e.outerHTML))
 }
 const account=page.locator('.me > summary')
 if(!await account.count())return
 const label=await account.getAttribute('data-tooltip');assert.ok(label)
 await account.focus();assert.equal(await page.locator('#control-tooltip').isVisible(),true);assert.equal(await page.locator('#control-tooltip').innerText(),label)
 await account.blur();await page.mouse.move(0,0);await account.hover();await page.waitForTimeout(350)
 assert.equal(await page.locator('#control-tooltip').isVisible(),true);assert.equal(await page.locator('#control-tooltip').innerText(),label)
 await page.mouse.move(0,0)
 await page.evaluate(({x,y})=>scrollTo(x,y),scroll)
}

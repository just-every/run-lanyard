import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
const events=text=>[...text.replace(/\r\n /g,'').matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g)].map(match=>Object.fromEntries(match[1].trim().split('\r\n').map(line=>{const i=line.indexOf(':');return[line.slice(0,i),line.slice(i+1)]})))

/** The ordinary week editor must update an existing subscription event after publication. */
export async function calendarPublication(h,browser,alex){
 const status=(await h.send('/api/lanyard/calendar',undefined,alex.cookie)).value
 const issued=await h.cmd('calendar.issue',{revision:status.revision,consent:'yes'},alex.cookie),feed=new URL(issued.url).pathname
 const initial=events((await h.send(feed)).text),overnight=initial.find(x=>x.DTSTART==='20261101T063000Z'),steady=initial.find(x=>x.DTSTART==='20261029T160000Z')
 let sequence=0,previous=overnight
 for(const [width,start,end,utcStart,utcEnd] of [[1440,'2026-11-01T00:30','2026-11-01T04:30','20261101T073000Z','20261101T123000Z'],[390,'2026-11-01T02:30','2026-11-01T07:30','20261101T103000Z','20261101T153000Z']]){
  const context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-01T12:00:00Z'))}})
  try{
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(/\.(css|js|svg|woff2)$/.test(path))return route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'});await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const capture=async label=>{if(process.env.CALENDAR_SCREENS){await mkdir(process.env.CALENDAR_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.CALENDAR_SCREENS,`${label}-${width}.png`),fullPage:true})}}
   await page.goto(h.origin+'/app/schedule?week=2026-10-26&view=draft',{waitUntil:'networkidle'})
   const form=page.locator('[data-roster-form]'),sourceId=await form.locator('.shift-input').filter({has:page.locator(`[data-shift="staffId"] option[value="${alex.id}"]:checked`)}).last().getAttribute('data-source-shift'),row=form.locator(`[data-source-shift="${sourceId}"]`)
   const submit=async label=>{await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:label,exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,await page.locator('.notice.error').allTextContents())}
   // Copies are new assignments; undo must restore the original source identity.
   await form.locator('summary').filter({hasText:'Bulk edit selected shifts'}).click();await row.locator('[data-select-shift]').check()
   await form.locator('[data-copy-shifts]').click()
   const copy=form.locator('.shift-input').last(),copyDate=width===1440?'2026-10-31':'2026-10-30';await copy.locator('[data-shift=start]').fill(copyDate+'T08:00');await copy.locator('[data-shift=end]').fill(copyDate+'T12:00');await copy.locator('[data-shift=end]').press('Tab')
   await row.locator('[data-shift=start]').fill(start);await row.locator('[data-shift=end]').fill(end);await row.locator('[data-shift=end]').press('Tab')
   await row.locator('[data-shift=label]').fill('synthetic-lanyard-14');await row.locator('[data-shift=label]').press('Tab');await form.locator('[data-undo-shift]').click()
   await capture('calendar-week-edit')
   await submit('Prepare draft')
   assert.deepEqual(events((await h.send(feed)).text).find(x=>x.UID===overnight.UID),previous,'private draft saves do not change the subscribed event')
   await capture('calendar-week-review')
   // Save the loaded draft again before publishing, exercising retained draft provenance.
   await submit('Prepare draft');await submit('Publish this revision')
   const list=events((await h.send(feed)).text),updated=list.filter(x=>x.UID===overnight.UID)
   assert.equal(updated.length,1);assert.deepEqual([updated[0].SEQUENCE,updated[0].DTSTART,updated[0].DTEND,updated[0].STATUS],[String(++sequence),utcStart,utcEnd,'CONFIRMED'])
   assert.deepEqual(list.find(x=>x.UID===steady.UID),steady,'untouched shifts retain their complete calendar event')
   const copied=list.filter(x=>x.DTSTART===(width===1440?'20261031T150000Z':'20261030T150000Z')&&x.STATUS==='CONFIRMED');assert.equal(copied.length,1);assert.ok(copied.every(x=>x.UID!==overnight.UID))
   previous=updated[0]
   await capture('calendar-week-published');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[])
  }finally{await context.close()}
 }
}

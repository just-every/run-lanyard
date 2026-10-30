import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=row=>({id:row.id,revision:row.revision})
const now='2026-10-01T12:00:00Z'
const place='synthetic-lanyard-1, East; \\ patio '+ 'é'.repeat(20)
const shift=(staffId,start,end)=>({staffId,start,end,site:place,breakMinutes:0})
const own=(staffId)=>shift(staffId,'2026-11-01T06:30:00Z','2026-11-01T11:30:00Z')
const steady=(staffId)=>shift(staffId,'2026-10-29T16:00:00Z','2026-10-29T20:00:00Z')
const other=(staffId)=>shift(staffId,'2026-10-30T16:00:00Z','2026-10-30T20:00:00Z')
function events(text){return [...text.replace(/\r\n /g,'').matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g)].map(match=>Object.fromEntries(match[1].trim().split('\r\n').map(line=>{const index=line.indexOf(':');return [line.slice(0,index),line.slice(index+1)]})))}
const path=url=>new URL(url).pathname
async function fixture(h){
 const alex=await h.person('CalendarAlex'),ben=await h.person('CalendarBen')
 for(const person of [alex,ben])await h.cmd('availability.save',{staffId:person.id,start:'2026-10-26T07:00:00Z',end:'2026-11-02T08:00:00Z'})
 const publish=async shifts=>{const draft=await h.cmd('roster.prepare',{week:'2026-10-26',shifts});return h.cmd('roster.publish',pin(draft))}
 await publish([own(alex.id),steady(alex.id),other(ben.id)])
 let row=(await h.state()).shifts.find(x=>x.start===own(alex.id).start&&x.status==='published')
 await h.cmd('shiftwork.save',{shiftId:row.id,shiftRevision:row.revision,notes:'synthetic-lanyard-2 private handover',tasks:['synthetic-lanyard-3 private task']})
 return {alex,ben,publish}
}
export async function calendarApi(){
 const h=await harness({now})
 try {
  const {alex,ben,publish}=await fixture(h),status=async person=>(await h.send('/api/lanyard/calendar',undefined,person.cookie)).value
  assert.equal((await h.send('/api/lanyard/calendar',undefined,'')).status,401)
  await h.cmd('calendar.issue',{revision:0,consent:'yes'},h.owner,403)
  const beforeAuthority=await h.db.prepare('SELECT count(*) AS n FROM l_calendar_feeds').first()
  await h.cmd('calendar.issue',{revision:0,consent:'yes',staffId:alex.id},ben.cookie,400)
  await h.cmd('calendar.issue',{revision:0},alex.cookie,400)
  assert.deepEqual(await h.db.prepare('SELECT count(*) AS n FROM l_calendar_feeds').first(),beforeAuthority)
  const first=await h.cmd('calendar.issue',{revision:0,consent:'yes'},alex.cookie),url=path(first.url)
  const read=async(urlToRead=url,cookie='',expected=200)=>{const response=await h.send(urlToRead,undefined,cookie);assert.equal(response.status,expected);return response}
  let response=await read(),initial=events(response.text)
  assert.equal(response.headers.get('content-type'),'text/calendar; charset=utf-8');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer')
  assert.equal(initial.length,2)
  const overnight=initial.find(e=>e.DTSTART==='20261101T063000Z'),unchanged=initial.find(e=>e.DTSTART==='20261029T160000Z')
  assert.equal(overnight.DTEND,'20261101T113000Z');assert.equal(overnight.SEQUENCE,'0');assert.equal(overnight.STATUS,'CONFIRMED')
  assert.equal(overnight.LOCATION,place.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,'))
  assert.ok(response.text.includes('X-WR-TIMEZONE:America/Los_Angeles'))
  assert.ok(response.text.split('\r\n').every(line=>Buffer.byteLength(line)<=75),'UTF-8 calendar lines are folded without splitting code points')
  for(const secret of [alex.name,ben.name,ben.id,'synthetic-lanyard-2','synthetic-lanyard-3','20261030T160000Z'])assert.ok(!response.text.includes(secret),'only personal assignment facts leave the calendar door')
  await read(url,ben.cookie,404)
  assert.equal((await h.send('/api/lanyard/calendar?staffId='+alex.id,undefined,ben.cookie)).status,400)
  const nativeState=JSON.stringify(await h.state()),commands=JSON.stringify((await h.db.prepare('SELECT result FROM l_commands').all()).results)
  const token=url.split('/').at(-1).replace('.ics',''),credential=await h.db.prepare('SELECT token_hash FROM l_calendar_feeds').first()
  for(const serialized of [nativeState,commands]){assert.ok(!serialized.includes(token));assert.ok(!serialized.includes(credential.token_hash))}
  assert.ok(!JSON.stringify(await status(alex)).includes(token))
  await h.cmd('calendar.rotate',{revision:1,consent:'yes',staffId:alex.id},ben.cookie,400)
  await h.cmd('calendar.revoke',{revision:1,staffId:alex.id},ben.cookie,400)
  assert.equal((await read()).text,response.text)
  // A draft, a confirmation and an unchanged publication must not modify event identity or sequence.
  await h.cmd('roster.prepare',{week:'2026-11-02',shifts:[shift(alex.id,'2026-11-03T16:00:00Z','2026-11-03T20:00:00Z')]})
  let row=(await h.state()).shifts.find(x=>x.status==='published'&&x.start===own(alex.id).start)
  await h.cmd('shift.confirm',pin(row),alex.cookie)
  await publish([own(alex.id),steady(alex.id),other(ben.id)])
  assert.equal((await read()).text,response.text)
  row=(await h.state()).shifts.find(x=>x.status==='published'&&x.start===own(alex.id).start)
  const moved=await h.cmd('shift.change',{...pin(row),start:'2026-11-01T07:30:00Z',end:'2026-11-01T12:30:00Z',reason:'synthetic-lanyard-4'})
  let list=events((await read()).text),event=list.find(e=>e.UID===overnight.UID)
  assert.deepEqual([event.SEQUENCE,event.DTSTART,event.DTEND,event.STATUS],['1','20261101T073000Z','20261101T123000Z','CONFIRMED'])
  assert.deepEqual(list.find(e=>e.UID===unchanged.UID),unchanged)
  const reassigned=await h.cmd('shift.change',{...pin(moved.shift),staffId:ben.id,reason:'synthetic-lanyard-5'})
  event=events((await read()).text).find(e=>e.UID===overnight.UID)
  assert.deepEqual([event.SEQUENCE,event.DTSTART,event.STATUS],['2','20261101T073000Z','CANCELLED'])
  const tombstone=event,benFeed=await h.cmd('calendar.issue',{revision:0,consent:'yes'},ben.cookie)
  const benEvent=events((await read(path(benFeed.url))).text).find(e=>e.DTSTART==='20261101T073000Z')
  assert.notEqual(benEvent.UID,overnight.UID);assert.equal(benEvent.STATUS,'CONFIRMED')
  const later=await h.cmd('shift.change',{...pin(reassigned.shift),start:'2026-11-01T08:30:00Z',end:'2026-11-01T13:30:00Z',reason:'synthetic-lanyard-6'})
  assert.deepEqual(events((await read()).text).find(e=>e.UID===overnight.UID),tombstone,'a replacement time never leaks into the previous assignee cancellation')
  await h.cmd('shift.cancel',{...pin(later.shift),reason:'synthetic-lanyard-7'})
  const cancelled=events((await read(path(benFeed.url))).text).find(e=>e.UID===benEvent.UID)
  assert.deepEqual([cancelled.SEQUENCE,cancelled.DTSTART,cancelled.STATUS],['2','20261101T083000Z','CANCELLED'])
  const replacement=await h.cmd('calendar.rotate',{revision:1,consent:'yes'},alex.cookie)
  await read(url,'',404)
  assert.deepEqual(events((await read(path(replacement.url))).text).find(e=>e.UID===overnight.UID),tombstone)
  await h.cmd('calendar.rotate',{revision:1,consent:'yes'},alex.cookie,409)
  await h.restart();assert.deepEqual(events((await read(path(replacement.url))).text).find(e=>e.UID===overnight.UID),tombstone)
  await h.cmd('calendar.revoke',{revision:2},alex.cookie);await read(path(replacement.url),'',404)
  const renewed=await h.cmd('calendar.issue',{revision:3,consent:'yes'},alex.cookie)
  const person=(await h.state()).staff.find(p=>p.id===alex.id)
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:false,site:person.site??''})
  await read(path(renewed.url),'',404)
  const inactive=(await h.state()).staff.find(p=>p.id===alex.id)
  await h.cmd('staff.save',{...pin(inactive),name:inactive.name,email:inactive.email,payrollId:inactive.payrollId,role:'staff',active:true,site:inactive.site??''})
  await read(path(renewed.url),'',404)
  // Spring DST uses the retained UTC instants, with no invented local duration.
  await h.cmd('availability.save',{staffId:ben.id,start:'2027-03-08T08:00:00Z',end:'2027-03-15T07:00:00Z'})
  const spring=await h.cmd('roster.prepare',{week:'2027-03-08',shifts:[shift(ben.id,'2027-03-14T07:30:00Z','2027-03-14T10:30:00Z')]});await h.cmd('roster.publish',pin(spring))
  const dst=events((await read(path(benFeed.url))).text).find(e=>e.DTSTART==='20270314T073000Z');assert.equal(dst.DTEND,'20270314T103000Z')
  assert.deepEqual([(await h.state()).clocks.length,(await h.state()).timesheets.length,(await h.state()).batches.length],[0,0,0])
 } finally {await h.close()}
}
export async function calendarBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 const h=await harness({now})
 try {
  const {alex}=await fixture(h)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  try {
   const [name,...value]=alex.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const capture=async label=>{if(process.env.CALENDAR_SCREENS){await mkdir(process.env.CALENDAR_SCREENS,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(process.env.CALENDAR_SCREENS,`${label}-${width}.png`),fullPage:true,mask:[page.getByRole('textbox',{name:'Private subscription link'})]})}await page.setViewportSize({width:1440,height:1000})}}
   await page.goto(h.origin+'/app/schedule?week=2026-10-26',{waitUntil:'networkidle'})
   await page.getByRole('link',{name:'Manage my calendar subscription'}).click()
   const card=page.locator('#my-calendar');await card.getByRole('button',{name:'Create private link'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Overtime, meals and rest'}).count(),0)
   await capture('calendar-inactive')
   await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Create private link'}).click()
   const field=page.getByRole('textbox',{name:'Private subscription link'});await field.waitFor();const first=await field.inputValue()
   assert.equal((await h.send(path(first))).status,200)
   await capture('calendar-issued')
   await page.reload({waitUntil:'networkidle'});assert.equal(await field.count(),0,'ordinary Settings reads do not redisclose credentials')
   await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Replace private link'}).click()
   await field.waitFor();const second=await field.inputValue();assert.notEqual(second,first);assert.equal((await h.send(path(first))).status,404)
   await capture('calendar-replaced')
   // A stale form refuses visibly and preserves the current credential.
   await h.cmd('calendar.rotate',{revision:2,consent:'yes'},alex.cookie)
   await card.getByRole('button',{name:'Revoke calendar access'}).click()
   await page.getByRole('alert').getByText('Calendar changed; reload before retrying').waitFor()
   await card.getByRole('button',{name:'Revoke calendar access'}).click()
   await card.getByRole('button',{name:'Create private link'}).waitFor();assert.equal((await h.send(path(second))).status,404)
   const account=page.getByLabel('Account',{exact:true});await account.focus();await page.getByRole('tooltip',{name:'Account menu'}).waitFor()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await capture('calendar-revoked');assert.deepEqual(errors,[])
  }finally{await context.close()}
 }finally{await h.close();await browser.close()}
}

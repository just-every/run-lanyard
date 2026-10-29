import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {days,monday,local,pin} from './workforce-journey.mjs'

async function scenario(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),outsider=await h.person('Dee'),manager=await h.person('Priya','manager')
 const week=days(monday(new Date().toISOString().slice(0,10)),28)
 for(const p of [alex,ben,cy])await h.cmd('availability.save',{staffId:p.id,start:local(week,'00:00'),end:local(days(week,7),'00:00')})
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:alex.id,start:local(days(week,1),'09:00'),end:local(days(week,1),'17:00'),breakMinutes:30}]},manager.cookie)
 await h.cmd('roster.publish',pin(draft),manager.cookie)
 let shift=(await h.state(manager.cookie)).shifts.find(x=>x.status==='published')
 await h.cmd('shift.confirm',pin(shift),alex.cookie)
 const swaps=[]
 for(const [from,to,reason] of [[alex,ben,'Alex training'],[ben,cy,'Ben appointment']]) {
  shift=(await h.state(manager.cookie)).shifts.find(x=>x.status==='published')
  const proposed=await h.cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:to.id},from.cookie)
  const accepted=await h.cmd('swap.respond',{...pin(proposed),decision:'accepted'},to.cookie)
  swaps.push(await h.cmd('swap.decide',{...pin(accepted),decision:'approved',note:reason},manager.cookie))
 }
 shift=(await h.state(manager.cookie)).shifts.find(x=>x.status==='published')
 const read=async(cookie,id=shift.id)=>{const r=await h.send(`/api/lanyard/shifts/${id}/history`,undefined,cookie);assert.equal(r.status,200,r.text);return r.value.events}
 for(const p of [alex,ben,cy,manager]) {
  const list=await read(p.cookie)
  assert.equal(list.find(e=>e.action==='created').staffId,alex.id)
  assert.deepEqual(list.filter(e=>e.action==='swapped').map(e=>[e.from.staffId,e.staffId,e.by,e.reason]),[[alex.id,ben.id,'Priya','Alex training'],[ben.id,cy.id,'Priya','Ben appointment']])
  assert.deepEqual(list.filter(e=>e.action==='acknowledged').map(e=>e.staffId),[alex.id,ben.id,cy.id])
  assert.deepEqual(list.filter(e=>e.action==='swapped').map(e=>e.at),swaps.map(s=>s.decidedAt))
 }
 assert.equal((await h.send(`/api/lanyard/shifts/${shift.id}/history`,undefined,outsider.cookie)).status,404)
 const moved=await h.cmd('shift.change',{...pin(shift),start:local(days(week,1),'10:00'),end:local(days(week,1),'18:00'),reason:'Later delivery'},manager.cookie)
 for(const p of [alex,ben,cy])assert.equal((await read(p.cookie,moved.shift.id)).filter(e=>e.action==='swapped').length,2)
 const log=await h.send(`/api/lanyard/weeks/${week}/changes.csv`,undefined,manager.cookie)
 assert.equal(log.status,200);assert.match(log.text,/,swapped,Ben,Alex,.*Priya,Alex training,In Lanyard/);assert.match(log.text,/,swapped,Cy,Ben,.*Priya,Ben appointment,In Lanyard/)
 assert.equal((log.text.match(/,acknowledged,/g)??[]).length,3)
 return {alex,ben,cy,manager,week}
}
export const repeatedHistoryApi=scenario
export async function repeatedHistoryBrowser() {
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic','--no-sandbox']})
 try{for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const {alex,manager,week}=await scenario(h)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   for(const [role,p] of [['manager',manager],['original-assignee',alex]]) {
    const [name,...value]=p.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}]);await page.goto(h.origin+'/app/schedule?week='+week,{waitUntil:'networkidle'})
    const card=page.locator('#changes');await card.scrollIntoViewIfNeeded()
    await card.getByText('Alex training',{exact:false}).waitFor();await card.getByText('Ben appointment',{exact:false}).waitFor()
    assert.equal(await card.locator('li').filter({hasText:/^Acknowledged/}).count(),3)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(process.env.HISTORY_SCREENS){await mkdir(process.env.HISTORY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.HISTORY_SCREENS,`${role}-${width}.png`),fullPage:true})}
   }
   assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

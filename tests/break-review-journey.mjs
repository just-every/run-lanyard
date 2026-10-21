import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

async function scenario(h) {
 const alex=await h.person('Alex'),manager=await h.person('Priya','manager')
 const policy={site:'',mealAfterMinutes:300,mealMinutes:30,waiveUpTo:360,restEveryMinutes:240,restMinutes:10,premium:true}
 await h.cmd('breakrule.save',policy)
 const at=(day,time)=>`2026-10-${String(day).padStart(2,'0')}T${time}:00Z`
 async function day(d,end,breaks=[],extra={}) {
  await h.cmd('clock.in',{commandId:`in-${d}`,capturedAt:at(d,'08:00')},alex.cookie)
  for(const [kind,start,stop] of breaks){await h.cmd('clock.breakStart',{commandId:`start-${d}-${start}`,kind,capturedAt:at(d,start)},alex.cookie);await h.cmd('clock.breakEnd',{commandId:`stop-${d}-${stop}`,capturedAt:at(d,stop)},alex.cookie)}
  return (await h.cmd('clock.out',{commandId:`out-${d}`,capturedAt:at(d,end),breakMinutes:0,...extra},alex.cookie)).timesheet
 }
 const complete=await day(5,'16:00',[['rest','10:00','10:10'],['meal','12:00','12:30'],['rest','14:00','14:10']])
 const missed=await day(6,'16:00'),waived=await day(7,'13:30',[],{waiveMeal:true}),boundary=await day(8,'13:00'),short=await day(9,'16:00',[['rest','10:00','10:05'],['meal','12:00','12:30'],['rest','14:00','14:05']])
 const manual=await h.cmd('time.prepare',{staffId:alex.id,start:at(10,'08:00'),end:at(10,'16:00'),breakMinutes:30,reason:'Missed phone punch'},manager.cookie)
 let rows=Object.fromEntries((await h.state(manager.cookie)).timesheets.map(t=>[t.id,t.review]))
 const expected=(taken,required,count,requiredCount)=>({taken,required,count,requiredCount})
 assert.deepEqual(rows[complete.id].breaks,{taken:30,required:30,policyMealMinutes:30,automaticMealMinutes:0,waived:false,rest:expected(20,20,2,2)})
 assert.equal(complete.minutes,450,'paid rests never reduce payable minutes')
 assert.deepEqual(rows[missed.id].breaks.rest,expected(0,20,0,2));assert.equal(rows[missed.id].breaks.required,30)
 assert.deepEqual(rows[waived.id].breaks,{taken:0,required:0,policyMealMinutes:0,automaticMealMinutes:0,waived:true,rest:expected(0,10,0,1)})
 assert.equal(rows[boundary.id].breaks.required,0,'a meal is due only above the configured threshold')
 assert.deepEqual(rows[short.id].breaks.rest,expected(10,20,0,2),'short rests do not become full breaks')
 assert.deepEqual(rows[manual.id].breaks.rest,expected(null,20,null,2),'untimed manual rest data stays unknown')
 const page=(await h.send('/app/time?state=exception',undefined,manager.cookie)).text
 assert.ok(page.includes(missed.id)&&page.includes(short.id)&&!page.includes(complete.id))
 // Automatic deduction and policy are concurrent requirements, not two meals to sum.
 await h.cmd('mealrule.save',{site:'',afterMinutes:360,deductMinutes:45,enabled:true})
 rows=Object.fromEntries((await h.state(manager.cookie)).timesheets.map(t=>[t.id,t.review]))
 assert.deepEqual([rows[complete.id].breaks.required,rows[complete.id].breaks.policyMealMinutes,rows[complete.id].breaks.automaticMealMinutes],[45,30,45])
 // Preserve captured break facts beside an approver edit and do not manufacture rest evidence.
 const edited=await h.cmd('time.edit',{...pin(manual),start:at(10,'08:00'),end:at(10,'15:30'),breakMinutes:30,reason:'Checked closing record'},manager.cookie)
 assert.equal(edited.captured.minutes,450)
 assert.equal((await h.state(manager.cookie)).timesheets.find(t=>t.id===edited.id).review.breaks.rest.taken,null)
 return {manager,complete,missed,waived,manual,short}
}
export const breakReviewApi=scenario
export async function breakReviewBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const {manager,complete,missed,waived,manual,short}=await scenario(h)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=manager.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'})
   const row=t=>page.locator('tr').filter({has:page.locator(`input[name=id][value="${t.id}"]`)})
   await row(complete).locator('.review').filter({hasText:'paid rest 20 min of 20 min; 2 of 2 full breaks'}).waitFor()
   await row(missed).locator('.review').filter({hasText:'paid rest 0 min of 20 min; 0 of 2 full breaks'}).waitFor()
   await row(waived).locator('.review').filter({hasText:'policy meal waived'}).waitFor()
   await row(manual).locator('.review').filter({hasText:'paid rest not recorded of 20 min; unknown of 2 full breaks'}).waitFor()
   await row(short).locator('.review').filter({hasText:'paid rest 10 min of 20 min; 0 of 2 full breaks'}).waitFor()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.REVIEW_SCREENS){await mkdir(process.env.REVIEW_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.REVIEW_SCREENS,`break-review-${width}.png`),fullPage:true})}
   await page.goto(h.origin+'/app/time?state=exception',{waitUntil:'networkidle'})
   assert.equal(await row(complete).count(),0);assert.equal(await row(missed).count(),1)
   if(process.env.REVIEW_SCREENS)await page.screenshot({path:join(process.env.REVIEW_SCREENS,`exceptions-${width}.png`),fullPage:true})
   assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

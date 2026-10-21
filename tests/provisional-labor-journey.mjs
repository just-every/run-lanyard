import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {handoverFixture} from './shiftwork-fixture.mjs'

// TIME-007: the unresolved punch stays reviewable while labor stops at its provisional end,
// including CLOCK-008's job segments. Confirmation replaces that estimate exactly once.
export async function provisionalLaborBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await handoverFixture(h,false)
   await h.cmd('closerule.save',{site:'Ocean Beach',graceMinutes:15,capHours:12})
   await h.cmd('clock.in',{commandId:'provisional-segment-in',capturedAt:f.start},f.alex.cookie)
   await h.cmd('clock.transfer',{commandId:'provisional-segment-transfer',capturedAt:new Date(Date.parse(f.start)+180*60000).toISOString(),job:f.kitchen.id},f.alex.cookie)
   const report=()=>h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${f.week}&size=60`,undefined,f.manager.cookie)
   const check=async()=>{const r=await report();assert.equal(r.status,200);assert.equal(r.value.intervals.reduce((n,x)=>n+x.actual.minutes,0),480);assert.equal(r.value.intervals.reduce((n,x)=>n+x.actual.cents,0),18000);assert.ok(r.value.intervals.filter(x=>x.time>='17:00').every(x=>x.actual.minutes===0))}
   await check()
   const risk=await h.send(`/api/lanyard/overtime?week=${f.week}`,undefined,f.manager.cookie);assert.equal(risk.status,200);assert.deepEqual(risk.value.alerts,[])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.PROVISIONAL_SCREENS){await mkdir(process.env.PROVISIONAL_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.PROVISIONAL_SCREENS,`${key}-${width}.png`),fullPage:true})}}
   const intervals=h.origin+`/app/intervals?site=Ocean%20Beach&date=${f.week}&size=60`
   await as(f.manager.cookie);await page.goto(intervals,{waitUntil:'networkidle'})
   assert.equal(await page.locator('#intervals tbody tr').count(),8,'no rows accrue after 5 pm');await shot('provisional-labor')
   await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week='+f.week,{waitUntil:'networkidle'})
   const reminder=page.locator('#clock-reminder');assert.ok((await reminder.innerText()).includes('stopped counting'));await reminder.scrollIntoViewIfNeeded();await shot('provisional-reminder')
   const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('name=time.confirm')),reminder.getByRole('button',{name:'Confirm end time',exact:true}).click()]);assert.equal(response.status(),200);await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('#clock-reminder').count(),0)
   const state=await h.state(f.alex.cookie);assert.equal(state.timesheets.length,1);assert.equal(state.timesheets[0].minutes,480);assert.equal(state.timesheets[0].status,'submitted')
   await check();await as(f.manager.cookie);await page.goto(intervals,{waitUntil:'networkidle'});assert.equal(await page.locator('#intervals tbody tr').count(),8);await shot('confirmed-labor');assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

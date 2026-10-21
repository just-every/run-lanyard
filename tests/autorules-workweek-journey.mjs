import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})

async function fixture(h) {
 const alex=await h.person('Alex'),priya=await h.person('Priya','manager')
 for(const p of [alex,priya])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'Ocean Beach',hourlyRate:'20.00'})
 const group=await h.cmd('paygroup.save',{name:'Sunday team',cadence:'weekly',from:'2026-10-11',payDays:5,workweekStart:0,staffIds:[alex.id]})
 await h.cmd('availability.save',{staffId:alex.id,start:'2026-10-11T07:00:00Z',end:'2026-10-19T07:00:00Z'})
 const at=(day,hours)=>({start:`2026-10-${day}T16:00:00Z`,end:new Date(Date.parse(`2026-10-${day}T16:00:00Z`)+hours*3600000).toISOString(),breakMinutes:0})
 for(const [week,days] of [['2026-10-05',[{day:'11',hours:1}]],['2026-10-12',[{day:'18',hours:1}]]]){
  const draft=await h.cmd('roster.prepare',{week,shifts:days.map(({day,hours})=>({staffId:alex.id,...at(day,hours)}))})
  await h.cmd('roster.publish',pin(draft),priya.cookie)
 }
 for(const day of ['12','13','14','15'])await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:alex.id,...at(day,8),reason:'Reviewed register hours'})),priya.cookie)
 const rule=await h.cmd('autorule.save',{site:'Ocean Beach'})
 const punch=async(day,hours)=>{const times=at(day,hours);await h.cmd('clock.in',{commandId:`in-${day}`,capturedAt:times.start},alex.cookie);return(await h.cmd('clock.out',{commandId:`out-${day}`,capturedAt:times.end,breakMinutes:0,breakNote:'No meal required for this shift'},alex.cookie)).timesheet}
 await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:alex.id,...at('16',7),reason:'Reviewed register hours'})),priya.cookie)
 const at40=await punch('11',1)
 const exact=await h.send(`/api/lanyard/autorules/${rule.id}/preview`,undefined,h.owner)
 assert.equal(exact.status,200,exact.text);assert.equal(exact.value.items.find(t=>t.timesheetId===at40.id).decision,'approve','Exactly 40 hours remains eligible')
 await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:alex.id,...at('17',1),reason:'Reviewed Saturday hour'})),priya.cookie)
 const at41=at40
 return {alex,priya,rule,at41,punch,group}
}
async function preview(h,f) {const r=await h.send(`/api/lanyard/autorules/${f.rule.id}/preview`,undefined,h.owner);assert.equal(r.status,200,r.text);return r.value}
function assertHold(v,f) {
 assert.deepEqual(v.items.find(t=>t.timesheetId===f.at41.id).reasons,['overtime'],'The Sunday punch crosses 40 in its own Sunday workweek')
}
async function assertDecisions(h,f) {
 const state=await h.state(),last=state.timesheets.find(t=>t.id===f.at41.id)
 assert.equal(last.status,'submitted');assert.equal(last.automation,undefined)
 const fresh=await f.punch('18',1),after=await h.state(),next=after.timesheets.find(t=>t.id===fresh.id)
 assert.equal(next.status,'approved','Sunday starts a fresh workweek, independently of the preceding 41-hour week')
 assert.equal(next.automation.ruleId,f.rule.id)
 let period=await h.cmd('paygroup.period',{groupId:f.group.id,date:'2026-10-18'})
 period=await h.cmd('period.signoff',pin(period),f.alex.cookie);period=await h.cmd('period.signoff',pin(period),f.priya.cookie);await h.cmd('period.lock',pin(period))
 const payroll=await h.cmd('payroll.prepare',{})
 assert.ok(payroll.lines.some(l=>l.timeId===fresh.id));assert.ok(!payroll.lines.some(l=>l.timeId===f.at41.id),'Out-of-policy time stays out of payroll')
}
export async function workweekApi(h) {
 const f=await fixture(h),v=await preview(h,f);assertHold(v,f)
 await h.cmd('autorule.authorize',{...pin(f.rule),digest:v.digest})
 await assertDecisions(h,f)
}
export async function workweekBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fixture(h);assertHold(await preview(h,f),f)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage();await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   const card=page.locator('#auto-approval');assert.match(await card.innerText(),/Alex: for a person · overtime/);assert.ok(!(await card.innerText()).includes('would approve'))
   await card.scrollIntoViewIfNeeded()
   if(process.env.AUTO_SCREENS){await mkdir(process.env.AUTO_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.AUTO_SCREENS,`workweek-preview-${width}.png`)})}
   await card.getByRole('button',{name:'Authorize v1 as previewed',exact:true}).click();await page.waitForLoadState('networkidle')
   await assertDecisions(h,f);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   assert.match(await card.innerText(),/Alex: for a person · overtime/);assert.ok(!(await card.innerText()).includes('would approve'))
   await card.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.AUTO_SCREENS)await page.screenshot({path:join(process.env.AUTO_SCREENS,`workweek-authorized-${width}.png`)})
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

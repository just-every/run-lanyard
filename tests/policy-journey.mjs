import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days,monday} from './workforce-journey.mjs'
const start='2026-10-12'
const spec=(id,on,hours,site='East')=>({staffId:id,site,start:on+'T08:00:00.000Z',end:new Date(Date.parse(on+'T08:00:00Z')+hours*3600000).toISOString(),breakMinutes:0})
async function person(h,name='Alex',rate='20.00'){
 const p=await h.person(name)
 await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,active:true,role:'staff',site:'East',position:'Service',hourlyRate:rate})
 return p
}
const save=(h,site,preset,extra={})=>h.cmd('policy.save',{site,preset,from:'2026-01-01',...extra})
export async function policyClassifications(){
 const cases=[['federal',[7,7,7,7,7,7],120,0],['CA',[10],120,0],['CA',[13],240,60],['CA',[1,1,1,1,1,1,10],480,120],['AK',[9],60,0],['NV',[9],60,0,'17.99'],['NV',[9],0,0,'18.00'],['CO',[13],60,0],...['OR','WA','NY','IL'].map(p=>[p,[7,7,7,7,7,7],120,0])]
 for(const [preset,hours,ot,dt,rate]of cases){const h=await harness();try{
  await h.cmd('settings.save',{timezone:'UTC'});const alex=await person(h,'Alex',rate),policies=[]
  for(const site of ['East','West'])policies.push(await save(h,site,preset))
  const shifts=hours.map((v,i)=>spec(alex.id,days(start,i),v,i%2?'West':'East'))
  await h.cmd('availability.save',{staffId:alex.id,start:start+'T00:00:00Z',end:days(start,7)+'T00:00:00Z'})
  const draft=await h.cmd('roster.prepare',{week:start,shifts})
  assert.equal(draft.policyWarnings.some(w=>w.message.includes('overtime minutes')),ot+dt>0,preset+' planning warning')
  for(const w of shifts){const t=await h.cmd('time.prepare',{...w,reason:'synthetic-lanyard-1 recorded work'});await h.cmd('time.approve',pin(t))}
  const report=await h.cmd('policy.review',{staffId:alex.id,week:start})
  assert.deepEqual([report.overtimeMinutes,report.doubleMinutes],[ot,dt],preset+' actual classification')
  assert.equal(report.regularMinutes+ot+dt,hours.reduce((a,b)=>a+b,0)*60)
  assert.ok(report.parts.every(p=>p.rules.every(r=>r.version===policies[0].presetVersion&&r.source.startsWith('https://')&&r.id&&r.revision===1)))
  assert.equal(report.estimateCents,Math.round((hours.reduce((a,b)=>a+b,0)*60+ot*.5+dt)*Math.round(Number(rate??'20.00')*100)/60))
  if(shifts.length>1)assert.deepEqual([...new Set(report.parts.map(p=>p.site))].sort(),['East','West'])
  await h.cmd('policy.review',{staffId:alex.id,week:start},alex.cookie,403)
 }finally{await h.close()}}
 // Two rates on the same date aggregate before the daily threshold is applied.
 const h=await harness();try{
  await h.cmd('settings.save',{timezone:'UTC'});const alex=await person(h),policy=await save(h,'East','CA');await save(h,'West','CA')
  let t=await h.cmd('time.prepare',{...spec(alex.id,start,5),reason:'synthetic-lanyard-2'});const first=await h.cmd('time.approve',pin(t))
  const p=(await h.state()).staff.find(p=>p.id===alex.id);await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,active:true,role:'staff',site:'East',hourlyRate:'30.00'})
  t=await h.cmd('time.prepare',{...spec(alex.id,start,5,'West'),start:start+'T13:00:00Z',end:start+'T18:00:00Z',reason:'synthetic-lanyard-3'});await h.cmd('time.approve',pin(t))
  let r=await h.cmd('policy.review',{staffId:alex.id,week:start});assert.equal(r.overtimeMinutes,120);assert.equal(r.weightedRateCents,2500);assert.equal(r.estimateCents,27500)
  assert.equal(r.parts.find(p=>p.timeId===first.id).cents,2000,'approved source rates survive later wage edits')
  const correction=await h.cmd('time.prepare',{...spec(alex.id,start,4),corrects:first.id,reason:'synthetic-lanyard-4 approved correction'})
  assert.equal((await h.cmd('policy.review',{staffId:alex.id,week:start})).minutes,600,'pending correction does not remove approved work')
  await h.cmd('time.approve',pin(correction));r=await h.cmd('policy.review',{staffId:alex.id,week:start});assert.equal(r.minutes,540);assert.equal(r.overtimeMinutes,60);assert.ok(!r.parts.some(p=>p.timeId===first.id))
  await h.cmd('policy.save',{site:'East',preset:'CA',from:'2026-01-01',...pin(policy)},h.owner,400)
  const changed=await h.cmd('policy.save',{site:'East',preset:'federal',from:'2026-10-19',...pin(policy),reviewReason:'Reviewed open-period recalculation; older work keeps its policy'})
  assert.equal(changed.versions.length,1);assert.equal((await h.cmd('policy.review',{staffId:alex.id,week:start})).overtimeMinutes,60)
 }finally{await h.close()}
}
export async function policyBoundaries(h){
 await h.cmd('settings.save',{timezone:'UTC'});const alex=await person(h),ben=await person(h,'Ben'),manager=await h.person('Morgan','manager')
 await h.cmd('policy.save',{site:'East',from:'2026-01-01',preset:'CA'},manager.cookie,403)
 let ca=await save(h,'East','CA')
 const meal={site:'East',afterMinutes:300,deductMinutes:30,enabled:true}
 await h.cmd('mealrule.save',meal,h.owner,409)
 await h.cmd('mealrule.save',{...meal,enabled:false})
 await h.cmd('mealrule.save',{...meal,site:'Third'})
 await h.cmd('policy.save',{site:'Third',from:'2026-01-01',preset:'CA'},h.owner,409)
 assert.deepEqual((await h.state(alex.cookie)).policies,[])
 assert.deepEqual((await h.state(manager.cookie)).policies,[])
 const custom=await save(h,'West','custom',{jurisdiction:'Unlisted city',dailyMinutes:480,doubleMinutes:720,weeklyMinutes:2400})
 const week=days(monday(new Date().toISOString().slice(0,10)),14)
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:days(week,21)+'T00:00:00Z'})
 let draft=await h.cmd('roster.prepare',{week,shifts:[spec(alex.id,week,10,'West')]})
 assert.match(draft.policyWarnings[0].message,/Unlisted city: employer-configured, unmaintained/)
 await h.cmd('template.save',{week,name:'Long-day template'})
 draft=await h.cmd('template.apply',{id:(await h.state()).templates[0].id,week:days(week,7)})
 assert.ok(draft.policyWarnings.some(w=>w.message.includes('120 overtime minutes')))
 ca=await h.cmd('policy.save',{...pin(ca),site:'East',from:'2026-01-01',preset:'CA',minimumRestMinutes:660,reviewReason:'synthetic-lanyard-5 employer rest requirement'})
 const give=spec(alex.id,days(week,1),4),prior={...spec(ben.id,week,4),start:week+'T20:00:00Z',end:days(week,1)+'T00:00:00Z'}
 const restDraft=await h.cmd('roster.prepare',{week,shifts:[{...give,staffId:ben.id},prior]});assert.ok(restDraft.policyWarnings.some(w=>w.message.includes('minimum rest')))
 draft=await h.cmd('roster.prepare',{week,shifts:[give,prior]});await h.cmd('roster.publish',pin(draft))
 const shift=(await h.state()).shifts.find(x=>x.rosterId===draft.id&&x.staffId===alex.id&&x.status==='published')
 const denied=await h.cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:ben.id},alex.cookie,409);assert.match(denied.error,/not eligible/)
 assert.equal((await h.state()).swaps.length,0)
 ca=await h.cmd('policy.save',{...pin(ca),site:'East',from:'2026-01-01',preset:'CA',minimumRestMinutes:0,reviewReason:'synthetic-lanyard-6 reviewed rest change'})
 const allowed=await h.cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:ben.id},alex.cookie);assert.equal(allowed.status,'proposed','the same proposal succeeds after the owner removes the rest requirement')
 let period=await h.cmd('period.save',{start:'2026-10-12',end:'2026-10-18'})
 // A closed record, even without policy-priced exports, cannot be silently repriced.
 period=await h.cmd('period.signoff',pin(period));await h.cmd('period.lock',pin(period))
 await h.cmd('policy.save',{...pin(custom),site:'West',from:'2026-10-12',preset:'federal',reviewReason:'Attempt to change locked payroll'},h.owner,409)
 const state=await h.state();assert.ok(state.events.some(e=>e.action==='policy.save'));assert.equal(state.policies.find(p=>p.id===custom.id).revision,1)
 return {alex,week:days(week,7)}
}
export async function policyBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();try{
  await h.cmd('settings.save',{timezone:'UTC'});const alex=await person(h),week=days(monday(new Date().toISOString().slice(0,10)),14)
  await save(h,'East','CA');await h.cmd('availability.save',{staffId:alex.id,start:week+'T00:00:00Z',end:days(week,7)+'T00:00:00Z'})
  await h.cmd('roster.prepare',{week,shifts:[spec(alex.id,week,13)]})
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
  const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}]);await page.goto(h.origin+`/app/schedule?week=${week}&view=draft`,{waitUntil:'networkidle'})
  const review=page.locator('[data-saved-review]');await review.scrollIntoViewIfNeeded();assert.match(await review.innerText(),/240 overtime minutes; 60 double-time minutes/);assert.match(await review.innerText(),/meal and rest compliance incomplete/)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  const shot=async label=>{if(process.env.POLICY_SCREENS){await mkdir(process.env.POLICY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_SCREENS,`${label}-${width}.png`)})}}
  await shot('policy-warning')
  const previous=page.getByRole('link',{name:'Previous week',exact:true});await previous.focus();await page.getByRole('tooltip',{name:'Previous week',exact:true}).waitFor({state:'visible'});await shot('policy-tooltip')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

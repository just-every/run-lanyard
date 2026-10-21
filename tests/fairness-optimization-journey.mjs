import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {optimizationFixture} from './fairness-optimization-fixture.mjs'
import {days,local,pin} from './workforce-journey.mjs'
export async function fairnessOptimizationApi(h) {
 const f=await optimizationFixture(h),comparison=await f.read(),{low,high}=comparison
 assert.equal(low.measures.weeks,8)
 assert.ok(high.measures.totals.spread<low.measures.totals.spread)
 assert.ok(high.measures.totals.meanGapMinutes<low.measures.totals.meanGapMinutes)
 assert.ok(high.measures.totals.maxGapMinutes<=low.measures.totals.maxGapMinutes)
 assert.ok(high.measures.totals.violations<low.measures.totals.violations)
 assert.equal(comparison.difference.costCents,2000)
 assert.equal(comparison.difference.coveredMinutes,0);assert.equal(comparison.difference.coveredShifts,0)
 assert.deepEqual(low.coverage.slots,high.coverage.slots)
 for(const alternative of [low,high]){
  // Recompute the named measures from the exported person-week and tag inputs.
  const gaps=alternative.measures.rows.filter(x=>x.gapMinutes!==null&&[f.alex.id,f.ben.id].includes(x.staffId)).map(x=>Math.abs(x.scheduledMinutes-x.preferredMinutes))
  assert.equal(alternative.measures.totals.meanGapMinutes,gaps.reduce((n,x)=>n+x,0)/gaps.length)
  const g=alternative.measures.undesirable.groups.find(x=>x.position==='Counter'),counts=g.counts.map(x=>x.count),mean=counts.reduce((n,x)=>n+x,0)/counts.length
  assert.equal(g.spread,Math.max(...counts)-Math.min(...counts));assert.equal(g.standardDeviation,Math.sqrt(counts.reduce((n,x)=>n+(x-mean)**2,0)/counts.length))
  const costs=alternative.cost.inputs.map(x=>x.basis.segments.reduce((n,p)=>n+Math.round(p.minutes*p.cents/60),0)+x.holiday.costCents)
  assert.equal(alternative.cost.costCents,costs.reduce((n,x)=>n+x,0))
  assert.equal(alternative.coverage.minutes,alternative.coverage.slots.reduce((n,x)=>n+x.minutes,0))
 }
 // Reporting and both alternatives stay independent of actual ratings and flags.
 await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:local(f.first,'08:00')},f.alex.cookie)
 const clock=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:local(f.first,'16:00'),breakMinutes:0},f.alex.cookie)
 await h.cmd('feedback.submit',{timesheetId:clock.timesheet.id,rating:1,flags:['safety'],comment:'Follow up'},f.alex.cookie)
 assert.deepEqual(await f.read(),comparison)
 for(const cookie of [f.alex.cookie,f.foreign.cookie,''])assert.equal((await h.send(f.path,undefined,cookie)).status,cookie===f.foreign.cookie?404:cookie?403:401)
 const prepare={week:f.week,site:'Ocean Beach',weeks:8,priority:'high',digest:comparison.digest}
 await h.cmd('fairness.prepare',prepare,f.alex.cookie,403)
 const draft=await h.cmd('fairness.prepare',prepare,f.manager.cookie);assert.deepEqual(draft.conflicts,[])
 assert.equal((await h.state()).rosters.find(x=>x.id===draft.id).status,'draft')
 await h.cmd('roster.publish',pin(draft),f.manager.cookie)
 const after=await f.read(f.base);assert.deepEqual(after.totals,high.measures.totals)
 await h.cmd('fairness.prepare',prepare,h.owner,409)
 // Real offered hours: only opened tiers count, each opportunity once per person.
 const future='2027-06-07'
 for(const p of [f.alex,f.ben])await h.cmd('pattern.save',{from:future,blocks:f.full,preferredHours:8,maxHours:40},p.cookie)
 const offer=await h.cmd('openshift.post',{site:'Ocean Beach',position:'Counter',start:local(future,'10:00'),end:local(future,'12:00'),breakMinutes:0,approval:'manager',order:'all'})
 const equity=await f.read(`/api/lanyard/fairness?week=${future}&site=Ocean%20Beach&weeks=1`)
 const group=equity.equity.groups.find(x=>x.position==='Counter');assert.ok(group)
 assert.equal(group.totalOfferedMinutes,240);assert.equal(group.totalRequestedMinutes,240)
 for(const row of group.rows){assert.equal(row.offeredMinutes,120);assert.equal(row.offeredShare,.5);assert.equal(row.requestedShare,row.staffId===f.alex.id?.25:.75);assert.equal(Math.abs(row.shareGap),.25)}
 assert.ok(equity.equity.inputs.some(x=>JSON.stringify(x).includes(offer.id)))
 const tiered=await h.cmd('openshift.post',{site:'Ocean Beach',position:'Counter',start:local(days(future,1),'10:00'),end:local(days(future,1),'11:00'),breakMinutes:0,approval:'manager',order:'tiers',rule:'custom',ranking:[f.alex.id,f.ben.id],size:1,minutes:1440})
 const reached=await f.read(`/api/lanyard/fairness?week=${future}&site=Ocean%20Beach&weeks=1`),reachedGroup=reached.equity.groups.find(x=>x.position==='Counter')
 assert.equal(reachedGroup.totalOfferedMinutes,300)
 assert.equal(reachedGroup.rows.find(x=>x.staffId===f.alex.id).offeredMinutes,180)
 assert.equal(reachedGroup.rows.find(x=>x.staffId===f.ben.id).offeredMinutes,120)
 assert.equal(reached.equity.inputs.find(x=>x.id===tiered.id&&x.staffId===f.ben.id).included,false)
 for(const person of [f.alex,f.ben])await h.cmd('fairness.request.save',{staffId:person.id,from:future,minutes:0},person.cookie)
 const zero=await f.read(`/api/lanyard/fairness?week=${future}&site=Ocean%20Beach&weeks=1`)
 assert.equal(zero.equity.groups[0].totalRequestedMinutes,0);assert.ok(zero.equity.groups[0].rows.every(x=>x.requestedShare===null&&x.shareGap===null))
 await h.cmd('fairness.cohort.save',{site:'Ocean Beach',position:'Manager',from:future,staffIds:[f.manager.id]})
 const missing=await f.read(`/api/lanyard/fairness?week=${future}&site=Ocean%20Beach&weeks=1`)
 assert.equal(missing.equity.groups.find(x=>x.position==='Manager').totalRequestedMinutes,null)
 await h.cmd('fairness.cohort.save',{site:'Ocean Beach',position:'Counter',from:days(f.first,-7),staffIds:[f.alex.id]},h.owner,409)
 // Hard availability/max limits survive the fairness objective and selected tags are employer controlled.
 await h.cmd('pattern.save',{from:f.week,blocks:'Mon unavailable 00:00-24:00',preferredHours:4,maxHours:4},f.ben.cookie)
 assert.equal((await h.send(f.path,undefined,h.owner)).status,400)
 const validDraft=await h.cmd('roster.prepare',{week:f.week,shifts:low.shifts});assert.deepEqual(validDraft.conflicts,[]);await h.cmd('roster.publish',pin(validDraft))
 const blocked=await f.read();assert.equal(blocked.high.assignments.some(x=>x.staffId===f.ben.id),false)
 await h.cmd('pattern.save',{from:f.week,blocks:f.full,preferredHours:0,maxHours:0},f.ben.cookie)
 const maximum=await f.read();assert.equal(maximum.high.assignments.some(x=>x.staffId===f.ben.id),false)
 const rule=(await h.state()).fairnesspolicies[0]
 await h.cmd('fairness.policy.save',{site:'Ocean Beach',revision:rule.revision,tags:['weekend','holiday','close-then-open'],closingTime:'22:00',openingTime:'08:00',closeOpenHours:12})
 const tagWeek='2026-10-05',sat=days(tagWeek,5),sun=days(tagWeek,6)
 await h.cmd('holiday.save',{site:'Ocean Beach',date:sat,name:'Employer service holiday',enabled:true})
 const tagDraft=await h.cmd('roster.prepare',{week:tagWeek,shifts:[{staffId:f.alex.id,site:'Ocean Beach',start:local(sat,'18:00'),end:local(sat,'22:00'),breakMinutes:0},{staffId:f.alex.id,site:'Ocean Beach',start:local(sun,'08:00'),end:local(sun,'10:00'),breakMinutes:0}]})
 assert.deepEqual(tagDraft.conflicts,[]);await h.cmd('roster.publish',pin(tagDraft))
 const tags=await f.read(`/api/lanyard/fairness?week=${tagWeek}&site=Ocean%20Beach&weeks=1`)
 assert.deepEqual(tags.undesirable.policy.tags,['weekend','holiday','close-then-open'])
 const tagged=tags.undesirable.groups.find(x=>x.position==='Counter').counts.find(x=>x.staffId===f.alex.id)
 assert.equal(tagged.count,2);assert.deepEqual(tagged.tags,{'weekend':2,'holiday':1,'close-then-open':1})
 const facts=tags.undesirable.inputs.filter(x=>x.staffId===f.alex.id);assert.equal(facts.filter(x=>x.tags.includes('close-then-open'))[0].restHours,10)
 assert.equal(tags.undesirable.groups[0].spread,2);assert.equal(tags.undesirable.groups[0].standardDeviation,1)
 // Date exceptions override recurring soft preferences; they never become unavailable.
 await h.cmd('pattern.save',{from:tagWeek,blocks:f.full,exceptions:`${sat} prefer-not 18:00-22:00`,preferredHours:8,maxHours:40},f.alex.cookie)
 const exception=await f.read(`/api/lanyard/fairness?week=${tagWeek}&site=Ocean%20Beach&weeks=1`);assert.equal(exception.violations.count,1)
 // Existing current-profile edits do not silently rewrite an employer-confirmed historical cohort.
 const live=(await h.state()).staff.find(x=>x.id===f.alex.id)
 await h.cmd('staff.save',{...pin(live),name:live.name,email:live.email,payrollId:live.payrollId,role:live.role,active:true,site:'Mission',position:'Other',hourlyRate:'20.00'})
 const retained=await f.read(`/api/lanyard/fairness?week=${tagWeek}&site=Ocean%20Beach&weeks=1`)
 assert.deepEqual(retained.undesirable,exception.undesirable)
 assert.equal((await h.state(f.ben.cookie)).fairnesscohorts.length,0)
 assert.equal((await h.state(f.foreign.cookie)).fairnesscohorts.length,0)
}
export async function fairnessOptimizationBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await optimizationFixture(h),page=await context.newPage()
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=f.manager.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await page.goto(`${h.origin}/app/schedule?week=${f.week}&site=Ocean%20Beach&fairCompare=1`,{waitUntil:'networkidle'})
   const card=page.locator('#fairness');for(const detail of await card.locator('details').all())await detail.evaluate(x=>x.open=true)
   await card.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.FAIRNESS_SCREENS){await mkdir(process.env.FAIRNESS_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.FAIRNESS_SCREENS,`${key}-${width}.png`)})}}
   await card.locator('summary').filter({hasText:/^Compare fairness priorities$/}).scrollIntoViewIfNeeded();await shot('fairness-comparison')
   const downloaded=await Promise.all([page.waitForEvent('download'),card.getByRole('link',{name:'Download comparison and calculation inputs (JSON)'}).click()]);const exported=JSON.parse(await readFile(await downloaded[0].path(),'utf8'));assert.equal(exported.difference.costCents,2000)
   for(const [summary,key] of [['Undesirable-shift distribution','fairness-tags'],['Extra-hours equity','fairness-equity'],['Fairness inputs and employer confirmation','fairness-configuration']]){await card.locator('summary').filter({hasText:new RegExp('^'+summary+'$')}).scrollIntoViewIfNeeded();await shot(key)}
   await page.getByRole('button',{name:'Prepare high fairness draft',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.ok((await page.locator('body').innerText()).includes('draft'))
   assert.equal((await h.state()).rosters.filter(x=>x.week===f.week&&x.status==='draft').length,1)
   await shot('fairness-draft')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

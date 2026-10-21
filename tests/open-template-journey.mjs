import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const add=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
async function fixture(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cara=await h.person('Cara'),priya=await h.person('Priya','manager')
 for(const p of [alex,ben,cara,priya])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,position:p===cara?'Kitchen':p===priya?'Manager':'Counter',site:'Harbor',hourlyRate:'20.00'})
 const next=new Date(Date.now()+28*86400000);next.setUTCDate(next.getUTCDate()-((next.getUTCDay()+6)%7))
 const source=next.toISOString().slice(0,10),target=add(source,7),other=add(source,14)
 for(const p of [alex,ben,cara])await h.cmd('availability.save',{staffId:p.id,start:source+'T00:00:00Z',end:add(source,22)+'T23:00:00Z'})
 const sourceRows=[]
 for(const [offset,position,label] of [[0,'Counter','Patio'],[1,'Kitchen','Prep']])sourceRows.push(await h.cmd('openshift.post',{site:'Harbor',position,start:add(source,offset)+'T16:00:00Z',end:add(source,offset)+'T20:00:00Z',breakMinutes:30,label,approval:'manager'},priya.cookie))
 return {alex,ben,cara,priya,source,target,other,sourceRows}
}
async function targetOpen(h,f) {return(await h.state()).openshifts.filter(o=>o.week===f.target&&o.status==='open')}
export async function openTemplateApi(h) {
 const f=await fixture(h),template=await h.cmd('template.save',{name:'Open service week',week:f.source},f.priya.cookie)
 assert.deepEqual(template.slots.map(s=>[s.staffId,s.position,s.label,s.breakMinutes]),[['','Counter','Patio',30],['','Kitchen','Prep',30]])
 await h.cmd('roster.prepare',{week:f.target,shifts:[]},f.priya.cookie,400)
 const first=await h.cmd('template.apply',{id:template.id,week:f.target,days:[0]},f.priya.cookie)
 assert.equal(first.shifts.length,0);assert.equal(first.openShifts.length,1)
 assert.deepEqual((await h.state(f.alex.cookie)).openshifts.filter(o=>o.week===f.target),[],'An open-only draft is private')
 const second=await h.cmd('template.apply',{id:template.id,week:f.target,days:[1]},f.priya.cookie)
 assert.equal(second.shifts.length,0);assert.equal(second.openShifts.length,2,'Adding to an open-only draft retains its existing positions')
 assert.deepEqual(second.openShifts.map(o=>[o.position,o.start,o.minutes,o.status]),[['Counter',f.target+'T16:00:00.000Z',210,'draft'],['Kitchen',add(f.target,1)+'T16:00:00.000Z',210,'draft']])
 const state=await h.state(),review=state.scheduleReviews.find(r=>r.week===f.target)
 assert.deepEqual(review.gaps.map(g=>g.position).sort(),['Counter','Kitchen']);assert.equal(review.conflicts.length,0)
 assert.equal(state.openshifts.find(o=>o.id===first.openShifts[0].id).status,'replaced-draft')
 await h.cmd('roster.publish',pin(first),f.priya.cookie,409)
 await h.cmd('roster.publish',pin(second),f.priya.cookie)
 const posted=await targetOpen(h,f),counter=posted.find(o=>o.position==='Counter'),kitchen=posted.find(o=>o.position==='Kitchen')
 assert.equal(kitchen.position,'Kitchen')
 assert.deepEqual((await h.state(f.alex.cookie)).openshifts.filter(o=>o.week===f.target).map(o=>o.position),['Counter'])
 assert.deepEqual((await h.state(f.cara.cookie)).openshifts.filter(o=>o.week===f.target).map(o=>o.position),['Kitchen'])
 await h.cmd('openshift.request',pin(first.openShifts[0]),f.alex.cookie,409)
 const a=await h.cmd('openshift.request',pin(counter),f.alex.cookie),b=await h.cmd('openshift.request',pin(counter),f.ben.cookie)
 const filled=await h.cmd('openshift.approve',pin(a),f.priya.cookie)
 assert.equal(filled.shift.staffId,f.alex.id);assert.equal(filled.shift.minutes,210);assert.equal(filled.shift.rosterId,second.id)
 await h.cmd('openshift.approve',pin(b),f.priya.cookie,409)
 const after=await h.state();assert.equal(after.pickups.find(p=>p.id===b.id).status,'closed');assert.equal(after.shifts.filter(s=>s.openShiftId===counter.id).length,1)
 assert.deepEqual(after.openshifts.filter(o=>f.sourceRows.some(r=>r.id===o.id)).sort((a,b)=>a.id.localeCompare(b.id)),[...f.sourceRows].sort((a,b)=>a.id.localeCompare(b.id)),'Saving/applying a template never changes the source week')
 // Editing assigned rows preserves open positions and archives their superseded private row versions.
 const replaced=await h.cmd('template.apply',{id:template.id,week:f.other},f.priya.cookie)
 const assigned=await h.cmd('roster.prepare',{week:f.other,shifts:[{staffId:f.alex.id,start:f.other+'T16:00:00Z',end:f.other+'T20:00:00Z',breakMinutes:30}]},f.priya.cookie)
 assert.ok((await h.state()).openshifts.filter(o=>replaced.openShifts.some(r=>r.id===o.id)).every(o=>o.status==='replaced-draft'))
 await h.cmd('roster.publish',pin(assigned),f.priya.cookie)
 assert.deepEqual((await h.state()).openshifts.filter(o=>o.week===f.other&&o.status==='open').map(o=>o.position).sort(),['Counter','Kitchen'],'Editing assigned shifts cannot erase open coverage')
 assert.deepEqual((await h.state(f.ben.cookie)).openshifts.filter(o=>o.week===f.other).map(o=>o.position),['Counter'])
 assert.deepEqual((await h.state(f.alex.cookie)).openshifts.filter(o=>o.week===f.other),[],'The assigned employee cannot also pick up overlapping coverage')
 const saved=await h.cmd('template.save',{name:'Assigned replacement',week:f.other},f.priya.cookie);assert.equal(saved.slots.length,3);assert.equal(saved.slots.filter(s=>s.staffId===f.alex.id).length,1);assert.deepEqual(saved.slots.filter(s=>!s.staffId).map(s=>s.position).sort(),['Counter','Kitchen'])
}
export async function openTemplateBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}}),employee=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fixture(h)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   for(const [ctx,cookie] of [[context,f.priya.cookie],[employee,f.alex.cookie]]){
    const [name,...value]=cookie.split('=');await ctx.addCookies([{name,value:value.join('='),url:h.origin}])
    await ctx.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   }
   const page=await context.newPage(),staff=await employee.newPage(),url=week=>h.origin+`/app/schedule?week=${week}&view=draft&site=Harbor`
   const submit=async(button,command)=>{const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name='+command)),button.click()]);assert.equal(response.status(),200);assert.ok(!(await response.text()).includes('class="notice error"'));await page.waitForLoadState('networkidle')}
   const shot=async(name,locator)=>{await locator.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.OPEN_TEMPLATE_SCREENS){await mkdir(process.env.OPEN_TEMPLATE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.OPEN_TEMPLATE_SCREENS,`open-template-${name}-${width}.png`)})}}
   await page.goto(url(f.source),{waitUntil:'networkidle'})
   const save=page.locator('#repeat details').filter({has:page.locator('form[action*="template.save"]')});await save.locator('summary').click();await save.getByLabel('Template name').fill('Open service week')
   await submit(save.getByRole('button',{name:'Save template',exact:true}),'template.save')
   await page.goto(url(f.target),{waitUntil:'networkidle'})
   const apply=page.locator('#repeat details').filter({has:page.locator('form[action*="template.apply"]')});await apply.locator('summary').click();await submit(apply.getByRole('button',{name:'Apply to this week',exact:true}),'template.apply')
   const review=page.locator('[data-saved-review]');assert.match(await review.innerText(),/Unfilled open shift: Counter/);assert.match(await review.innerText(),/Unfilled open shift: Kitchen/)
   assert.equal((await h.state(f.alex.cookie)).openshifts.filter(o=>o.week===f.target).length,0)
   await shot('review',review)
   await submit(page.getByRole('button',{name:'Publish this revision',exact:true}),'roster.publish')
   const posted=await targetOpen(h,f);assert.equal(posted.length,2);const targetCounter=posted.find(o=>o.position==='Counter')
   await staff.goto(url(f.target),{waitUntil:'networkidle'})
   const offered=staff.locator('#open-shifts li').filter({has:staff.locator(`input[name=id][value="${targetCounter.id}"]`)});assert.match(await offered.innerText(),/Counter/);assert.ok(!(await staff.locator('#open-shifts').innerText()).includes('Prep'))
   await offered.getByRole('button',{name:'Request',exact:true}).click();await staff.waitForLoadState('networkidle')
   await page.goto(url(f.target),{waitUntil:'networkidle'})
   const request=(await h.state()).pickups.find(p=>p.staffId===f.alex.id&&p.openShiftId===targetCounter.id)
   const counter=page.locator('#open-shifts li').filter({has:page.locator(`input[name=id][value="${request.id}"]`)});await submit(counter.getByRole('button',{name:'Approve Alex',exact:true}),'openshift.approve')
   const state=await h.state();assert.equal(state.shifts.filter(s=>s.status==='published'&&s.staffId===f.alex.id&&s.rosterId===state.rosters.find(r=>r.week===f.target&&r.status==='published').id).length,1)
   await shot('assigned',page.locator('#open-shifts'))
   await staff.goto(url(f.target),{waitUntil:'networkidle'});assert.ok((await h.state(f.alex.cookie)).shifts.some(s=>s.openShiftId&&s.start===f.target+'T16:00:00.000Z'))
   assert.equal(await staff.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.OPEN_TEMPLATE_SCREENS)await staff.screenshot({path:join(process.env.OPEN_TEMPLATE_SCREENS,`open-template-employee-${width}.png`)})
  }finally{await context.close();await employee.close();await h.close()}
 }}finally{await browser.close()}
}

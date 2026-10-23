import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,local} from './workforce-journey.mjs'
const add=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
export async function minorFixture(h){
 const alex=await h.person('Alex'),ben=await h.person('Ben'),morgan=await h.person('Morgan','manager')
 for(const p of [alex,ben,morgan])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'Ocean Beach',position:'Service',hourlyRate:'20.00'})
 const today=new Date().toISOString().slice(0,10),future=add(today,10),week=add(future,-((new Date(future+'T00:00:00Z').getUTCDay()+6)%7)),last=add(week,6),past=add(today,-7),birthday=add(today,-10),birthDate=String(Number(birthday.slice(0,4))-15)+birthday.slice(4)
 const schoolDays=Array.from({length:42},(_,n)=>add(past,n-7)).filter(d=>![0,6].includes(new Date(d+'T00:00:00Z').getUTCDay()))
 const input={staffId:alex.id,birthDate,state:'federal',permit:'synthetic-lanyard-1',permitThrough:last,calendarFrom:add(past,-7),calendarThrough:add(past,60),schoolDays,schoolStart:480,schoolEnd:900}
 const minor=await h.cmd('minor.save',input)
 const spec=(day,start='16:00',end='19:00',person=alex)=>({staffId:person.id,start:local(day,start),end:local(day,end),breakMinutes:0,site:'Ocean Beach',label:'After school'})
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:local(past,'00:00'),end:local(add(week,14),'00:00')})
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,morgan,today,week,past,minor,input,spec}
}
export async function minorApi(h){
 const f=await minorFixture(h),{alex,ben,morgan,week,minor,input,spec,past}=f
 const invalid=await h.cmd('roster.prepare',{week,shifts:[spec(week,'16:00','20:00')]})
 assert.ok(invalid.conflicts.some(x=>x.reason.includes('school-day limit 180')));assert.ok(invalid.conflicts.some(x=>x.reason.includes('outside permitted clock hours')))
 await h.cmd('roster.publish',pin(invalid),h.owner,409)
 const shifts=Array.from({length:6},(_,n)=>spec(add(week,n))),valid=await h.cmd('roster.prepare',{week,shifts});assert.deepEqual(valid.conflicts,[]);await h.cmd('roster.publish',pin(valid))
 const open=await h.cmd('openshift.post',{site:'Ocean Beach',position:'Service',start:local(add(week,5),'10:00'),end:local(add(week,5),'11:00'),breakMinutes:0,label:'Extra hour',approval:'manager'})
 assert.ok(!open.tiers.some(t=>t.staffIds.includes(alex.id)),'the school-week limit excludes the minor from open-shift offers')
 const refused=await h.cmd('openshift.request',pin(open),alex.cookie,409);assert.match(refused.error,/school-week limit 1080/)
 // Swaps and cover use the same checked eligibility, with no age disclosed.
 const other=await h.cmd('roster.prepare',{week,shifts:[...shifts,spec(add(week,5),'10:00','11:00',ben)]});assert.deepEqual(other.conflicts,[]);await h.cmd('roster.publish',pin(other))
 const published=(await h.state()).shifts.find(x=>x.staffId===ben.id&&x.status==='published')
 const swap=await h.cmd('swap.propose',{shiftId:published.id,revision:published.revision,to:alex.id},ben.cookie,409);assert.match(swap.error,/not eligible/)
 const callout=await h.cmd('shift.callout',{...pin(published),note:'Cannot cover this hour'},ben.cookie);assert.ok(!callout.offers.some(o=>o.staffId===alex.id));assert.ok(callout.shift.callout.leftOut.some(o=>o.staffId===alex.id&&o.minorRule.includes('school-week')))
 const before=(await h.state()).clocks.length
 const early=await h.cmd('clock.in',{commandId:'synthetic-lanyard-2',capturedAt:local(past,'06:00')},alex.cookie,409);assert.match(early.error,/outside permitted clock hours/);assert.equal((await h.state()).clocks.length,before)
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-4',capturedAt:local(past,'15:00')},alex.cookie)
 const late=await h.cmd('clock.out',{commandId:'synthetic-lanyard-5',capturedAt:local(past,'19:30'),breakMinutes:0},alex.cookie);assert.ok(late.timesheet.exceptions.some(x=>x.includes('school-day limit 180')));assert.ok(late.timesheet.exceptions.some(x=>x.includes('outside permitted clock hours')))
 // Separate state treatment of a 17-year-old, and every shipped core state preset.
 for(const state of ['CA','NY','IL','WA','OR','CO']){
  const dob=String(Number(input.birthDate.slice(0,4))-2)+input.birthDate.slice(4)
  const old=(await h.state()).minors.find(r=>r.staffId===alex.id)
  await h.cmd('minor.save',{...input,...pin(old),birthDate:dob,state})
  const trial=await h.cmd('roster.prepare',{week,shifts:[spec(week,'16:00','21:00')]})
  if(['CA','NY','WA'].includes(state))assert.ok(trial.conflicts.some(x=>x.reason.includes('school-day limit 240')),state)
  else assert.ok(!trial.conflicts.some(x=>x.reason.includes('school-day limit')),state+' has no 4-hour school-day core limit for this age')
 }
 const birthData=JSON.stringify((await h.state()).minors)
 assert.ok(birthData.includes(input.birthDate.slice(5)));assert.ok((await h.state()).minors[0].versions.length>=6)
 assert.deepEqual((await h.state(ben.cookie)).minors,[]);assert.deepEqual((await h.state(morgan.cookie)).minors,[])
 const agent=await h.cmd('agent.create',{label:'Minor records test'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`});assert.deepEqual(context.value.minors,[]);assert.ok(!JSON.stringify(context.value).includes('birthDate'))
 await h.cmd('minor.save',input,ben.cookie,403);await h.cmd('minor.save',input,morgan.cookie,403)
 await h.cmd('minor.save',{...input,...pin(minor)},h.owner,409)
 await minorVariants()
}
export async function minorBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
 try{const f=await minorFixture(h),page=await context.newPage()
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.C35_SCREENS){await mkdir(process.env.C35_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C35_SCREENS,`${name}-${width}.png`)})}}
 await as(h.owner);await page.goto(h.origin+'/app/people',{waitUntil:'networkidle'});const card=page.locator('#minors');await card.getByText('Alex · federal',{exact:true}).click();const form=card.locator('form').first();assert.equal(await form.getByLabel('Birth date',{exact:true}).inputValue(),f.input.birthDate);await form.getByLabel('State work permit reference').fill('synthetic-lanyard-3');await Promise.all([page.waitForResponse(r=>r.url().includes('name=minor.save')),form.getByRole('button',{name:'Save minor record'}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);await page.locator('#minors').getByText('Alex · federal',{exact:true}).click();await page.locator('#minors form').first().scrollIntoViewIfNeeded();await shot('minor-record')
 const invalid=await h.cmd('roster.prepare',{week:f.week,shifts:[f.spec(f.week,'16:00','20:00')]});await page.goto(h.origin+`/app/schedule?week=${f.week}&view=draft`,{waitUntil:'networkidle'});assert.ok((await page.locator('main').innerText()).includes('school-day limit 180'));await page.locator('[data-saved-review]').scrollIntoViewIfNeeded();await shot('minor-schedule-refusal')
 const previous=page.getByRole('link',{name:'Previous week',exact:true});await previous.focus();await page.getByRole('tooltip',{name:'Previous week',exact:true}).waitFor({state:'visible'});await shot('minor-tooltip')
 await as(f.ben.cookie);await page.goto(h.origin+`/app/schedule?week=${f.week}`,{waitUntil:'networkidle'});assert.ok(!(await page.locator('body').innerText()).includes(f.input.birthDate));assert.equal(await page.locator('[name=birthDate]').count(),0);await shot('minor-coworker')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

// Retained actuals and planned shifts must describe each interval once, including
// an approved correction and late work that crosses a calendar-day boundary.
async function minorVariants(){
 const h=await harness()
 try{
  const alex=await h.person('Alex'),morgan=await h.person('Morgan','manager')
  const input={staffId:alex.id,birthDate:'2008-01-01',state:'CO',permit:'synthetic-lanyard-20',permitThrough:'2025-12-31',calendarFrom:'2025-01-01',calendarThrough:'2025-12-31',schoolDays:[],schoolStart:480,schoolEnd:900}
  let record=await h.cmd('minor.save',input)
  await h.cmd('availability.save',{staffId:alex.id,start:local('2025-01-01','00:00'),end:local('2026-01-01','00:00')})
  const shift=(day,start,end)=>({staffId:alex.id,start:local(day,start),end:local(day,end),breakMinutes:0})
  const worked=shift('2025-10-13','16:00','22:00'),draft=await h.cmd('roster.prepare',{week:'2025-10-13',shifts:[worked]})
  assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft))
  const source=await h.cmd('time.prepare',{...worked,reason:'Recorded actual work'})
  const approved=await h.cmd('time.approve',pin(source),morgan.cookie)
  assert.ok(!approved.exceptions.some(x=>x.includes('limit')),'scheduled work represented by actual work is not counted twice')
  const trial=await h.cmd('roster.prepare',{week:'2025-10-13',shifts:[worked,shift('2025-10-14','08:00','11:00')]})
  assert.ok(trial.conflicts.some(x=>x.reason.includes('rolling 24-hour limit 480')),'six evening hours plus three next-morning hours breach the rolling bound')
  await h.cmd('roster.publish',pin(trial),h.owner,409)
  const correction=await h.cmd('time.prepare',{...worked,end:local('2025-10-13','20:00'),corrects:approved.id,reason:'Reviewed two-hour correction'})
  const pending=await h.cmd('roster.prepare',{week:'2025-10-13',shifts:[shift('2025-10-14','08:00','11:00')]})
  assert.ok(pending.conflicts.some(x=>x.reason.includes('rolling 24-hour')),'a pending reduction cannot remove approved work')
  await h.cmd('time.approve',pin(correction),morgan.cookie)
  const reduced=await h.cmd('roster.prepare',{week:'2025-10-13',shifts:[shift('2025-10-14','08:00','11:00')]})
  assert.deepEqual(reduced.conflicts,[],'approved correction replaces superseded hours')
  await h.cmd('roster.publish',pin(reduced))
  const actual=await h.cmd('time.prepare',{...shift('2025-10-14','08:00','13:00'),reason:'Retain the full work actually performed'})
  assert.ok(actual.exceptions.some(x=>x.includes('rolling 24-hour limit 480')),'manual submission warns before review')
  const flagged=await h.cmd('time.approve',pin(actual),morgan.cookie)
  assert.ok(flagged.exceptions.some(x=>x.includes('rolling 24-hour limit 480')),'unscheduled manual actuals are retained and flagged rather than discarded')
  // California allows 00:00–00:30 on a non-school date, but not a minute more.
  record=await h.cmd('minor.save',{...input,...pin(record),state:'CA',schoolDays:['2025-10-20','2025-10-21']})
  const overnight=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[{...shift('2025-10-24','20:00','23:00'),end:local('2025-10-25','00:30')}]})
  assert.deepEqual(overnight.conflicts,[])
  const over=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[{...shift('2025-10-24','20:00','23:00'),end:local('2025-10-25','00:31')}]})
  assert.ok(over.conflicts.some(x=>x.reason.includes('outside permitted clock hours')))
  const school=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-20','16:00','21:00')]})
  assert.ok(school.conflicts.some(x=>x.reason.includes('school-day limit 240')))
  // Unknown next-day or week dates cannot become implicit non-school permission.
  record=await h.cmd('minor.save',{...input,...pin(record),state:'CA',calendarThrough:'2025-10-24',schoolDays:['2025-10-24']})
  const unknown=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-24','16:00','23:30')]})
  assert.ok(unknown.conflicts.some(x=>x.reason.includes('calendar must include the next day')))
  await h.cmd('roster.publish',pin(unknown),h.owner,409)
  record=await h.cmd('minor.save',{...input,...pin(record),state:'CA',schoolDays:['2025-10-24','2025-10-25']})
  const nextSchool=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-24','16:00','23:30')]})
  assert.ok(nextSchool.conflicts.some(x=>x.reason.includes('outside permitted clock hours')))
  record=await h.cmd('minor.save',{...input,...pin(record),state:'CA',schoolDays:['2025-10-24']})
  const nextFree=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-24','16:00','23:30')]})
  assert.deepEqual(nextFree.conflicts,[],'an explicitly covered non-school next day permits the existing extended hours')
  record=await h.cmd('minor.save',{...input,...pin(record),state:'federal',birthDate:'2010-01-01',calendarFrom:'2025-10-20',calendarThrough:'2025-10-20',schoolDays:[]})
  const incompleteWeek=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-20','16:00','17:00')]})
  assert.ok(incompleteWeek.conflicts.some(x=>x.reason.includes('calendar must cover the full workweek')))
  await h.cmd('roster.publish',pin(incompleteWeek),h.owner,409)
  for(const state of ['NY','WA']){
   record=await h.cmd('minor.save',{...input,...pin(record),state,calendarFrom:'2025-10-20',calendarThrough:'2025-10-21',schoolDays:[]})
   const incomplete=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-20','16:00','17:00')]})
   assert.ok(incomplete.conflicts.some(x=>x.reason.includes('calendar must cover the full workweek')),state+' must not infer a non-school week from missing dates')
   await h.cmd('roster.publish',pin(incomplete),h.owner,409)
  }
  // An expired reference is not a verified permit; show a specific warning.
  record=await h.cmd('minor.save',{...input,...pin(record),state:'CA',permitThrough:'2025-10-01'})
  const permit=await h.cmd('roster.prepare',{week:'2025-10-20',shifts:[shift('2025-10-20','16:00','17:00')]})
  assert.ok(permit.conflicts.some(x=>x.reason.includes('work permit has expired')))
  const before=(await h.state()).clocks.length
  await h.cmd('clock.in',{commandId:'synthetic-lanyard-21',capturedAt:local('2025-10-20','16:00')},alex.cookie,409)
  assert.equal((await h.state()).clocks.length,before)
 }finally{await h.close()}
}

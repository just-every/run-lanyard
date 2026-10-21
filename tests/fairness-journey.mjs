import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {fairnessFixture} from './fairness-fixture.mjs'
import {days,local} from './workforce-journey.mjs'
export async function fairnessApi(h) {
 const f=await fairnessFixture(h),r=await f.read(),counter=r.groups.find(g=>g.position==='Counter')
 assert.equal(r.weeks,8);assert.equal(r.first,f.first);assert.equal(r.last,days(f.week,6))
 assert.deepEqual([counter.samples,counter.excluded,counter.meanGapMinutes,counter.maxGapMinutes],[16,8,120,120])
 const alex=r.rows.filter(x=>x.staffId===f.alex.id),ben=r.rows.filter(x=>x.staffId===f.ben.id)
 assert.equal(alex.reduce((n,x)=>n+x.scheduledMinutes,0),8*480);assert.equal(ben.reduce((n,x)=>n+x.scheduledMinutes,0),8*240)
 for(const x of [...alex,...ben]){assert.equal(x.gapMinutes,Math.abs(x.scheduledMinutes-x.preferredMinutes));assert.equal(x.preferredShifts,1);assert.equal(x.patterns.length,7);assert.equal(x.shifts.length,1);assert.ok(x.patterns.every(p=>p.id&&p.revision===1));assert.ok(x.roster.id)}
 for(const x of r.rows.filter(x=>x.staffId===f.unknown.id)){assert.equal(x.preferredMinutes,null);assert.equal(x.gapMinutes,null);assert.equal(x.scheduledMinutes,0)}
 assert.deepEqual(await f.read(f.manager.cookie),r)
 for(const cookie of [f.alex.cookie,f.foreign.cookie,''])assert.equal((await h.send(f.path,undefined,cookie)).status,cookie===f.foreign.cookie?404:cookie?403:401)
 for(const suffix of ['&weeks=0','&weeks=53','&weeks=1.5','&weeks=no'])assert.equal((await h.send(f.path+suffix,undefined,h.owner)).status,400)
 assert.equal((await h.send('/api/lanyard/fairness?week=2026-09-22',undefined,h.owner)).status,400)
 const key=await h.cmd('agent.create',{label:'Prepare only'})
 assert.equal((await h.send(f.path,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
 const wider=await f.read(h.owner,'&weeks=9');assert.equal(wider.rows.filter(x=>x.week===days(f.first,-7)).every(x=>x.scheduledMinutes===null&&x.gapMinutes===null),true)
 const shorter=await f.read(h.owner,'&weeks=1');assert.equal(shorter.rows.length,4)
 // Actual feedback changes never affect the report, including low ratings and safety flags.
 await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:local(f.first,'10:00')},f.alex.cookie)
 const t=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:local(f.first,'18:00'),breakMinutes:0},f.alex.cookie)
 await h.cmd('feedback.submit',{timesheetId:t.timesheet.id,rating:1,flags:['safety'],comment:'Safety follow-up'},f.alex.cookie)
 assert.deepEqual(await f.read(),r)
 const serialized=JSON.stringify(r);for(const privateField of ['email','payrollId','rateCents','feedback','Safety follow-up',f.foreign.id])assert.equal(serialized.includes(privateField),false,privateField)
 // A midweek change remains unknown; the next complete week uses the new preference.
 await h.cmd('pattern.save',{from:days(f.week,-5),blocks:f.blocks,preferredHours:12},f.alex.cookie)
 const changed=await f.read();assert.equal(changed.rows.find(x=>x.staffId===f.alex.id&&x.week===days(f.week,-7)).gapMinutes,null);assert.equal(changed.rows.find(x=>x.staffId===f.alex.id&&x.week===f.week).gapMinutes,240)
 assert.ok(changed.rows.find(x=>x.staffId===f.alex.id&&x.week===days(f.week,-7)).reasons.some(x=>x.includes('change within')))
 const page=await h.send(`/app/schedule?week=${f.week}&site=Ocean%20Beach`,undefined,f.manager.cookie);assert.equal(page.status,200);assert.match(page.text,/id="fairness"/)
 const staffPage=await h.send(`/app/schedule?week=${f.week}`,undefined,f.alex.cookie);assert.equal(staffPage.text.includes('id="fairness"'),false)
}
export async function fairnessBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fairnessFixture(h),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=f.manager.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await page.goto(`${h.origin}/app/schedule?week=${f.week}&site=Ocean%20Beach`,{waitUntil:'networkidle'})
   const card=page.locator('#fairness');await card.getByText('Inspect preference gaps',{exact:true}).click();await card.scrollIntoViewIfNeeded()
   assert.ok((await card.innerText()).includes('mean gap 2.00 hours'));assert.ok((await card.innerText()).includes('Casey'))
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.FAIRNESS_SCREENS){await mkdir(process.env.FAIRNESS_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.FAIRNESS_SCREENS,`${key}-${width}.png`)})}}
   await shot('preference-eight-weeks')
   const download=await Promise.all([page.waitForEvent('download'),card.getByRole('link',{name:'Download calculation inputs (JSON)'}).click()]);const body=JSON.parse(await readFile(await download[0].path(),'utf8'));assert.equal(body.rows.filter(x=>x.staffId===f.alex.id).length,8)
   await card.getByLabel('Trailing weeks').fill('1');await card.getByRole('button',{name:'Show preference inputs'}).click();await page.waitForLoadState('networkidle');await card.getByText('Inspect preference gaps',{exact:true}).click();await card.scrollIntoViewIfNeeded();assert.equal(await card.locator('tbody tr').count(),4);await shot('preference-one-week')
   await page.goto(`${h.origin}/app/schedule?week=${days(f.first,-7)}&site=Ocean%20Beach`,{waitUntil:'networkidle'});await card.getByText('Inspect preference gaps',{exact:true}).click();await card.scrollIntoViewIfNeeded();assert.ok((await card.innerText()).includes('No published week'));await shot('preference-unknown');assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

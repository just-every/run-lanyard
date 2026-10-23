import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})

/** TIME-008: one refused correction must not supersede its approved source. */
export async function failedBulkFixture(h) {
 const person=await h.cmd('staff.save',{name:'Maya',email:'maya@venue.example',payrollId:'MAYA',role:'staff',active:true,site:'Ocean Beach',hourlyRate:'20.00'})
 const enter=(date,extra={})=>h.cmd('time.prepare',{staffId:person.id,start:`${date}T17:00:00Z`,end:`${date}T18:00:00Z`,breakMinutes:0,reason:'Reviewed paper time',...extra})
 const source=await h.cmd('time.approve',pin(await enter('2025-11-25')))
 await h.cmd('holiday.save',{site:'Ocean Beach',date:'2025-11-27',name:'Company holiday',enabled:true})
 await h.cmd('holidayrule.save',{site:'Ocean Beach',from:'2025-01-01',mode:'multiplier',value:1.5,nonWorkMinutes:480,beforeAfter:false,code:'HOL'})
 const review=(await h.state()).holidayReviews.find(r=>r.staffId===person.id&&r.date==='2025-11-27'&&r.kind==='non-work')
 const holiday=await h.cmd('holidaypay.approve',{staffId:person.id,site:'Ocean Beach',date:review.date,reference:'maya-company-holiday',digest:review.digest})
 const {approvalRequired,approval,...correction}=await enter('2025-11-27',{corrects:source.id}),clean=await enter('2025-11-28')
 // Compare the same public read projection before and after the refused bulk action.
 // Command results contain retained fields; state additionally supplies photo review.
 const before=await h.state()
 const sourceBefore=before.timesheets.find(r=>r.id===source.id)
 const {review:pendingReview,...correctionBefore}=before.timesheets.find(r=>r.id===correction.id)
 const {photoReview,...sourceStored}=sourceBefore
 assert.deepEqual(sourceStored,source)
 assert.deepEqual(photoReview,[],'Manual time has no captured punch photos')
 const {photoReview:pendingPhotos,...pendingStored}=correctionBefore
 assert.deepEqual(pendingStored,correction)
 assert.deepEqual(pendingPhotos,[])
 return {person,source,sourceBefore,correction,correctionBefore,clean,holiday,items:[pin(correction),pin(clean)]}
}
export async function assertFailedBulk(h,f) {
 const state=await h.state()
 assert.deepEqual(state.timesheets.find(r=>r.id===f.source.id),f.sourceBefore,'A refused approval leaves every retained source field unchanged')
 const {review,...pending}=state.timesheets.find(r=>r.id===f.correction.id)
 assert.deepEqual(pending,f.correctionBefore,'The refused correction stays pending at its reviewed revision')
 assert.equal(state.timesheets.find(r=>r.id===f.clean.id).status,'approved','A separate valid item still succeeds')
 assert.deepEqual(state.holidaypay.find(r=>r.id===f.holiday.id),f.holiday)
 assert.ok(!state.events.some(e=>e.action==='time.approve'&&e.entityId===f.correction.id))
 assert.equal(state.events.filter(e=>e.action==='time.approve'&&e.entityId===f.clean.id).length,1)
}
export async function failedBulkApi(h) {
 const f=await failedBulkFixture(h),result=await h.cmd('time.approveMany',{items:f.items})
 assert.deepEqual(result.approved.map(r=>r.id),[f.clean.id]);assert.deepEqual(result.skipped.map(r=>r.id),[f.correction.id])
 assert.match(result.skipped[0].reason,/non-work holiday/)
 await assertFailedBulk(h,f)
 // Resolve the real refusal, then the same pending correction can be approved.
 await h.cmd('holidaypay.correct',{...pin(f.holiday),minutes:0,reason:'Recorded work replaces non-work holiday input'})
 const retried=await h.cmd('time.approveMany',{items:[pin(f.correction)]})
 assert.deepEqual(retried.approved.map(r=>r.id),[f.correction.id])
 const state=await h.state();assert.equal(state.timesheets.find(r=>r.id===f.source.id).status,'superseded');assert.equal(state.timesheets.find(r=>r.id===f.correction.id).status,'approved')
}
export async function failedBulkBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await failedBulkFixture(h),page=await context.newPage()
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await page.goto(`${h.origin}/app/time?week=2025-11-24&cafe=Ocean%20Beach`,{waitUntil:'networkidle'})
   const bulk=page.getByRole('button',{name:'Approve 2 shown',exact:true})
   await bulk.scrollIntoViewIfNeeded();await bulk.click();await page.waitForLoadState('networkidle')
   const result=page.getByRole('status').filter({hasText:'Approved 1 · skipped 1'})
   await result.waitFor();assert.ok((await result.innerText()).includes('non-work holiday'))
   await assertFailedBulk(h,f)
   await result.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.BULK_SCREENS){await mkdir(process.env.BULK_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.BULK_SCREENS,`bulk-skipped-correction-${width}.png`)})}
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

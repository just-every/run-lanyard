import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const site='Orchard Street Cafe',week='2026-10-12'
const usd=cents=>'$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})

async function fixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const crew=[]
 for(const [key,name,position,rate]of [['MayaRivera','Maya Rivera','Barista','22.00'],['LeoChen','Leo Chen','Baker','24.00']]){
  const p=await h.person(key)
  await h.cmd('staff.save',{...pin(p),name,email:p.email,payrollId:p.payrollId,active:true,role:'staff',site,position,hourlyRate:rate})
  crew.push({...p,name})
 }
 const manager=await h.person('RileyBrooks','manager')
 await h.cmd('staff.save',{...pin(manager),name:'Riley Brooks',email:manager.email,payrollId:manager.payrollId,active:true,role:'manager',site})
 const old=await h.cmd('policy.save',{site,preset:'NY',from:'2026-01-01',presetVersion:'2026-10-24',breakVersion:'2026-10-26',reviewReason:'Retained cafe policy before the maintained meal-window correction'})
 for(const [i,p]of crew.entries()){
  await h.cmd('clock.in',{commandId:`settings-in-${i}`,capturedAt:week+'T08:00:00Z'},p.cookie)
  await h.cmd('clock.breakStart',{commandId:`settings-meal-${i}`,capturedAt:week+'T11:00:00Z',kind:'meal'},p.cookie)
  await h.cmd('clock.breakEnd',{commandId:`settings-meal-end-${i}`,capturedAt:week+'T11:30:00Z'},p.cookie)
  const out=await h.cmd('clock.out',{commandId:`settings-out-${i}`,capturedAt:week+'T16:00:00Z',breakMinutes:0},p.cookie)
  await h.cmd('time.approve',pin(out.timesheet))
 }
 const period=await h.cmd('period.save',{start:week,end:'2026-10-18'})
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {crew,manager,old,period}
}

export async function browserAssets(context){
 await context.route('**/*',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{
   return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})
  }catch{}
  await route.continue()
 })
}

async function submit(page,form,command){
 await Promise.all([page.waitForResponse(r=>r.url().includes('name='+command)),form.getByRole('button',{name:command==='policy.preview'?'Preview policy changes':'Apply reviewed policy',exact:true}).click()])
 await page.waitForLoadState('networkidle')
}

export async function policySettingsBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fixture(h),page=await context.newPage()
   const direct=await h.send('/app/settings',undefined,h.owner);assert.equal(direct.status,200,direct.text)
   await browserAssets(context)
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const shot=async label=>{if(process.env.POLICY_SCREENS){await mkdir(process.env.POLICY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_SCREENS,`${label}-${width}.png`)})}}
   await page.goto(h.origin+'/app/schedule',{waitUntil:'networkidle'})
   const account=page.getByLabel('Account',{exact:true});await account.focus()
   await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
   await account.click();await page.getByRole('link',{name:'Settings',exact:true}).click();await page.waitForLoadState('networkidle')
   await page.locator('#policy-pick').waitFor({state:'visible'});const picker=page.locator('#policy-pick');await picker.getByLabel('Cafe',{exact:true}).selectOption(site)
   await picker.getByRole('button',{name:'Open policy',exact:true}).click();await page.waitForLoadState('networkidle')
   const editor=page.locator('[data-policy-editor]')
   // Select shipped releases by the actual options, rather than pinning a catalog version.
   await editor.getByLabel('Overtime rule version',{exact:true}).selectOption(await editor.locator('[name=presetVersion] option').last().getAttribute('value'))
   await editor.getByLabel('Meal and rest rule version',{exact:true}).selectOption(await editor.locator('[name=breakVersion] option').last().getAttribute('value'))
   const reason='Reviewed recorded cafe meal windows against the two open employee workweeks'
   await editor.getByLabel('Review reason',{exact:true}).fill(reason)
   await editor.getByLabel('Employer minimum rest (minutes)',{exact:true}).fill('660')
   await shot('policy-settings-config')
   const retained=await h.state()
   await submit(page,editor,'policy.preview')
   assert.equal(await page.locator('.notice.error').count(),0)
   assert.equal((await h.state()).policies.find(p=>p.id===f.old.id).revision,f.old.revision,'preview leaves the policy unchanged')
   assert.equal(await page.locator('[data-policy-workweek]').count(),f.crew.length)
   const change=await page.locator('[data-policy-apply]').evaluate(form=>Object.fromEntries(new FormData(form)))
   const expected=await h.cmd('policy.preview',{...change,revision:Number(change.revision)})
   for(const [i,c]of expected.calculations.entries()){
    const row=page.locator('[data-policy-workweek]').nth(i)
    assert.ok((await row.innerText()).includes(f.crew.find(p=>p.id===c.staffId).name))
    assert.ok((await row.locator('[data-label="Before"]').innerText()).includes(usd(c.before.estimateCents)))
    assert.ok((await row.locator('[data-label="After applying"]').innerText()).includes(usd(c.after.estimateCents)))
    assert.ok(c.before.breakReviews.flatMap(r=>r.issues).length>c.after.breakReviews.flatMap(r=>r.issues).length,'the reviewed meal-window correction is visible in the release calculation')
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await page.locator('#policy-preview').scrollIntoViewIfNeeded();await shot('policy-settings-preview')
   await page.locator('#policy-preview').getByText('Calculation inputs and retained sources',{exact:true}).first().click()
   await shot('policy-settings-sources')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   // A source arriving after review invalidates this exact browser approval.
   await h.cmd('time.prepare',{staffId:f.crew[0].id,site,start:'2026-10-13T08:00:00Z',end:'2026-10-13T10:00:00Z',breakMinutes:0,reason:'Later cafe source awaiting approval'})
   await page.locator('[data-policy-apply] input[type=checkbox]').check()
   await submit(page,page.locator('[data-policy-apply]'),'policy.save')
   assert.equal(await page.locator('.notice.error').count(),1)
   assert.equal((await h.state()).policies.find(p=>p.id===f.old.id).revision,f.old.revision)
   assert.equal(await editor.getByLabel('Review reason',{exact:true}).inputValue(),reason,'refusal retains the entered proposal')
   await submit(page,editor,'policy.preview')
   const digest=await page.locator('[data-policy-apply] input[name=reviewDigest]').inputValue()
   await page.locator('[data-policy-apply] input[type=checkbox]').check()
   await submit(page,page.locator('[data-policy-apply]'),'policy.save')
   assert.equal(await page.locator('.notice.error').count(),0)
   const state=await h.state(),applied=state.policies.find(p=>p.id===f.old.id)
   assert.equal(applied.revision,f.old.revision+1)
   assert.equal(applied.releaseReview.digest,digest)
   assert.equal(applied.reviewReason,reason)
   assert.equal(applied.minimumRestMinutes,660)
   const {versions,...prior}=f.old
   assert.deepEqual(applied.versions[0],prior,'the historical policy source remains intact')
   assert.deepEqual(state.clocks,retained.clocks,'applying policy does not rewrite captures')
   for(const source of retained.timesheets)assert.deepEqual(state.timesheets.find(t=>t.id===source.id),source,'approved minutes and retained rate inputs survive release adoption')
   assert.equal(state.batches.length,0)
   for(const c of applied.releaseReview.calculations){
    const report=await h.cmd('policy.review',{staffId:c.staffId,week:c.week})
    assert.equal(report.estimateCents,c.after.estimateCents)
    assert.deepEqual(report.breakReviews,c.after.breakReviews)
   }
   await page.locator('#policy-current').getByText('Policy revision history',{exact:true}).click()
   await shot('policy-settings-applied')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   // The same Settings door retains a person-specific applicability decision.
   const worker=page.locator('#worker-policy')
   await worker.getByLabel('Review a person',{exact:true}).selectOption(f.crew[0].id)
   await worker.getByRole('button',{name:'Open applicability review',exact:true}).click();await page.waitForLoadState('networkidle')
   const workerEditor=page.locator('[data-worker-editor]')
   await workerEditor.getByLabel('State weekly overtime',{exact:true}).selectOption('reviewed-not-applicable')
   await workerEditor.getByLabel('Legal basis for any rule not applied',{exact:true}).fill('Employer-reviewed state exception; federal weekly overtime remains covered')
   await workerEditor.getByLabel('Employer evidence reference',{exact:true}).fill('synthetic-lanyard-1 retained employer applicability decision')
   await workerEditor.getByLabel('Applicability review reason',{exact:true}).fill('Reviewed this person against each independent rule family')
   await workerEditor.getByRole('button',{name:'Preview applicability',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   await page.locator('[data-worker-apply] input[type=checkbox]').check()
   await page.locator('[data-worker-apply]').getByRole('button',{name:'Apply reviewed applicability',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   const covered=(await h.state()).policies.find(p=>p.id===f.old.id)
   assert.equal(covered.coverage[0].stateWeekly,'reviewed-not-applicable');assert.equal(covered.coverage[0].federalOvertime,'covered')
   applied.revision=covered.revision
   await shot('policy-settings-worker')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   // Locked payroll is still a server-side fence through the native form door.
   const pending=state.timesheets.find(t=>t.status==='submitted');await h.cmd('time.approve',pin(pending))
   let period=f.period
   for(const p of f.crew)period=await h.cmd('period.signoff',pin(period),p.cookie)
   period=await h.cmd('period.signoff',pin(period));await h.cmd('period.lock',pin(period))
   await editor.getByLabel('Review reason',{exact:true}).fill('Review attempted after the payroll period was locked')
   await submit(page,editor,'policy.preview')
   assert.equal(await page.locator('.notice.error').count(),1)
   assert.equal((await h.state()).policies.find(p=>p.id===f.old.id).revision,applied.revision)
   // Current interim restriction protects detailed classified estimates while TEAM-001 remains open.
   const managerSettings=await h.send('/app/settings',undefined,f.manager.cookie)
   assert.equal(managerSettings.status,403)
   assert.ok(!managerSettings.text.includes(reason))
   assert.deepEqual((await h.state(f.manager.cookie)).policies,[])
   // A later employer policy can be reviewed without reaching locked payroll.
   await picker.getByLabel('Policy preset',{exact:true}).selectOption('custom')
   await picker.getByRole('button',{name:'Open policy',exact:true}).click();await page.waitForLoadState('networkidle')
   await editor.getByLabel('Effective from',{exact:true}).fill('2026-10-19')
   await editor.getByLabel('Jurisdiction',{exact:true}).fill('Employer scheduling agreement')
   await editor.getByLabel('Daily overtime after (minutes)',{exact:true}).fill('540')
   await editor.getByLabel('Double time after (minutes)',{exact:true}).fill('780')
   await editor.getByLabel('Weekly overtime after (minutes)',{exact:true}).fill('2400')
   await editor.getByLabel('Review reason',{exact:true}).fill('Employer thresholds for the next open workweek; independently reviewed')
   await submit(page,editor,'policy.preview')
   assert.equal(await page.locator('.notice.error').count(),0)
   await page.locator('[data-policy-apply] input[type=checkbox]').check()
   await submit(page,page.locator('[data-policy-apply]'),'policy.save')
   assert.equal(await page.locator('.notice.error').count(),0)
   const custom=(await h.state()).policies.find(p=>p.id===f.old.id)
   assert.deepEqual([custom.preset,custom.jurisdiction,custom.dailyMinutes,custom.doubleMinutes,custom.weeklyMinutes,custom.breakVersion],['custom','Employer scheduling agreement',540,780,2400,null])
   assert.ok((await page.locator('#policy-current').innerText()).includes('unmaintained'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await shot('policy-settings-custom')

  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days} from './workforce-journey.mjs'
import {browserAssets} from './policy-settings-journey.mjs'
import {alternateExample} from './policy-alternate-journey.mjs'
import {regionalExample} from './policy-regional-journey.mjs'

export async function policyAlternateSettingsBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const preset of ['CA','AK','NV'])for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   await h.cmd('settings.save',{timezone:'UTC'})
   const p=await h.person('MayaRivera'),site='Orchard Street Cafe'
   await h.cmd('staff.save',{...pin(p),name:'Maya Rivera',email:p.email,payrollId:p.payrollId,role:'staff',active:true,site,hourlyRate:preset==='NV'?'17.00':'22.00'})
   const example=preset==='CA'?alternateExample([p.id]):regionalExample(preset,[p.id])
   const original=await h.cmd('policy.save',{site,preset,from:example.effectiveFrom,reviewReason:'Reviewed ordinary covered overtime before schedule adoption'})
   for(let day=0;day<4;day++){
    const on=days('2026-10-12',day),t=await h.cmd('time.prepare',{staffId:p.id,site,start:on+'T08:00:00Z',end:on+'T18:00:00Z',breakMinutes:0,reason:'Recorded elected or agreed workweek for review'})
    await h.cmd('time.approve',pin(t))
   }
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await browserAssets(context)
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage(),response=await page.goto(h.origin+'/app/settings?'+new URLSearchParams({site,preset}),{waitUntil:'networkidle'})
   assert.equal(response.status(),200,await page.locator('body').innerText())
   const panel=page.locator('#policy-alternate');await panel.getByText('Review an elected or agreed schedule',{exact:true}).click()
   const editor=page.locator('[data-alternate-editor]'),fill=(name,value)=>editor.locator(`[name=${name}]`).fill(String(value))
   await fill('altWorkUnit','Orchard Street service team')
   await editor.locator(`[name=altStaffIds][value="${p.id}"]`).check()
   for(const day of example.days){await editor.locator(`[name=altDays][value="${day.day}"]`).check();await fill('altMinutes'+day.day,day.minutes)}
   await fill('altEffectiveFrom',example.effectiveFrom);await fill('altReviewer',example.reviewer);await fill('altReviewedOn',example.reviewedOn)
   const fields=preset==='CA'?['electionOn','announcedOn','electionEvidence','implementationEvidence']:preset==='AK'?['approvalOn','approvalEvidence','participationOn','participationEvidence']:['agreementOn','agreementEvidence']
   for(const key of fields)await fill('alt'+key[0].toUpperCase()+key.slice(1),example[key])
   if(preset==='AK')await editor.locator('[name=altOrdinaryScheduleOffered]').check()
   await editor.locator('[name=altAttested]').check();await fill('reviewReason','Reviewed the employer evidence and each employee’s complete open workweek')
   const shot=async label=>{if(process.env.POLICY_SCREENS){await mkdir(process.env.POLICY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_SCREENS,`${label}-${preset}-${width}.png`)})}}
   await editor.scrollIntoViewIfNeeded();await shot('policy-alternate-config')
   await editor.getByRole('button',{name:'Preview workweek changes',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0,await page.locator('body').innerText())
   assert.equal((await h.state()).policies.find(r=>r.id===original.id).revision,original.revision)
   const preview=page.locator('#policy-preview');assert.equal(await preview.locator('[data-policy-workweek]').count(),1)
   const apply=page.locator('[data-policy-apply]'),payload=await apply.evaluate(form=>Object.fromEntries(new FormData(form)))
   const input={...payload,revision:Number(payload.revision),alternate:JSON.parse(payload.reviewedAlternate)};delete input.reviewedAlternate
   const review=await h.cmd('policy.preview',input)
   assert.deepEqual([review.calculations[0].before.overtimeMinutes,review.calculations[0].after.overtimeMinutes],[480,0])
   await preview.scrollIntoViewIfNeeded();await shot('policy-alternate-preview')
   await apply.locator('input[type=checkbox]').check();await apply.getByRole('button',{name:'Apply reviewed policy',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0,await page.locator('body').innerText())
   const saved=(await h.state()).policies.find(r=>r.id===original.id)
   assert.deepEqual(saved.alternate.staffIds,[p.id]);assert.equal(saved.alternate.kind,example.kind)
   assert.equal((await h.cmd('policy.review',{staffId:p.id,week:'2026-10-12'})).overtimeMinutes,0)
   await page.locator('#policy-alternate').scrollIntoViewIfNeeded();await shot('policy-alternate-applied')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(preset==='CA'){
    const daily=page.locator('[data-policy-editor]');await daily.getByLabel('Employer workday begins',{exact:true}).fill('04:00');await daily.getByLabel('Review reason',{exact:true}).fill('Reviewed the fixed 04:00 employer workday against the elected schedule')
    await daily.scrollIntoViewIfNeeded();await shot('policy-workday-config')
    await daily.getByRole('button',{name:'Preview policy changes',exact:true}).click();await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('.notice.error').count(),0);await page.locator('#policy-preview').scrollIntoViewIfNeeded();await shot('policy-workday-preview')
    await page.locator('[data-policy-apply] input[type=checkbox]').check();await page.locator('[data-policy-apply]').getByRole('button',{name:'Apply reviewed policy',exact:true}).click();await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('.notice.error').count(),0);assert.equal((await h.state()).policies.find(r=>r.id===original.id).workdayStart,'04:00')
    await daily.scrollIntoViewIfNeeded();await shot('policy-workday-applied');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   }
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {acaPeople,acaTrending} from './aca-fixture.mjs'

export async function acaJourney() {
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {
  const people=await acaPeople(h),{plan,week,shift}=await acaTrending(h,people)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  for(const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:1000}})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname
    if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async(key,selector='#aca')=>{if(process.env.ACA_SCREENS){await mkdir(process.env.ACA_SCREENS,{recursive:true});await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.ACA_SCREENS,`${key}-${width}.png`)});await page.locator(selector).screenshot({path:join(process.env.ACA_SCREENS,`${key}-section-${width}.png`)})}}
   const submit=async form=>{const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name=')),form.getByRole('button',{exact:true,name:/Save/}).click()]);assert.equal(response.status(),200);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0)}
   await page.goto(h.origin+'/app/payroll#aca',{waitUntil:'networkidle'})
   assert.ok((await page.locator('#aca').innerText()).includes('Current variable-hour review'))
   assert.ok((await page.locator('#aca').innerText()).includes('Ben'))
   assert.ok((await page.locator('#aca').innerText()).includes('Pending measurement'))
   await shot('report')
   const evidence=page.locator('#aca details').filter({has:page.locator('summary').filter({hasText:'Ben · monthly hours and sources'})}).first()
   await evidence.locator('summary').first().click();await evidence.locator('li').first().waitFor({state:'visible'});assert.ok((await evidence.innerText()).includes('employer-recorded'))
   await shot('sources');await evidence.locator('summary').first().click()
   await page.getByText('Define a measurement plan',{exact:true}).click()
   const planForm=page.locator('form[action*="name=aca.plan.save"]'),year=new Date().getUTCFullYear()+1
   await planForm.locator('[name=name]').fill(`Next annual group ${width}`)
   for(const [field,value] of Object.entries({start:`${year}-01-01`,end:`${year}-12-31`,adminEnd:`${year+1}-01-30`,stabilityEnd:`${year+2}-01-30`}))await planForm.locator(`[name=${field}]`).fill(value)
   await planForm.locator(`[name=staffIds][value="${people.ben.id}"]`).check()
   await shot('plan-form');await submit(planForm)
   assert.ok((await h.state()).acaPlans.some(p=>p.name===`Next annual group ${width}`),'plan persisted through the real form')
   await page.getByText('Employer-recorded paid leave',{exact:true}).click();await page.getByText('Add a paid leave credit',{exact:true}).click()
   const creditForm=page.locator('form[action*="name=aca.credit.save"]').filter({hasNot:page.locator('[name=id]')})
   await creditForm.locator('[name=staffId]').selectOption(people.alex.id)
   const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10)
   await creditForm.locator('[name=date]').fill(yesterday);await creditForm.locator('[name=minutes]').fill('240');await creditForm.locator('[name=category]').selectOption('vacation');await creditForm.locator('[name=reference]').fill(`paid-vacation-${width}`);await creditForm.locator('[name=reason]').fill('Employer-approved partial vacation day')
   await shot('credit-form');await submit(creditForm)
   assert.ok((await h.state()).acaCredits.some(c=>c.reference===`paid-vacation-${width}`&&c.minutes===240))
   await shot('saved-report')
   const download=page.locator(`a[href="/api/lanyard/aca/${plan.id}.csv"]`)
   const [file]=await Promise.all([page.waitForEvent('download'),download.click()]);assert.match(file.suggestedFilename(),/^lanyard-aca-/)
   await page.goto(h.origin+`/app/schedule?week=${week}&site=Ocean%20Beach`,{waitUntil:'networkidle'})
   assert.ok((await page.locator('#aca-warnings').innerText()).includes('Ben'));await shot('schedule','#aca-warnings')
   // The unsaved draft replaces this week's published shift, rather than doubling it.
   const response=await h.send('/api/lanyard/schedule/review',{week,shifts:[{...shift,end:new Date(Date.parse(shift.start)+2*3600000).toISOString()}]},h.owner)
   assert.equal(response.status,200);assert.ok(!response.value.warnings.some(w=>w.kind==='aca'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'ACA-001 screens fit the viewport')
   assert.deepEqual(errors,[]);await context.close()
  }
 } finally {await browser.close();await h.close()}
}

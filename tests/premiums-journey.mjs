import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {premiumFixture,pin,local} from './premiums-fixture.mjs'
export async function premiumBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try {
   const f=await premiumFixture(h),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key} fits ${width}px`);if(process.env.PREMIUM_SCREENS){await mkdir(process.env.PREMIUM_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.PREMIUM_SCREENS,`${key}-${width}.png`),fullPage:false})}}
   const submit=async(form,command,button)=>{await Promise.all([page.waitForResponse(r=>r.url().includes(`name=${command}`)),form.getByRole('button',{name:button,exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,await page.locator('.notice.error').allTextContents())}
   await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   let card=page.locator('#premiums');await card.getByText('Premium rules',{exact:true}).click();await card.getByText('Configure premium rule',{exact:true}).click()
   const rule=card.locator('form[action*="name=premiumrule.save"]');await rule.getByLabel('Cafe',{exact:true}).fill('California');await rule.getByLabel('Rule effective from').fill('2026-01-01');await rule.getByLabel('Jurisdiction preset').selectOption('CA');await rule.getByLabel('Applicable minimum wage (USD cents/hour)').fill('1800');await submit(rule,'premiumrule.save','Save premium rule')
   await card.getByText('Premium rules',{exact:true}).click();await card.scrollIntoViewIfNeeded();await shot('premium-rules')
   await card.getByText('Prepare a premium input',{exact:true}).click();const prep=card.locator('form[action*="name=premium.prepare"]').first()
   await prep.getByLabel('Approved timesheet',{exact:true}).selectOption(f.at.id);await prep.getByLabel('Reported scheduled shift',{exact:true}).selectOption(f.shiftOf(f.alex).id);await prep.getByLabel('Premium kind').selectOption('reporting');await prep.getByLabel('Facts and source reference').fill('Supervisor sent Alex home after one hour of an eight-hour shift');await submit(prep,'premium.prepare','Prepare premium input')
   let r=(await h.state()).premiuminputs.find(x=>x.timeId===f.at.id)
   await as(f.manager.cookie);await page.reload({waitUntil:'networkidle'})
   let item=page.locator(`[data-premium-input="${r.id}"]`);await item.getByText('Triggering facts and retained work areas',{exact:true}).click();await item.scrollIntoViewIfNeeded();await shot('premium-facts')
   await item.getByLabel('Review decision').selectOption('dispute');await item.getByLabel('Decision reason').fill('Confirm that leaving early was employer directed');await submit(item.locator('form'),'premium.decide','Record premium decision')
   item=page.locator(`[data-premium-input="${r.id}"]`);assert.ok((await item.innerText()).includes('disputed'));await item.scrollIntoViewIfNeeded();await shot('premium-disputed')
   await item.getByLabel('Review decision').selectOption('approve');await item.getByLabel('Decision reason').fill('Supervisor confirmed employer-directed early finish');await submit(item.locator('form'),'premium.decide','Record premium decision')
   await as(h.owner);await page.reload({waitUntil:'networkidle'});card=page.locator('#premiums')
   await card.getByText('Record after-arrival cancellation',{exact:true}).click();const arrival=card.locator('form[action*="name=premium.prepare"]').last();await arrival.getByLabel('Canceled scheduled shift').selectOption(f.shiftOf(f.dana).id);await arrival.getByLabel('Reported at',{exact:true}).fill('2025-11-20T09:00');await arrival.getByLabel('Canceled after arrival at').fill('2025-11-20T09:05');await arrival.getByLabel('NY: this is a fixed repeating regularly scheduled shift').check();await arrival.getByLabel('Facts and source reference').fill('Service canceled after Dana arrived');await submit(arrival,'premium.prepare','Prepare arrival input')
   const input=(await h.state()).premiuminputs.find(x=>!x.timeId);await f.approve(input)
   await f.approve(await f.prepare(f.bt,'split',{employerSplit:true}));await f.approve(await f.prepare(f.ct,'spread'))
   await page.reload({waitUntil:'networkidle'});await submit(page.locator('form[data-payroll-form]'),'payroll.prepare','Prepare batch')
   let batch=page.locator('.batch').first();await batch.getByRole('checkbox').check();await submit(batch.locator('form[action*="name=payroll.export"]'),'payroll.export','Export reviewed CSV');batch=page.locator('.batch').first();assert.ok((await batch.innerText()).includes('$66.00'));assert.equal(await batch.getByRole('link',{name:'Download exported CSV'}).count(),1);await batch.scrollIntoViewIfNeeded();await shot('premium-exported')
   const corrected=await f.enter({...f.a,end:local('2025-11-17','11:00')},{corrects:f.at.id});await f.approve(await f.prepare(corrected,'reporting',{shiftId:f.shiftOf(f.alex).id}));const delta=await h.cmd('payroll.prepare',{});assert.equal(delta.lines.filter(x=>x.premiumLine).reduce((n,x)=>n+x.costCents,0),-2000);await h.cmd('payroll.export',pin(delta));await page.reload({waitUntil:'networkidle'});await page.locator('.batch').first().scrollIntoViewIfNeeded();await shot('premium-correction')
   await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2025-11-17',{waitUntil:'networkidle'});const earnings=page.locator('#earnings');assert.ok((await earnings.innerText()).includes('$46.00'));await earnings.scrollIntoViewIfNeeded();await shot('premium-earnings')
   await as(h.owner);await page.goto(h.origin+'/app/agent',{waitUntil:'networkidle'});await page.getByText('Human command reference',{exact:true}).click();await page.getByText('premium.prepare',{exact:true}).scrollIntoViewIfNeeded();await shot('premium-command-reference');assert.deepEqual(errors,[])
  } finally {await context.close();await h.close()}
 }} finally {await browser.close()}
}

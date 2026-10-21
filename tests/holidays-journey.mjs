import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {holidayFixture,pin} from './holidays-fixture.mjs'
export async function holidayBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try {
   const f=await holidayFixture(h),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key} fits ${width}px`);if(process.env.HOLIDAY_SCREENS){await mkdir(process.env.HOLIDAY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.HOLIDAY_SCREENS,`${key}-${width}.png`),fullPage:false})}}
   const submit=async(form,command,button)=>{await Promise.all([page.waitForResponse(r=>r.url().includes(`name=${command}`)),form.getByRole('button',{name:button,exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0)}
   await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   const card=page.locator('#holidays');await card.getByText('Holiday calendar',{exact:true}).click();await card.getByText('Add a company holiday',{exact:true}).click()
   const company=card.locator('form[action*="name=holiday.save"]').last()
   await company.getByLabel('Cafe',{exact:true}).fill('Ocean Beach');await company.getByLabel('Holiday date',{exact:true}).fill('2025-12-15');await company.getByLabel('Holiday name',{exact:true}).fill('Winter staff day');await submit(company,'holiday.save','Save holiday')
   await card.getByText('Holiday calendar',{exact:true}).click();assert.ok((await card.innerText()).includes('Winter staff day'))
   await card.getByText('Holiday pay rules',{exact:true}).click();await card.getByText('Add a holiday pay rule',{exact:true}).click()
   const rule=card.locator('form[action*="name=holidayrule.save"]').last()
   await rule.getByLabel('Cafe',{exact:true}).fill('Ocean Beach');await rule.getByLabel('Effective from').fill('2026-01-01');await rule.getByLabel('Worked holiday premium',{exact:true}).selectOption('added');await rule.getByLabel('Value: raw multiplier (at least 1) or added cents/hour (at least 0)').fill('250');await rule.getByLabel('Paid non-work minutes').fill('480');await rule.getByLabel('Holiday payroll code').fill('HOL-2026');await submit(rule,'holidayrule.save','Save holiday rule')
   await card.getByText('Holiday pay rules',{exact:true}).click();assert.ok((await card.innerText()).includes('$2.50/hour added'));await card.scrollIntoViewIfNeeded();await shot('holiday-setup')
   await card.getByText('Eligibility · 2025-11-27',{exact:true}).click()
   const cy=card.locator('tr:visible').filter({has:page.getByText('Cy',{exact:true})}),ben=card.locator('tr:visible').filter({has:page.getByText('Ben',{exact:true})}).filter({hasText:'· Worked'})
   assert.ok((await ben.innerText()).includes('Ineligible'));assert.ok((await ben.innerText()).includes('2025-11-28'))
   await cy.getByLabel('Source record reference').fill('cy-holiday-browser');await submit(cy.locator('form'),'holidaypay.approve','Approve non-work holiday pay')
   await card.getByText('Approved non-work holiday pay',{exact:true}).click();assert.ok((await card.innerText()).includes('$160.00'));await card.scrollIntoViewIfNeeded();await shot('holiday-eligibility')
   const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(batch));await page.reload({waitUntil:'networkidle'})
   const ledger=page.locator('.batch').first();assert.ok((await ledger.innerText()).includes('Front counter'));assert.ok((await ledger.innerText()).includes('$48.00'));assert.ok((await ledger.innerText()).includes('non-work holiday pay'));await ledger.scrollIntoViewIfNeeded();await shot('holiday-export')
   await card.getByText('Approved non-work holiday pay',{exact:true}).click();await card.getByText('Correct non-work pay',{exact:true}).click()
   const correction=card.locator('form[action*="name=holidaypay.correct"]');await correction.getByLabel('Correct paid minutes (zero reverses)').fill('0');await correction.getByLabel('Correction reason',{exact:true}).fill('Employer reviewed cancellation of non-work holiday pay');await submit(correction,'holidaypay.correct','Approve correction')
   const reversal=await h.cmd('payroll.prepare',{});assert.deepEqual(reversal.lines.map(l=>l.minutes),[-480]);await h.cmd('payroll.export',pin(reversal));await page.reload({waitUntil:'networkidle'});await page.locator('.batch').first().scrollIntoViewIfNeeded();await shot('holiday-reversal')
   await page.goto(h.origin+'/app/schedule?week=2025-12-01&site=Ocean%20Beach',{waitUntil:'networkidle'});assert.ok((await page.locator('#holiday-schedule').innerText()).includes('Company service day'));await page.locator('#holiday-schedule').scrollIntoViewIfNeeded();await shot('holiday-schedule')
   await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2025-11-24',{waitUntil:'networkidle'});const earnings=page.locator('#earnings');assert.ok((await earnings.innerText()).includes('Holiday premium (approved)'));assert.ok((await earnings.innerText()).includes('$88.00'));assert.ok((await earnings.innerText()).includes('$568.00'));await earnings.scrollIntoViewIfNeeded();await shot('holiday-earnings');assert.deepEqual(errors,[])
  } finally {await context.close();await h.close()}
 }} finally {await browser.close()}
}

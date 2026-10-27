import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {chromium} from '@playwright/test'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
const pin=r=>({id:r.id,revision:r.revision})

export async function organizationApi(h){
 const alex=await h.person('synthetic-lanyard-1'),manager=await h.person('synthetic-lanyard-2','manager')
 let business=await h.cmd('organization.business.save',{name:'Service group'})
 const location=await h.cmd('organization.location.save',{name:'Ocean Beach',site:'Ocean Beach',timezone:'America/Los_Angeles',businessId:business.id})
 const other=await h.cmd('organization.location.save',{name:'Mission',site:'Mission',timezone:'America/Chicago',businessId:business.id})
 const department=await h.cmd('organization.department.save',{name:'Counter',locationId:location.id})
 const before=await h.state()
 for(const cookie of [alex.cookie,manager.cookie]){
  await h.cmd('organization.business.save',{name:'Unauthorized group'},cookie,403)
  const view=await h.state(cookie)
  for(const key of ['businesses','locations','departments','orgmemberships'])assert.deepEqual(view[key],[])
 }
 assert.equal((await h.state()).version,before.version,'refused organization changes write nothing')
 await h.cmd('organization.location.save',{name:'Duplicate',site:'Mission',timezone:'UTC',businessId:business.id},h.owner,409)
 await h.cmd('organization.department.save',{name:'Missing location',locationId:'synthetic-lanyard-3'},h.owner,404)
 await h.cmd('organization.member.save',{staffId:alex.id,locationIds:[other.id],departmentIds:[department.id]},h.owner,400)
 let member=await h.cmd('organization.member.save',{staffId:alex.id,locationIds:[location.id,other.id],departmentIds:[department.id]})
 assert.deepEqual(member.locationIds,[location.id,other.id]);assert.deepEqual(member.departmentIds,[department.id])
 await h.cmd('organization.member.save',{...pin(member),staffId:alex.id,locationIds:[location.id,location.id],departmentIds:[]},h.owner,400)
 await h.cmd('organization.member.save',{...pin(member),staffId:alex.id,locationIds:[],departmentIds:[]},h.owner,400)
 business=await h.cmd('organization.business.save',{...pin(business),name:'Renamed service group'})
 assert.equal(business.versions[0].name,'Service group')
 await h.cmd('organization.business.save',{id:business.id,revision:1,name:'Stale group'},h.owner,409)
 await h.cmd('organization.location.save',{...pin(location),name:location.name,site:'Moved',timezone:location.timezone,businessId:business.id},h.owner,409)
 const week='2026-11-02',row={staffId:alex.id,start:week+'T17:00:00Z',end:week+'T20:00:00Z',breakMinutes:0,site:'Mission'}
 await h.cmd('availability.save',{staffId:alex.id,start:week+'T00:00:00Z',end:'2026-11-09T00:00:00Z'})
 let draft=await h.cmd('roster.prepare',{week,shifts:[row]});assert.deepEqual(draft.conflicts,[])
 await h.cmd('roster.publish',pin(draft))
 member=await h.cmd('organization.member.save',{...pin(member),staffId:alex.id,locationIds:[location.id],departmentIds:[department.id]})
 assert.deepEqual(member.versions[0].locationIds,[location.id,other.id])
 draft=await h.cmd('roster.prepare',{week,shifts:[row]})
 assert.deepEqual(draft.conflicts.map(x=>x.reason),['Not eligible at this organization location'])
 await h.cmd('roster.publish',pin(draft),h.owner,409)
 const allowed=await h.cmd('roster.prepare',{week,shifts:[{...row,site:'Ocean Beach'}]})
 assert.deepEqual(allowed.conflicts,[]);await h.cmd('roster.publish',pin(allowed))
 await h.restart()
 const saved=await h.state()
 assert.deepEqual(saved.locations.map(l=>l.site).sort(),['Mission','Ocean Beach'])
 assert.deepEqual(saved.orgmemberships[0].locationIds,[location.id])
 assert.equal(saved.businesses[0].name,'Renamed service group')
 assert.ok(saved.events.some(e=>e.action==='organization.member.save'&&e.actorRole==='owner'))
 const key=await h.cmd('agent.create',{label:'Organization exclusion'})
 const context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})
 for(const kind of ['businesses','locations','departments','orgmemberships'])assert.deepEqual(context.value[kind],[])
 await h.cmd('organization.member.save',{staffId:manager.id,locationIds:[other.id],departmentIds:[]},manager.cookie,403)
}

export async function organizationBrowser(){
 const h=await harness({secure:true}),browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  const alex=await h.person('synthetic-lanyard-1')
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
  const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin,secure:true}])
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(h.origin+'/app/settings')
  const org=page.locator('section').filter({has:page.getByRole('heading',{name:'Organization',exact:true})})
  const open=async label=>{const detail=org.locator('details').filter({has:page.locator('summary').filter({hasText:new RegExp('^'+label+'$')})}).first();await detail.locator('summary').first().click();return detail}
  await open('Businesses');const business=org.locator('form[action*="name=organization.business.save"]');await business.locator('[name=name]').fill('Service group');await business.getByRole('button',{name:'Create business'}).click()
  await open('Locations');let location=org.locator('form[action*="name=organization.location.save"]');await location.locator('[name=name]').fill('Ocean Beach');await location.locator('[name=site]').fill('Ocean Beach');await location.locator('[name=businessId]').selectOption({label:'Service group'});await location.getByRole('button',{name:'Create location'}).click()
  await open('Locations');location=org.locator('form[action*="name=organization.location.save"]').filter({has:page.getByRole('button',{name:'Create location'})});await location.locator('[name=name]').fill('Mission');await location.locator('[name=site]').fill('Mission');await location.locator('[name=businessId]').selectOption({label:'Service group'});await location.getByRole('button',{name:'Create location'}).click()
  await open('Departments');const department=org.locator('form[action*="name=organization.department.save"]');await department.locator('[name=name]').fill('Counter');await department.locator('[name=locationId]').selectOption({label:'Ocean Beach'});await department.getByRole('button',{name:'Create department'}).click()
  await open('Employee locations');const member=org.locator('form[action*="name=organization.member.save"]');await member.locator('[name=staffId]').selectOption(alex.id);for(const checkbox of await member.locator('[name=locationIds]').all())await checkbox.check();await member.locator('[name=departmentIds]').check();await member.getByRole('button',{name:'Assign locations'}).click()
  const state=await h.state();assert.equal(state.locations.length,2);assert.deepEqual(state.orgmemberships[0].locationIds.slice().sort(),state.locations.map(l=>l.id).sort());assert.deepEqual(state.orgmemberships[0].departmentIds,[state.departments[0].id])
  const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();await page.locator('h1').click()
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   await org.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true))
   if(width===1440){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[])}
   if(process.env.ORGANIZATION_SCREENS){await mkdir(process.env.ORGANIZATION_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.ORGANIZATION_SCREENS,`organization-${width}.png`),fullPage:true})}
  }
  await context.close()
 }finally{await browser.close();await h.close()}
}

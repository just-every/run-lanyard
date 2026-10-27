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
 const h=await harness({secure:true});let browser
 try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
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
  await page.setViewportSize({width:1440,height:1000});await page.goto(h.origin+'/app/access')
  const businessLevel=page.locator('form[action*="name=access.level.save"]').filter({has:page.getByRole('button',{name:'Create business level',exact:true})})
  await businessLevel.locator('[name=name]').fill('Business scheduler');await businessLevel.locator('[name=permissions][value="draft.view"]').check();await businessLevel.locator('[name=permissions][value="draft.edit"]').check();await businessLevel.getByRole('button',{name:'Create business level',exact:true}).click()
  const defaults=page.locator('form[action*="name=access.defaults.create"]');await defaults.locator('[name=site]').fill('Ocean Beach');await defaults.getByRole('button',{name:'Create role defaults',exact:true}).click()
  const scope=(await h.send('/api/lanyard/access',undefined,h.owner)).value.levels.find(l=>l.name==='Business scheduler')
  const assign=page.locator('form[action*="name=access.grant"]')
  for(const site of ['Ocean Beach','Mission']){await assign.locator('[name=levelId]').selectOption(scope.id);await assign.locator('[name=staffId]').selectOption(alex.id);await assign.locator('[name=site]').fill(site);await assign.getByRole('button',{name:'Assign level',exact:true}).click()}
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(process.env.ORGANIZATION_SCREENS)await page.screenshot({path:join(process.env.ORGANIZATION_SCREENS,`organization-access-${width}.png`),fullPage:true})}
  await context.clearCookies();const [staffName,...staffValue]=alex.cookie.split('=');await context.addCookies([{name:staffName,value:staffValue.join('='),url:h.origin,secure:true}]);await page.setViewportSize({width:1440,height:1000});await page.goto(h.origin+'/app/access')
  const draft=page.locator('form[action*="name=roster.prepare"]').filter({has:page.getByRole('button',{name:'Prepare draft',exact:true})})
  await draft.locator('[name=week]').fill('2026-11-02');await draft.locator('[name=draftStaff]').selectOption(alex.id);await draft.locator('[name=draftSite]').selectOption('Mission');await draft.locator('[name=draftStart]').fill('2026-11-02T09:00');await draft.locator('[name=draftEnd]').fill('2026-11-02T12:00');await draft.getByRole('button',{name:'Prepare draft',exact:true}).click()
  const scoped=(await h.send('/api/lanyard/access',undefined,alex.cookie)).value
  assert.deepEqual(scoped.drafts.map(r=>r.shifts[0].site),['Mission']);assert.equal('rateBasis' in scoped.drafts[0].shifts[0],false)
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(width===1440)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.ORGANIZATION_SCREENS)await page.screenshot({path:join(process.env.ORGANIZATION_SCREENS,`organization-delegated-${width}.png`),fullPage:true})}
  const reviewer=await h.person('synthetic-lanyard-2'),payroller=await h.person('synthetic-lanyard-3'),analyst=await h.person('synthetic-lanyard-4')
  for(const person of [reviewer,payroller,analyst])await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site:'Ocean Beach'})
  const roleLevels=(await h.send('/api/lanyard/access',undefined,h.owner)).value.levels
  for(const [person,role,permissions] of [[reviewer,'Time approver',['time.approve']],[payroller,'Payroll administrator',['payroll.export','wages.view']],[analyst,'Read-only analyst',['reports.view']]]){
   const level=roleLevels.find(l=>l.defaultRole===role)
   await h.cmd('access.level.save',{...pin(level),name:level.name,site:level.site,permissions})
   await h.cmd('access.grant',{levelId:level.id,staffId:person.id,site:'Ocean Beach'})
  }
  const sign=async person=>{await context.clearCookies();const [name,...value]=person.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin,secure:true}]);await page.setViewportSize({width:1440,height:1000});await page.goto(h.origin+'/app/access')}
  const screens=async label=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(width===1440)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.ORGANIZATION_SCREENS)await page.screenshot({path:join(process.env.ORGANIZATION_SCREENS,`${label}-${width}.png`),fullPage:true})}}
  const sheet=await h.cmd('time.prepare',{staffId:alex.id,start:'2026-10-12T09:00:00Z',end:'2026-10-12T12:00:00Z',breakMinutes:0,reason:'Recorded missed clock',site:'Ocean Beach'})
  await sign(reviewer);await screens('organization-approver');await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Approve time',exact:true}).click();assert.equal((await h.state()).timesheets.find(t=>t.id===sheet.id).status,'approved')
  await sign(payroller);await page.getByRole('button',{name:'Prepare payroll',exact:true}).click();const exportForm=page.locator('form[action*="name=payroll.export"]');await exportForm.locator('input[type=checkbox]').check();await exportForm.getByRole('button',{name:'Export payroll',exact:true}).click()
  const file=await context.request.get(h.origin+await page.getByRole('link',{name:'Download payroll',exact:true}).getAttribute('href'));assert.equal(file.status(),200);assert.ok((await file.text()).includes(alex.payrollId));await screens('organization-payroll')
  await sign(analyst);await page.locator('input[name=date]').fill('2026-10-12');await page.getByRole('button',{name:'Open interval report',exact:true}).click();assert.deepEqual(await page.locator('td[data-label="Actual hours"]').allTextContents(),['1.00','1.00','1.00']);assert.equal(await page.locator('td[data-label="Actual labor %"]').first().innerText(),'—');await screens('organization-report')
  assert.deepEqual(errors,[])
  await context.close()
 }finally{await browser?.close();await h.close()}
}

export async function organizationAccessApi(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const worker=await h.person('synthetic-lanyard-1'),other=await h.person('synthetic-lanyard-2'),scheduler=await h.person('synthetic-lanyard-3'),approver=await h.person('synthetic-lanyard-4'),payroll=await h.person('synthetic-lanyard-5')
 for(const person of [worker,other,scheduler,approver,payroll])await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site:'Ocean Beach',hourlyRate:'20.00'})
 const business=await h.cmd('organization.business.save',{name:'Service group'}),foreign=await h.cmd('organization.business.save',{name:'Foreign group'})
 const ocean=await h.cmd('organization.location.save',{name:'Ocean Beach',site:'Ocean Beach',timezone:'UTC',businessId:business.id}),mission=await h.cmd('organization.location.save',{name:'Mission',site:'Mission',timezone:'UTC',businessId:business.id})
 await h.cmd('organization.location.save',{name:'Foreign',site:'Foreign',timezone:'UTC',businessId:foreign.id})
 const department=await h.cmd('organization.department.save',{name:'Counter',locationId:ocean.id})
 await h.cmd('organization.member.save',{staffId:worker.id,locationIds:[ocean.id,mission.id],departmentIds:[department.id]})
 const defaults=await h.cmd('access.defaults.create',{site:'Ocean Beach'})
 const level=role=>defaults.find(l=>l.defaultRole===role)
 const schedule=level('Scheduler'),time=level('Time approver'),pay=level('Payroll administrator')
 const grant=await h.cmd('access.grant',{levelId:schedule.id,staffId:scheduler.id,site:'Ocean Beach'})
 const week='2026-11-02',shift={staffId:worker.id,start:week+'T09:00:00Z',end:week+'T12:00:00Z',breakMinutes:0,site:'Ocean Beach'}
 const refusal=async(name,input,cookie)=>{const before=await h.state();await h.cmd(name,input,cookie,403);assert.equal((await h.state()).version,before.version)}
 await refusal('roster.prepare',{week,shifts:[shift]},scheduler.cookie)
 let scheduleLevel=await h.cmd('access.level.save',{...pin(schedule),name:schedule.name,site:schedule.site,permissions:['draft.view','draft.edit']})
 let draft=await h.cmd('roster.prepare',{week,shifts:[shift]},scheduler.cookie)
 assert.equal(draft.status,'draft');assert.equal('rateBasis' in draft.shifts[0],false)
 await refusal('roster.publish',pin(draft),scheduler.cookie)
 await refusal('access.defaults.create',{site:'Mission'},scheduler.cookie)
 await refusal('roster.prepare',{week,shifts:[{...shift,site:'Mission'}]},scheduler.cookie)
 const broad=await h.cmd('access.level.save',{name:'Business scheduler',businessId:business.id,site:'',permissions:['draft.view','draft.edit']})
 const foreignGrant=await h.cmd('access.grant',{levelId:broad.id,staffId:scheduler.id,site:'Mission'})
 await h.cmd('access.grant',{levelId:broad.id,staffId:scheduler.id,site:'Foreign'},h.owner,403)
 draft=await h.cmd('roster.prepare',{week,shifts:[{...shift,site:'Mission'}]},scheduler.cookie)
 assert.equal(draft.shifts[0].site,'Mission')
 const read=await h.send('/api/lanyard/access',undefined,scheduler.cookie)
 assert.equal(read.status,200);assert.deepEqual(read.value.drafts.map(r=>r.shifts[0].site),['Mission']);assert.deepEqual(read.value.draftSites.sort(),['Mission','Ocean Beach'])
 await h.cmd('access.revoke',pin(foreignGrant))
 await refusal('roster.prepare',{week,shifts:[{...shift,site:'Mission'}]},scheduler.cookie)
 await h.cmd('roster.prepare',{week,shifts:[shift]})
 const scoped=await h.cmd('access.level.save',{name:'Department scheduler',departmentId:department.id,site:'',permissions:['draft.view','draft.edit']})
 const departmentGrant=await h.cmd('access.grant',{levelId:scoped.id,staffId:other.id,site:'Ocean Beach'})
 const nativeManager=await h.person('synthetic-lanyard-7','manager')
 await h.cmd('staff.save',{...pin(nativeManager),name:nativeManager.name,email:nativeManager.email,payrollId:nativeManager.payrollId,role:'manager',active:true,site:'Ocean Beach'})
 const businessGrant=await h.cmd('access.grant',{levelId:broad.id,staffId:worker.id,site:'Ocean Beach'})
 for(const organizationLevel of [broad,scoped]){
  await refusal('access.level.save',{...pin(organizationLevel),name:organizationLevel.name,site:organizationLevel.site,businessId:organizationLevel.businessId,departmentId:organizationLevel.departmentId,permissions:[]},nativeManager.cookie)
  await refusal('access.grant',{levelId:organizationLevel.id,staffId:payroll.id,site:'Ocean Beach'},nativeManager.cookie)
 }
 const beforeRevoke=await h.state(),beforeAccess=(await h.send('/api/lanyard/access',undefined,h.owner)).value
 const revokeResults=[]
 for(const assignment of [businessGrant,departmentGrant]){
  const response=await h.send('/api/lanyard/command',{name:'access.revoke',input:pin(assignment)},nativeManager.cookie)
  revokeResults.push(response.status)
 }
 assert.deepEqual(revokeResults,[403,403],'native managers cannot revoke business or department grants')
 const afterRevoke=await h.state()
 assert.equal(afterRevoke.version,beforeRevoke.version,'refused revocations preserve persisted state')
 assert.deepEqual(afterRevoke.events,beforeRevoke.events,'refused revocations preserve audit')
 assert.deepEqual((await h.send('/api/lanyard/access',undefined,h.owner)).value,beforeAccess,'refused revocations preserve assignments and permission history')
 const revokedBusiness=await h.cmd('access.revoke',pin(businessGrant))
 assert.equal(revokedBusiness.revoked,true);assert.deepEqual(revokedBusiness.changes.at(-1).before,['draft.view','draft.edit']);assert.deepEqual(revokedBusiness.changes.at(-1).after,[])
 await h.cmd('roster.prepare',{week,shifts:[shift]},other.cookie)
 await refusal('roster.prepare',{week,shifts:[{...shift,staffId:scheduler.id}]},other.cookie)
 const contactManager=await h.person('synthetic-lanyard-6','manager')
 await h.cmd('staff.save',{...pin(contactManager),name:contactManager.name,email:contactManager.email,payrollId:contactManager.payrollId,role:'manager',active:true,site:'Ocean Beach'})
 const contactLevel=await h.cmd('access.level.save',{name:'Department contacts',departmentId:department.id,site:'',permissions:['contacts.view']})
 await h.cmd('access.grant',{levelId:contactLevel.id,staffId:contactManager.id,site:'Ocean Beach'})
 assert.equal((await h.send('/api/lanyard/contacts/'+worker.id,undefined,contactManager.cookie)).status,200)
 assert.equal((await h.send('/api/lanyard/contacts/'+scheduler.id,undefined,contactManager.cookie)).status,404)
 const privateView=(await h.send('/api/lanyard/access',undefined,other.cookie)).value
 assert.deepEqual(privateView.people.map(p=>p.id),[worker.id]);assert.equal(JSON.stringify(privateView).includes('rateBasis'),false)
 await h.cmd('access.level.save',{...pin(time),name:time.name,site:time.site,permissions:['time.approve']})
 await h.cmd('access.grant',{levelId:time.id,staffId:approver.id,site:'Ocean Beach'})
 const sheet=await h.cmd('time.prepare',{staffId:worker.id,start:'2026-10-12T09:00:00Z',end:'2026-10-12T12:00:00Z',breakMinutes:0,reason:'Recorded missed clock',site:'Ocean Beach'})
 await refusal('time.approve',pin(sheet),scheduler.cookie)
 const approved=await h.cmd('time.approve',pin(sheet),approver.cookie);assert.equal(approved.status,'approved')
 await refusal('payroll.prepare',{ids:[sheet.id]},approver.cookie)
 const local=await h.cmd('time.prepare',{staffId:worker.id,start:'2026-10-13T09:00:00Z',end:'2026-10-13T10:00:00Z',breakMinutes:0,reason:'Local missed clock',site:'Ocean Beach'})
 const remote=await h.cmd('time.prepare',{staffId:worker.id,start:'2026-10-13T11:00:00Z',end:'2026-10-13T12:00:00Z',breakMinutes:0,reason:'Other cafe missed clock',site:'Mission'})
 const bulk=await h.cmd('time.approveMany',{items:[pin(local),pin(remote)]},approver.cookie)
 assert.deepEqual(bulk.approved.map(t=>t.id),[local.id]);assert.deepEqual(bulk.skipped,[{id:remote.id,reason:'Outside your permissions'}])
 assert.equal((await h.state()).timesheets.find(t=>t.id===remote.id).status,'submitted')

 await h.cmd('access.level.save',{...pin(pay),name:pay.name,site:pay.site,permissions:['payroll.export','wages.view']})
 await h.cmd('access.grant',{levelId:pay.id,staffId:payroll.id,site:'Ocean Beach'})
 const batch=await h.cmd('payroll.prepare',{ids:[sheet.id]},payroll.cookie)
 assert.deepEqual(batch.lines.map(l=>[l.staffId,l.minutes]),[[worker.id,180]])
 assert.equal((await h.cmd('payroll.export',pin(batch),payroll.cookie)).status,'exported')
 const download=await h.send('/api/lanyard/batches/'+batch.id+'.csv',undefined,payroll.cookie)
 assert.equal(download.status,200);assert.equal(download.text,batch.csvPreview)
 assert.equal((await h.send('/api/lanyard/batches/'+batch.id+'.csv',undefined,approver.cookie)).status,403)
 const payView=(await h.send('/api/lanyard/access',undefined,payroll.cookie)).value
 assert.deepEqual(payView.batches.map(b=>b.id),[batch.id])
 const analyst=level('Read-only analyst')
 await h.cmd('access.level.save',{...pin(analyst),name:analyst.name,site:analyst.site,permissions:['reports.view']})
 const analystGrant=await h.cmd('access.grant',{levelId:analyst.id,staffId:other.id,site:'Ocean Beach'})
 const reportPath='/api/lanyard/intervals?site=Ocean%20Beach&date=2026-10-12&size=60'
 const report=await h.send(reportPath,undefined,other.cookie)
 assert.equal(report.status,200);assert.equal(report.value.wagesVisible,false)
 assert.equal(report.value.intervals.reduce((n,x)=>n+x.actual.minutes,0),180)
 assert.ok(report.value.intervals.every(x=>x.actual.cents===null&&x.scheduled.cents===null&&x.actual.laborPercent===null&&x.exceeded===null))
 assert.equal((await h.send('/api/lanyard/intervals?site=Mission&date=2026-10-12',undefined,other.cookie)).status,403)
 const own=await h.cmd('time.prepare',{staffId:approver.id,start:'2026-10-12T09:00:00Z',end:'2026-10-12T10:00:00Z',breakMinutes:0,reason:'Own recorded clock',site:'Ocean Beach'})
 await refusal('time.approve',pin(own),approver.cookie)
 await h.cmd('access.revoke',pin(analystGrant));assert.equal((await h.send(reportPath,undefined,other.cookie)).status,403)
 await refusal('time.approve',pin(sheet),payroll.cookie)
 assert.equal((await h.send('/api/lanyard/contacts/'+worker.id,undefined,scheduler.cookie)).status,404)
 scheduleLevel=await h.cmd('access.level.save',{...pin(scheduleLevel),name:scheduleLevel.name,site:scheduleLevel.site,permissions:[]})
 await refusal('roster.prepare',{week,shifts:[shift]},scheduler.cookie)
 assert.deepEqual(scheduleLevel.changes.at(-1).before,['draft.view','draft.edit']);assert.deepEqual(scheduleLevel.changes.at(-1).after,[])
 const revokedDepartment=await h.cmd('access.revoke',pin(departmentGrant))
 assert.equal(revokedDepartment.revoked,true);assert.deepEqual(revokedDepartment.changes.at(-1).before,['draft.view','draft.edit']);assert.deepEqual(revokedDepartment.changes.at(-1).after,[])
 await refusal('roster.prepare',{week,shifts:[shift]},other.cookie)
 const localLevel=await h.cmd('access.level.save',{name:'Local scheduler',site:'Ocean Beach',permissions:['draft.view','draft.edit']},nativeManager.cookie)
 const localGrant=await h.cmd('access.grant',{levelId:localLevel.id,staffId:other.id,site:'Ocean Beach'},nativeManager.cookie)
 assert.equal((await h.cmd('access.revoke',pin(localGrant),nativeManager.cookie)).revoked,true,'a native manager can still administer an ordinary local level')
 const revokedState=await h.state()
 for(const assignment of [businessGrant,departmentGrant])assert.ok(revokedState.events.some(e=>e.action==='access.revoke'&&e.entityId===assignment.id&&e.actorRole==='owner'))
 assert.ok((await h.state()).events.some(e=>e.action==='access.defaults.create'&&e.actorRole==='owner'))
 assert.ok(grant.id)
}

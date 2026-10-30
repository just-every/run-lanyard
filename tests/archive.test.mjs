import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { harness } from './harness.mjs'
import { auditLargeQuarter } from './audit-report-journey.mjs'
const exec = promisify(execFile)
const cli = resolve('node_modules/@runeditrun/rer/global/rer.mjs')
const command = async (cwd, args, expected = 0) => {
  let result
  // These commands own a separate checkout, not the parent verify operation.
  const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }
  delete env.RER_LOCAL_OPERATION
  delete env.RER_LOCAL_STATE_PATH
  try { result = { ...await exec(process.execPath, [cli, ...args], { cwd, env, maxBuffer: 2e6 }), code: 0 } }
  catch (error) { result = error }
  assert.equal(result.code, expected, `${args[0]}: ${result.stdout ?? ''} ${result.stderr ?? ''}`)
}
async function checkout(root) {
  await mkdir(root)
  for (const name of ['package.json','pnpm-lock.yaml','OPERATIONS.json','RUN-LOCALLY.md','ACCEPTANCE.md','SEED-COMMAND-CONTRACT.md','OPERATIONS.md','.node-version','wrangler.jsonc','deploy.json','rer-setup.json','scripts','src','migrations']) await cp(name, join(root,name), { recursive: true })
  await symlink(resolve('node_modules'), join(root,'node_modules'), 'dir')
}
// Pacific Monday Oct 12, 2026, 7:00 am – 3:00 pm PDT; the 45-minute break is a later agreed correction.
const work = staffId => ({ staffId, start: '2026-10-12T14:00:00Z', end: '2026-10-12T22:00:00Z', breakMinutes: 30 })
test('ARCHIVE-001, AUDIT-001, LOG-001, SCHEDULE-004, PAY-009, PAYRULE-002, PAYRULE-003, CLOCK-005, CLOCK-003, PRIVACY-001, LEAVE-003 and TRADEOFF-001: public CLI archive round trip carries staff, schedules, corrected payroll and import history, excludes authority, refuses damaged or populated stores, keeps activity across restart and restore, and respects erasure', { timeout: 600_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(),'lanyard-archive-')), source=join(temporary,'source'), restored=join(temporary,'restored'), erased=join(temporary,'erased'),photoErased=join(temporary,'photo-erased'),locationErased=join(temporary,'location-erased'),noteErased=join(temporary,'note-erased')
  let h
  try {
    for (const path of [source,restored,erased,photoErased,locationErased,noteErased]) await checkout(path)
    await exec(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'], { cwd:source, env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}, maxBuffer:2e6 })
    h=await harness({root:source})
    const p=await h.cmd('staff.save',{name:'Temporary joiner',email:'temporary@venue.example',payrollId:'TEMP',role:'staff',active:false})
    await h.cmd('staff.save',{name:'Scope cafe',email:'scope-cafe@venue.example',role:'staff',active:false,site:'synthetic-scope-cafe'})
    const agentKey=await h.cmd('agent.create',{label:'Excluded secret',scopes:['comparison.read'],cafes:['synthetic-scope-cafe'],comparisonConsent:true})
    // A working installation: an active employee on a published week, approved and corrected hours exported twice, and a staff CSV import with its journal.
    const alex=await h.person('Alex')
    const personalCalendar=await h.cmd('calendar.issue',{revision:0,consent:'yes'},alex.cookie),calendarPath=new URL(personalCalendar.url).pathname
    await h.cmd('staff.save',{id:alex.id,revision:1,name:alex.name,email:alex.email,payrollId:alex.payrollId,role:'staff',active:true,hourlyRate:'20.00'})
    await h.cmd('availability.save',{staffId:alex.id,start:'2026-10-12T07:00:00Z',end:'2026-10-19T07:00:00Z'})
    const week=await h.cmd('roster.prepare',{week:'2026-10-12',shifts:[{...work(alex.id),label:'Morning service'}]});await h.cmd('roster.publish',{id:week.id,revision:week.revision})
    const handoverShift=(await h.state()).shifts.find(x=>x.rosterId===week.id),handover=await h.cmd('shiftwork.save',{shiftId:handoverShift.id,shiftRevision:handoverShift.revision,notes:'Archive closing handover',tasks:['Check closing lock']})
    const answer=await h.cmd('shiftwork.respond',{shiftId:handoverShift.id,shiftRevision:handoverShift.revision,revision:handover.revision,completed:[handover.tasks[0].id],blocker:'Lock needs repair',attachment:{name:'lock.txt',type:'text/plain',data:Buffer.from('Retained blocker file').toString('base64')}},alex.cookie)
    await h.cmd('holiday.seed',{site:'',year:2026})
    await h.cmd('holidayrule.save',{site:'',from:'2026-01-01',mode:'multiplier',value:1.5,nonWorkMinutes:480,beforeAfter:false,code:'HOL'})
    await h.cmd('premiumrule.save',{site:'',from:'2026-01-01',preset:'employer',minimumCents:2000,reportingGuaranteeMinutes:120,splitMinutes:60,spreadMinutes:30,spreadThresholdMinutes:300})
    const approvePremium=async timeId=>{const input=await h.cmd('premium.prepare',{timeId,kind:'spread',reason:'Employer reviewed archive service spread'});return h.cmd('premium.decide',{id:input.id,revision:input.revision,decision:'approve',reason:'Payroll administrator checked source'})}
    const first=await h.cmd('time.approve',{id:(await h.cmd('time.prepare',{...work(alex.id),reason:'Paper sheet'})).id,revision:1})
    await approvePremium(first.id)
    const batch=await h.cmd('payroll.prepare',{}),exported=await h.cmd('payroll.export',{id:batch.id,revision:batch.revision})
    assert.ok(exported.lines.some(l=>l.holidayLine&&l.costCents===7500),'approved holiday premium is archived with the original payroll file')
    await h.cmd('payroll.acknowledge',{id:batch.id,revision:exported.revision,reference:'Payroll-import-101'})
    const fix=await h.cmd('time.prepare',{...work(alex.id),breakMinutes:45,corrects:first.id,reason:'Break correction agreed with Alex'});await h.cmd('time.approve',{id:fix.id,revision:1})
    await approvePremium(fix.id)
    const delta=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',{id:delta.id,revision:1})
    const files=Object.fromEntries(await Promise.all([batch.id,delta.id].map(async id=>[id,(await h.send(`/api/lanyard/batches/${id}.csv`,undefined,h.owner)).text])))
    assert.match(files[batch.id],/450,7\.5000/);assert.match(files[delta.id],/-15,-0\.2500/)
    const privacyConsent={consent:true,reason:'synthetic-lanyard-60 employee privacy request'}
    const noteDate=new Date(Date.now()-30*86400000).toISOString().slice(0,10)
    const privacyNote=await h.cmd('note.save',{staffId:alex.id,date:noteDate,category:'other',visibility:'employee',text:'synthetic-lanyard-61 erasure candidate',attachment:{name:'privacy.txt',type:'text/plain',data:btoa('synthetic-lanyard-62')}})
    await h.cmd('privacy.retention',{type:'history',days:3650,...privacyConsent})
    const historyHold=await h.cmd('privacy.hold',{staffId:alex.id,type:'history',hold:true,...privacyConsent})
    for(const type of ['notes','attachments'])await h.cmd('privacy.retention',{type,days:1,...privacyConsent})
    const csv=await readFile('tests/fixtures/staff.csv','utf8'),imported=await h.cmd('import.apply',{csv,fingerprint:(await h.cmd('import.preview',{csv})).fingerprint})
    const logged=await h.cmd('log.save',{site:'',date:'2026-10-12',category:'incident',text:'Dish pit floor',attachments:[{name:'floor.txt',type:'text/plain',data:Buffer.from('floor inspection').toString('base64')},{name:'report.txt',type:'text/plain',data:Buffer.from('incident report').toString('base64')}]})
    // PAY-009: schedules and generated period dates survive the public CLI door.
    const calendarPerson=await h.person('Calendar')
    const paygroup=await h.cmd('paygroup.save',{name:'Archive monthly',cadence:'monthly',from:'2026-10-01',payDays:5,workweekStart:0,staffIds:[calendarPerson.id]})
    await h.cmd('paygroup.period',{groupId:paygroup.id,date:'2026-10-16'})
    await h.cmd('staff.save',{id:calendarPerson.id,revision:1,name:calendarPerson.name,email:calendarPerson.email,payrollId:calendarPerson.payrollId,role:'staff',active:true,hourlyRate:'20.00'})
    const review=(await h.state()).holidayReviews.find(r=>r.staffId===calendarPerson.id&&r.date==='2026-10-12'&&r.kind==='non-work')
    await h.cmd('holidaypay.approve',{staffId:calendarPerson.id,site:'',date:review.date,reference:'archive-holiday-service',digest:review.digest})
    // New product records travel, while kiosk authentication must be re-established.
    const kioskPerson=await h.person('KioskArchive')
    await h.cmd('staff.save',{id:kioskPerson.id,revision:1,name:kioskPerson.name,email:kioskPerson.email,payrollId:kioskPerson.payrollId,role:'staff',active:true,site:'Archive cafe'})
    const level=await h.cmd('access.level.save',{name:'Archive shift lead',site:'Archive cafe',permissions:['draft.edit']})
    await h.cmd('access.grant',{levelId:level.id,site:'Archive cafe',staffId:kioskPerson.id})
    const thread=await h.cmd('chat.create',{kind:'announcement',site:'Archive cafe',title:'Archive operational handover'})
    const message=await h.cmd('chat.send',{threadId:thread.id,text:'synthetic-lanyard-1',attachment:{name:'archive.txt',type:'text/plain',data:btoa('synthetic-lanyard-2')}})
    await h.cmd('chat.acknowledge',{id:message.id,revision:message.revision},kioskPerson.cookie)
    await h.cmd('kiosk.pin',{pin:'123456',language:'es',consent:true},kioskPerson.cookie)
    const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Archive cafe',label:'Archive tablet',photo:true,consent:true}},h.owner)
    const login=await h.send('/api/lanyard/kiosk/signin',{email:kioskPerson.email,pin:'123456'},enrolled.cookie),kioskCookie=enrolled.cookie+'; '+login.cookie
    const punch=await h.send('/api/lanyard/kiosk/capture',{name:'clock.in',input:{commandId:crypto.randomUUID(),capturedAt:'2026-10-13T14:00:00Z'},photo:btoa(String.fromCharCode(255,216,255,217)),photoConsent:true},kioskCookie)
    assert.equal(punch.status,200,punch.text);const photoId=punch.value.result.kioskReceipt.photoId
    const kioskOut=await h.send('/api/lanyard/kiosk/capture',{name:'clock.out',input:{commandId:'synthetic-lanyard-50',capturedAt:'2026-10-13T15:00:00Z',breakMinutes:0},photo:btoa(String.fromCharCode(255,216,255,217)),photoConsent:true},kioskCookie)
    assert.equal(kioskOut.status,200,kioskOut.text)
    const photoPolicy=await h.cmd('photo.save',{site:'Archive cafe',native:true,kiosk:true,breaks:true,retentionDays:1,consent:true})
    await h.cmd('geofence.save',{site:'Archive cafe',latitude:37.76,longitude:-122.5,radiusMeters:200,maxAccuracyMeters:50,retentionDays:1,enabled:true,consent:true})
    const locationDevice=await h.send('/api/lanyard/command',{name:'clockbrowser.enroll',input:{site:'Archive cafe',label:'Archive location phone',type:'phone'}},h.owner)
    assert.equal(locationDevice.status,200,locationDevice.text)
    const nativeCookie=kioskPerson.cookie+'; '+locationDevice.cookie,location=observedAt=>({latitude:37.76,longitude:-122.5,accuracyMeters:5,observedAt,consent:true,noticeSeen:true})
    const nativePhoto=await h.cmd('clock.in',{commandId:'synthetic-lanyard-51',capturedAt:'2026-10-14T14:00:00Z',location:location('2026-10-14T14:00:00Z'),photo:btoa(String.fromCharCode(255,216,255,217)),photoConsent:true,photoNoticeSeen:true},nativeCookie)
    const nativeOut=await h.cmd('clock.out',{commandId:'synthetic-lanyard-52',capturedAt:'2026-10-14T15:00:00Z',location:location('2026-10-14T15:00:00Z'),breakMinutes:0,photo:btoa(String.fromCharCode(255,216,255,217)),photoConsent:true,photoNoticeSeen:true},nativeCookie)
    const photoIds=[photoId,kioskOut.value.result.kioskReceipt.photoId,nativePhoto.photoReceipt.photoId,nativeOut.photoReceipt.photoId]
    // Separate grant banks, private paid status and signed leave corrections travel through the CLI.
    const leavePerson=await h.person('LeaveArchive')
    await h.cmd('staff.save',{id:leavePerson.id,revision:leavePerson.revision,name:leavePerson.name,email:leavePerson.email,payrollId:leavePerson.payrollId,role:'staff',active:true,site:'Leave archive cafe',hourlyRate:'20.00',startDate:'2020-01-01'})
    const unpaidPolicy=await h.cmd('sickpolicy.save',{site:'Leave archive cafe',from:'2026-02-22',preset:'NYC_UPFRONT',code:'UNPAID'})
    const prenatalPolicy=await h.cmd('sickpolicy.save',{site:'Leave archive cafe',from:'2025-01-01',preset:'NY_PRENATAL',code:'PRENATAL'})
    const unpaidRequest=await h.cmd('sick.request',{policyId:unpaidPolicy.id,start:'2026-10-15T16:00:00Z',end:'2026-10-15T18:00:00Z',minutes:120,purpose:'childcare'},leavePerson.cookie)
    await h.cmd('sick.decide',{id:unpaidRequest.id,revision:unpaidRequest.revision,decision:'approved',reference:'synthetic-lanyard-120'})
    const prenatalRequest=await h.cmd('sick.request',{policyId:prenatalPolicy.id,start:'2026-10-16T16:00:00Z',end:'2026-10-16T18:00:00Z',minutes:120,purpose:'prenatal care'},leavePerson.cookie)
    const prenatalApproved=await h.cmd('sick.decide',{id:prenatalRequest.id,revision:prenatalRequest.revision,decision:'approved',reference:'synthetic-lanyard-121'})
    const leaveBatch=await h.cmd('payroll.prepare',{});assert.deepEqual(leaveBatch.lines.filter(l=>l.sickLine).map(l=>[l.minutes,l.costCents,l.payCode]),[[120,4000,'PRENATAL']]);await h.cmd('payroll.export',{id:leaveBatch.id,revision:leaveBatch.revision})
    files[leaveBatch.id]=(await h.send(`/api/lanyard/batches/${leaveBatch.id}.csv`,undefined,h.owner)).text
    await h.cmd('sick.correct',{id:prenatalApproved.id,revision:prenatalApproved.revision,minutes:60,reason:'synthetic-lanyard-122 reviewed correction'})
    const leaveAdjustment=await h.cmd('payroll.prepare',{});assert.deepEqual(leaveAdjustment.lines.filter(l=>l.sickLine).map(l=>[l.minutes,l.costCents]),[[-60,-2000]]);await h.cmd('payroll.export',{id:leaveAdjustment.id,revision:leaveAdjustment.revision})
    files[leaveAdjustment.id]=(await h.send(`/api/lanyard/batches/${leaveAdjustment.id}.csv`,undefined,h.owner)).text
    const donor=await h.person('DonationArchive'),recipient=await h.person('RecipientArchive')
    for(const worker of [donor,recipient])await h.cmd('staff.save',{id:worker.id,revision:worker.revision,name:worker.name,email:worker.email,payrollId:worker.payrollId,role:'staff',active:true,site:'Oregon archive cafe',hourlyRate:'20.00',startDate:'2020-01-01'})
    const donationPolicy=await h.cmd('sickpolicy.save',{site:'Oregon archive cafe',from:'2025-01-01',preset:'OR',code:'DONATED-SICK',donations:'yes'})
    const donorWork=await h.cmd('time.prepare',{staffId:donor.id,start:'2026-10-01T07:00:00Z',end:'2026-10-03T07:00:00Z',breakMinutes:0,site:'Oregon archive cafe',reason:'Approved donation source'});await h.cmd('time.approve',{id:donorWork.id,revision:donorWork.revision})
    const donationHeaders={'x-test-now':String(Date.parse('2026-10-27T12:00:00Z'))}
    const donation=await h.cmd('sicktransfer.prepare',{policyId:donationPolicy.id,donorId:donor.id,recipientId:recipient.id,date:'2026-10-27',minutes:60},h.owner,200,donationHeaders)
    const consented=await h.cmd('sicktransfer.consent',{id:donation.id,revision:donation.revision,consent:'yes'},donor.cookie,200,donationHeaders)
    await h.cmd('sicktransfer.decide',{id:consented.id,revision:consented.revision,decision:'approved'},h.owner,200,donationHeaders)
    await h.cmd('sickworker.save',{id:donationPolicy.id,revision:donationPolicy.revision,staffId:donor.id,from:'2026-10-28',classification:'unresolved',legalBasis:'Source review remains unresolved; do not infer eligibility',evidenceReference:'synthetic-lanyard-180',reviewReason:'Preserve donated history while reviewing future eligibility'},h.owner,200,{'x-test-now':String(Date.parse('2026-10-28T12:00:00Z'))})
    const retainedAudit=await h.cmd('audit.retain',{site:'',from:'2026-10-01',through:'2026-10-31',jurisdiction:'all',sourceVersion:(await h.state()).version,reason:'Preserve reviewed payroll audit sources',consent:true})
    assert.ok(retainedAudit.report.rows.some(r=>r.sourceId===first.id))
    const retainedDuty=await h.cmd('privacy.recordDuty',{sourceKind:'auditpackets',sourceId:retainedAudit.id,sourceRevision:retainedAudit.revision,preset:'federal-payroll',applicability:'applies',anchor:retainedAudit.createdAt.slice(0,10),reason:'Reviewed archive copy minimum',consent:true})
    const separateHold=await h.cmd('privacy.hold',{staffId:alex.id,type:'history',caseId:'synthetic-lanyard-archive-matter',hold:true,reason:'Independent archive hold',consent:true})
    const archivedAuditor=await h.person('ArchivedAuditor')
    const auditBusiness=await h.cmd('organization.business.save',{name:'Archive audit business'})
    await h.cmd('organization.location.save',{name:'Archive audit location',businessId:auditBusiness.id,site:'Archive cafe',timezone:'UTC'})
    const auditGrant=await h.cmd('access.audit.grant',{staffId:archivedAuditor.id,businessId:auditBusiness.id,site:'Archive cafe',employeeIds:[kioskPerson.id],jurisdictions:['unassigned'],classes:['breaks'],from:'2026-10-01',through:'2026-10-31',purpose:'Inspect archived punch exceptions',endsAt:'2027-10-27T12:00:00Z',wages:false,consent:true})
    const auditPath='/api/lanyard/audit?'+new URLSearchParams({grantId:auditGrant.id,site:'Archive cafe',from:'2026-10-01',through:'2026-10-31',jurisdiction:'unassigned'})
    const scopedAudit=await h.send(auditPath,undefined,archivedAuditor.cookie)
    assert.equal(scopedAudit.status,200,scopedAudit.text)
    assert.deepEqual(scopedAudit.value.rows.map(r=>r.sourceId).sort(),[kioskOut.value.result.timesheet.id,nativeOut.timesheet.id].sort())
    const quarterPackets=await auditLargeQuarter(h)
    const originalChat=(await h.send('/api/lanyard/chat',undefined,h.owner)).value,originalAccess=(await h.send('/api/lanyard/access',undefined,h.owner)).value
    const calendarDigest=(await h.db.prepare('SELECT token_hash FROM l_calendar_feeds WHERE staff_id=?').bind(alex.id).first()).token_hash
    const calendarBefore=await h.send(calendarPath);assert.equal(calendarBefore.status,200);assert.ok(calendarBefore.text.includes('BEGIN:VEVENT'))
    const journal=await h.cmd('import.journal',{jobId:imported.job.id}),original=await h.state()
    const identity={auth:h.auth,owner:h.owner}
    await h.close();h=null
    const old=join(temporary,'before.rer'),later=join(temporary,'later.rer'),again=join(temporary,'again.rer')
    await command(source,['export','--output',old,'--no-queue'])
    const bytes=await readFile(old,'utf8');assert.ok(!bytes.includes(calendarPath.split('/').at(-1).replace('.ics','')));assert.ok(!bytes.includes(calendarDigest));assert.ok(bytes.includes('Temporary joiner'));assert.ok(!bytes.includes('Excluded secret'));assert.ok(!bytes.includes('token_hash'));assert.ok(!bytes.includes('scopes_json'));assert.ok(!bytes.includes('comparison.read'));for(const table of ['l_calendar_feeds','l_kiosk_devices','l_kiosk_pins','l_kiosk_sessions','l_kiosk_attempts'])assert.equal(bytes.split('\n').filter(Boolean).map(JSON.parse).filter(p=>p.kind==='part').flatMap(p=>p.items).some(i=>i.kind==='row'&&i.table===table),false,table)
    await command(restored,['import','--input',old,'--yes','--no-queue'])
    await command(restored,['export','--output',again,'--no-queue'])
    const rows=text=>text.split('\n').filter(Boolean).map(JSON.parse).filter(r=>r.kind==='part')
    assert.ok(rows(bytes).length>0);assert.deepEqual(rows(await readFile(again,'utf8')),rows(bytes))
    // The restored installation holds the same records and files; sessions and agent keys stayed behind, so the archived owner signs in anew.
    h=await harness({root:restored,...identity})
    await h.state(identity.owner,401)
    assert.equal((await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agentKey.token}`})).status,401)
    const owner=await h.signIn(h.auth.OWNER_EMAIL),back=await h.state(owner)
    assert.deepEqual(back.agentKeys,[])
    assert.equal((await h.send(calendarPath)).status,404,'archived calendar credentials grant no restored authority')
    const restoredAlex=await h.signIn(alex.email),freshCalendar=await h.cmd('calendar.issue',{revision:0,consent:'yes'},restoredAlex),restoredCalendar=await h.send(new URL(freshCalendar.url).pathname)
    assert.equal(restoredCalendar.status,200);assert.equal(restoredCalendar.text,calendarBefore.text,'retained event identities, instants and sequences survive restore under new authority')
    assert.deepEqual(back.kiosks,[])
    assert.equal((await h.send('/api/lanyard/kiosk/state',undefined,kioskCookie)).status,403)
    assert.equal((await h.send('/api/lanyard/kiosk/signin',{email:kioskPerson.email,pin:'123456'},enrolled.cookie)).status,403)
    assert.deepEqual((await h.send('/api/lanyard/chat',undefined,owner)).value,originalChat)
    assert.deepEqual((await h.send('/api/lanyard/access',undefined,owner)).value,originalAccess)
    for(const kind of ['kioskreceipts','photoreceipts','photopolicies','photonotices','geofences','georeceipts'])assert.deepEqual(back[kind],original[kind],kind)
    const photo=await h.mf.dispatchFetch(h.origin+'/api/lanyard/kiosk-photos/'+photoId,{headers:{cookie:owner}})
    assert.equal(photo.status,200);assert.deepEqual([...new Uint8Array(await photo.arrayBuffer())],[255,216,255,217])
    for(const id of photoIds){const r=await h.mf.dispatchFetch(h.origin+'/api/lanyard/kiosk-photos/'+id,{headers:{cookie:owner}});assert.equal(r.status,200);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[255,216,255,217])}
    assert.equal((await h.send('/api/lanyard/agent/fairness/compare?week=2026-10-12&site=synthetic-scope-cafe',undefined,'',{authorization:`Bearer ${agentKey.token}`})).status,401)
    const freshKey=await h.cmd('agent.create',{label:'Restored preparation only'},owner);assert.deepEqual(freshKey.scopes,[]);assert.deepEqual(freshKey.cafes,[])
    assert.equal((await h.send('/api/lanyard/agent/fairness/compare?week=2026-10-12&site=synthetic-scope-cafe',undefined,'',{authorization:`Bearer ${freshKey.token}`})).status,404)
    assert.equal(back.sickpolicies.length,3)
    assert.deepEqual(back.sicktransfers,original.sicktransfers)
    const donationBalances=(await h.send('/api/lanyard/sick-balances?asOf=2026-10-27',undefined,owner)).value.filter(r=>r.policyId===donationPolicy.id)
    assert.deepEqual([donationBalances.find(r=>r.staffId===donor.id).balanceMinutes,donationBalances.find(r=>r.staffId===recipient.id).balanceMinutes],[36,60])
    assert.deepEqual(back.sickpolicies,original.sickpolicies)
    const donorSession=await h.signIn(donor.email)
    const eligibilityRefusal=await h.cmd('sick.request',{policyId:donationPolicy.id,start:'2026-10-29T16:00:00Z',end:'2026-10-29T17:00:00Z',minutes:60,purpose:'illness'},donorSession,409)
    assert.match(eligibilityRefusal.error,/eligibility needs review/,'restored employment review still fences future use')
    assert.deepEqual(back.sickuses,original.sickuses)
    assert.deepEqual(back.sickuses.map(u=>[u.paid,u.minutes,u.costCents]).sort((a,b)=>Number(a[0])-Number(b[0])),[[false,120,0],[true,60,2000]])
    const leaveBalances=(await h.send('/api/lanyard/sick-balances?asOf=2026-10-16',undefined,owner)).value.filter(r=>r.staffId===leavePerson.id)
    assert.deepEqual(leaveBalances.map(r=>[r.preset,r.balanceMinutes]).sort(),[['NYC_UPFRONT',1800],['NY_PRENATAL',1140]])
    assert.deepEqual(back.auditgrants,original.auditgrants)
    assert.equal((await h.send(auditPath,undefined,archivedAuditor.cookie)).status,401)
    const restoredAuditor=await h.signIn(archivedAuditor.email)
    const restoredAudit=await h.send(auditPath,undefined,restoredAuditor)
    assert.equal(restoredAudit.status,200,restoredAudit.text);assert.deepEqual(restoredAudit.value.rows,scopedAudit.value.rows)
    assert.equal((await h.send('/api/lanyard/state',undefined,restoredAuditor)).status,403)
    assert.deepEqual(back.recordduties,original.recordduties)
    assert.equal(back.recordduties.find(d=>d.id===retainedDuty.id).retainThrough,retainedDuty.retainThrough)
    const restoredReview=await h.cmd('privacy.records.review',{sourceKind:'auditpackets',sourceId:retainedAudit.id},owner)
    assert.ok(restoredReview.holds.some(hold=>hold.id===separateHold.id))
    assert.deepEqual(back.auditpackets,original.auditpackets)
    assert.deepEqual((await h.send('/api/lanyard/audit-packets/'+retainedAudit.id,undefined,owner)).value,retainedAudit)
    for(const packet of quarterPackets){
      assert.deepEqual((await h.send('/api/lanyard/audit-packets/'+packet.id,undefined,owner)).value,packet,'complete quarter payload and authorization survive supported archive restore')
      assert.equal((await h.send('/api/lanyard/audit-packets/'+packet.id+'.csv',undefined,owner)).text,packet.csv)
    }
    assert.deepEqual(back.logbook,original.logbook)
    assert.deepEqual(back.shiftwork,original.shiftwork);assert.deepEqual(back.taskanswers,original.taskanswers)
    assert.equal((await h.send(`/api/lanyard/handover/${answer.id}/files/${answer.attachment.id}`,undefined,owner)).text,'Retained blocker file')
    for(const [i,file] of logged.attachments.entries())assert.equal((await h.send(`/api/lanyard/logbook/${logged.id}/files/${file.id}`,undefined,owner)).text,['floor inspection','incident report'][i])
    for(const kind of ['staff','rosters','shifts','timesheets','batches','paygroups','periods','holidays','holidayrules','holidaypay','premiumrules','premiuminputs'])assert.deepEqual(back[kind],original[kind],kind)
    assert.deepEqual(back.events.map(e=>e.id),original.events.map(e=>e.id))
    assert.equal((await h.send('/api/lanyard/audit-packets/'+retainedAudit.id+'.csv',undefined,owner)).text,retainedAudit.csv)
    for(const [id,text] of Object.entries(files))assert.equal((await h.send(`/api/lanyard/batches/${id}.csv`,undefined,owner)).text,text)
    assert.deepEqual(await h.cmd('import.journal',{jobId:imported.job.id},owner),journal)
    assert.equal((await h.state(await h.signIn(alex.email))).shifts[0].label,'Morning service')
    await h.close();h=null
    await command(restored,['import','--input',old,'--yes','--no-queue'],4)
    const corrupt=join(temporary,'corrupt.rer');await writeFile(corrupt,bytes.replace('Temporary joiner','Changed joiner'),{mode:0o600})
    // Checksum damage is a transfer failure (1); restore policy conflicts remain 4.
    await command(erased,['import','--input',corrupt,'--yes','--no-queue'],1)
    h=await harness({root:source,...identity});const reopened=await h.signIn(h.auth.OWNER_EMAIL)
    // Activity survives a restart of the same installation.
    assert.deepEqual((await h.state(reopened)).events.map(e=>e.id),original.events.map(e=>e.id))
    // Photo erasure alone fences older backups before any identity is erased.
    await h.cmd('photo.hold',{staffId:kioskPerson.id,hold:true,reason:'Archive hold proof'},reopened)
    await h.cmd('photo.erase',{staffId:kioskPerson.id,mode:'retention',consent:true,reason:'Expired photo archive proof'},reopened,409)
    await h.cmd('photo.hold',{staffId:kioskPerson.id,hold:false,reason:'Employer released archive hold'},reopened)
    const employee=(await h.state(reopened)).staff.find(x=>x.id===kioskPerson.id)
    await h.cmd('staff.save',{id:employee.id,revision:employee.revision,name:employee.name,email:employee.email,payrollId:employee.payroll_id,role:employee.role,site:employee.site,active:false},reopened)
    const erasure=await h.cmd('photo.erase',{staffId:kioskPerson.id,mode:'former',consent:true,reason:'Former employee expired photo bytes'},reopened)
    assert.equal(erasure.erased,4)
    const photoLater=join(temporary,'photo-later.rer')
    await h.close();h=null
    await command(source,['export','--output',photoLater,'--no-queue'])
    await command(photoErased,['import','--input',old,'--journal',photoLater,'--yes','--no-queue'],4)
    await command(photoErased,['import','--input',photoLater,'--yes','--no-queue'])
    h=await harness({root:photoErased,...identity});const photoOwner=await h.signIn(h.auth.OWNER_EMAIL),photoBack=await h.state(photoOwner)
    for(const id of photoIds)assert.equal((await h.send('/api/lanyard/kiosk-photos/'+id,undefined,photoOwner)).status,404)
    assert.ok(photoBack.photoreceipts.every(r=>r.photoId===null&&r.erasedAt))
    assert.ok(photoBack.kioskreceipts.every(r=>r.photoId===null&&r.erasedAt))
    for(const id of [kioskOut.value.result.timesheet.id,nativeOut.timesheet.id]){const t=photoBack.timesheets.find(t=>t.id===id);assert.equal(t.minutes,60);assert.equal(t.photoReview.length,2);assert.ok(t.photoReview.every(p=>!p.photoId&&p.erasedAt))}
    await h.close();h=null
    h=await harness({root:source,...identity});const erasedOwner=await h.signIn(h.auth.OWNER_EMAIL)
    // Coordinate erasure independently fences an archive already stripped of photos.
    for(const receipt of (await h.state(erasedOwner)).georeceipts)await h.cmd('location.erase',{id:receipt.id,revision:receipt.revision,reason:'Expired punch coordinates',consent:true},erasedOwner)
    const locationLater=join(temporary,'location-later.rer')
    await h.close();h=null
    await command(source,['export','--output',locationLater,'--no-queue'])
    await command(locationErased,['import','--input',photoLater,'--journal',locationLater,'--yes','--no-queue'],4)
    await command(locationErased,['import','--input',locationLater,'--yes','--no-queue'])
    h=await harness({root:locationErased,...identity});const locationOwner=await h.signIn(h.auth.OWNER_EMAIL),locationBack=await h.state(locationOwner)
    assert.equal(locationBack.georeceipts.length,2);assert.ok(locationBack.georeceipts.every(r=>r.latitude===undefined&&r.longitude===undefined&&r.erasedAt))
    const locatedTime=locationBack.timesheets.find(t=>t.id===nativeOut.timesheet.id);assert.equal(locatedTime.minutes,60);assert.equal(locatedTime.locationReview.length,2)
    await h.close();h=null
    h=await harness({root:source,...identity});const finalOwner=await h.signIn(h.auth.OWNER_EMAIL)
    const former=(await h.state(finalOwner)).staff.find(x=>x.id===alex.id)
    await h.cmd('staff.save',{id:former.id,revision:former.revision,name:former.name,email:former.email,payrollId:former.payrollId,role:former.role,active:false},finalOwner)
    await h.cmd('privacy.erase',{staffId:alex.id,type:'history',...privacyConsent},finalOwner,409)
    const noteResult=await h.cmd('privacy.erase',{staffId:alex.id,type:'notes',...privacyConsent},finalOwner)
    assert.ok(noteResult.erased.includes(privacyNote.id))
    await h.close();h=null
    const noteLater=join(temporary,'note-later.rer')
    await command(source,['export','--output',noteLater,'--no-queue'])
    await command(noteErased,['import','--input',locationLater,'--journal',noteLater,'--yes','--no-queue'],4)
    await command(noteErased,['import','--input',noteLater,'--yes','--no-queue'])
    h=await harness({root:noteErased,...identity});const noteOwner=await h.signIn(h.auth.OWNER_EMAIL)
    const employeeExport=await h.cmd('privacy.export',{staffId:alex.id,...privacyConsent},noteOwner)
    assert.ok(!JSON.stringify(employeeExport).includes('synthetic-lanyard-61'))
    const restoredNotes=JSON.stringify((await h.db.prepare("SELECT data FROM l_records WHERE kind='notes'").all()).results),restoredResults=JSON.stringify((await h.db.prepare('SELECT result FROM l_commands').all()).results)
    for(const retained of [restoredNotes,restoredResults])assert.ok(!retained.includes('synthetic-lanyard-61'),'later archive contains no erased note text or saved result copy')
    assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_note_files WHERE note_id=?').bind(privacyNote.id).first()).n,0,'later archive contains no erased journal file')
    assert.equal((await h.send(`/api/lanyard/notes/${privacyNote.id}/files/${privacyNote.attachment.id}`,undefined,noteOwner)).status,404)
    assert.ok(employeeExport.timesheets.some(t=>t.id===first.id))
    assert.equal((await h.cmd('privacy.review',{staffId:alex.id},noteOwner)).holds.find(x=>x.id===historyHold.id).hold,true)
    await h.cmd('privacy.erase',{staffId:alex.id,type:'history',...privacyConsent},noteOwner,409)
    await h.close();h=null
    h=await harness({root:source,...identity});const finalAgain=await h.signIn(h.auth.OWNER_EMAIL)
    await h.cmd('staff.erase',{id:p.id,revision:1},finalAgain);await h.close();h=null
    await command(source,['export','--output',later,'--no-queue'])
    await command(erased,['import','--input',old,'--journal',later,'--yes','--no-queue'],4)
    await command(erased,['import','--input',later,'--yes','--no-queue'])
    const proxy=await getPlatformProxy({configPath:join(erased,'wrangler.jsonc'),persist:{path:join(erased,'.wrangler/state/v3')},remoteBindings:false})
    try { assert.equal((await proxy.env.DB.prepare('SELECT name FROM l_staff WHERE id=?').bind(p.id).first()).name,'Erased staff') }
    finally { await proxy.dispose() }
  } finally { if(h)await h.close();await rm(temporary,{recursive:true,force:true}) }
})

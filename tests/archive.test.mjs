import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { harness } from './harness.mjs'
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
test('ARCHIVE-001, AUDIT-001, LOG-001, SCHEDULE-004, PAY-009, PAYRULE-002, PAYRULE-003 and TRADEOFF-001: public CLI archive round trip carries staff, schedules, corrected payroll and import history, excludes authority, refuses damaged or populated stores, keeps activity across restart and restore, and respects erasure', { timeout: 600_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(),'lanyard-archive-')), source=join(temporary,'source'), restored=join(temporary,'restored'), erased=join(temporary,'erased')
  let h
  try {
    for (const path of [source,restored,erased]) await checkout(path)
    await exec(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'], { cwd:source, env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}, maxBuffer:2e6 })
    h=await harness({root:source})
    const p=await h.cmd('staff.save',{name:'Temporary joiner',email:'temporary@venue.example',payrollId:'TEMP',role:'staff',active:false})
    await h.cmd('staff.save',{name:'Scope cafe',email:'scope-cafe@venue.example',role:'staff',active:false,site:'synthetic-scope-cafe'})
    const agentKey=await h.cmd('agent.create',{label:'Excluded secret',scopes:['comparison.read'],cafes:['synthetic-scope-cafe'],comparisonConsent:true})
    // A working installation: an active employee on a published week, approved and corrected hours exported twice, and a staff CSV import with its journal.
    const alex=await h.person('Alex')
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
    const originalChat=(await h.send('/api/lanyard/chat',undefined,h.owner)).value,originalAccess=(await h.send('/api/lanyard/access',undefined,h.owner)).value
    const journal=await h.cmd('import.journal',{jobId:imported.job.id}),original=await h.state()
    const identity={auth:h.auth,owner:h.owner}
    await h.close();h=null
    const old=join(temporary,'before.rer'),later=join(temporary,'later.rer'),again=join(temporary,'again.rer')
    await command(source,['export','--output',old,'--no-queue'])
    const bytes=await readFile(old,'utf8');assert.ok(bytes.includes('Temporary joiner'));assert.ok(!bytes.includes('Excluded secret'));assert.ok(!bytes.includes('token_hash'));assert.ok(!bytes.includes('scopes_json'));assert.ok(!bytes.includes('comparison.read'));for(const table of ['l_kiosk_devices','l_kiosk_pins','l_kiosk_sessions','l_kiosk_attempts'])assert.equal(bytes.includes(table),false,table)
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
    assert.deepEqual(back.kiosks,[])
    assert.equal((await h.send('/api/lanyard/kiosk/state',undefined,kioskCookie)).status,403)
    assert.equal((await h.send('/api/lanyard/kiosk/signin',{email:kioskPerson.email,pin:'123456'},enrolled.cookie)).status,403)
    assert.deepEqual((await h.send('/api/lanyard/chat',undefined,owner)).value,originalChat)
    assert.deepEqual((await h.send('/api/lanyard/access',undefined,owner)).value,originalAccess)
    assert.deepEqual(back.kioskreceipts,original.kioskreceipts)
    const photo=await h.mf.dispatchFetch(h.origin+'/api/lanyard/kiosk-photos/'+photoId,{headers:{cookie:owner}})
    assert.equal(photo.status,200);assert.deepEqual([...new Uint8Array(await photo.arrayBuffer())],[255,216,255,217])
    assert.equal((await h.send('/api/lanyard/agent/fairness/compare?week=2026-10-12&site=synthetic-scope-cafe',undefined,'',{authorization:`Bearer ${agentKey.token}`})).status,401)
    const freshKey=await h.cmd('agent.create',{label:'Restored preparation only'},owner);assert.deepEqual(freshKey.scopes,[]);assert.deepEqual(freshKey.cafes,[])
    assert.equal((await h.send('/api/lanyard/agent/fairness/compare?week=2026-10-12&site=synthetic-scope-cafe',undefined,'',{authorization:`Bearer ${freshKey.token}`})).status,404)
    assert.deepEqual(back.logbook,original.logbook)
    assert.deepEqual(back.shiftwork,original.shiftwork);assert.deepEqual(back.taskanswers,original.taskanswers)
    assert.equal((await h.send(`/api/lanyard/handover/${answer.id}/files/${answer.attachment.id}`,undefined,owner)).text,'Retained blocker file')
    for(const [i,file] of logged.attachments.entries())assert.equal((await h.send(`/api/lanyard/logbook/${logged.id}/files/${file.id}`,undefined,owner)).text,['floor inspection','incident report'][i])
    for(const kind of ['staff','rosters','shifts','timesheets','batches','paygroups','periods','holidays','holidayrules','holidaypay','premiumrules','premiuminputs'])assert.deepEqual(back[kind],original[kind],kind)
    assert.deepEqual(back.events.map(e=>e.id),original.events.map(e=>e.id))
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
    await h.cmd('staff.erase',{id:p.id,revision:1},reopened);await h.close();h=null
    await command(source,['export','--output',later,'--no-queue'])
    await command(erased,['import','--input',old,'--journal',later,'--yes','--no-queue'],4)
    await command(erased,['import','--input',later,'--yes','--no-queue'])
    const proxy=await getPlatformProxy({configPath:join(erased,'wrangler.jsonc'),persist:{path:join(erased,'.wrangler/state/v3')},remoteBindings:false})
    try { assert.equal((await proxy.env.DB.prepare('SELECT name FROM l_staff WHERE id=?').bind(p.id).first()).name,'Erased staff') }
    finally { await proxy.dispose() }
  } finally { if(h)await h.close();await rm(temporary,{recursive:true,force:true}) }
})

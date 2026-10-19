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
test('ARCHIVE-001 and AUDIT-001: public CLI archive round trip carries staff, schedules, corrected payroll and import history, excludes authority, refuses damaged or populated stores, keeps activity across restart and restore, and respects erasure', { timeout: 300_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(),'lanyard-archive-')), source=join(temporary,'source'), restored=join(temporary,'restored'), erased=join(temporary,'erased')
  let h
  try {
    for (const path of [source,restored,erased]) await checkout(path)
    await exec(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'], { cwd:source, env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}, maxBuffer:2e6 })
    h=await harness({root:source})
    const p=await h.cmd('staff.save',{name:'Temporary joiner',email:'temporary@venue.example',payrollId:'TEMP',role:'staff',active:false})
    const agentKey=await h.cmd('agent.create',{label:'Excluded secret'})
    // A working installation: an active employee on a published week, approved and corrected hours exported twice, and a staff CSV import with its journal.
    const alex=await h.person('Alex')
    await h.cmd('availability.save',{staffId:alex.id,start:'2026-10-12T07:00:00Z',end:'2026-10-19T07:00:00Z'})
    const week=await h.cmd('roster.prepare',{week:'2026-10-12',shifts:[{...work(alex.id),label:'Morning service'}]});await h.cmd('roster.publish',{id:week.id,revision:week.revision})
    const first=await h.cmd('time.approve',{id:(await h.cmd('time.prepare',{...work(alex.id),reason:'Paper sheet'})).id,revision:1})
    const batch=await h.cmd('payroll.prepare',{}),exported=await h.cmd('payroll.export',{id:batch.id,revision:batch.revision})
    await h.cmd('payroll.acknowledge',{id:batch.id,revision:exported.revision,reference:'Payroll-import-101'})
    const fix=await h.cmd('time.prepare',{...work(alex.id),breakMinutes:45,corrects:first.id,reason:'Break correction agreed with Alex'});await h.cmd('time.approve',{id:fix.id,revision:1})
    const delta=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',{id:delta.id,revision:1})
    const files=Object.fromEntries(await Promise.all([batch.id,delta.id].map(async id=>[id,(await h.send(`/api/lanyard/batches/${id}.csv`,undefined,h.owner)).text])))
    assert.match(files[batch.id],/450,7\.5000/);assert.match(files[delta.id],/-15,-0\.2500/)
    const csv=await readFile('tests/fixtures/staff.csv','utf8'),imported=await h.cmd('import.apply',{csv,fingerprint:(await h.cmd('import.preview',{csv})).fingerprint})
    const journal=await h.cmd('import.journal',{jobId:imported.job.id}),original=await h.state()
    const identity={auth:h.auth,owner:h.owner}
    await h.close();h=null
    const old=join(temporary,'before.rer'),later=join(temporary,'later.rer'),again=join(temporary,'again.rer')
    await command(source,['export','--output',old,'--no-queue'])
    const bytes=await readFile(old,'utf8');assert.ok(bytes.includes('Temporary joiner'));assert.ok(!bytes.includes('Excluded secret'));assert.ok(!bytes.includes('token_hash'))
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
    for(const kind of ['staff','rosters','shifts','timesheets','batches'])assert.deepEqual(back[kind],original[kind],kind)
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

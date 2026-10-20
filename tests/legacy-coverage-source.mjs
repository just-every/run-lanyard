// COVER-003: capture a real native pre-pin offer. Launched in the legacy
// checkout so its bundler and worker resolve that checkout's production code.
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {harness}=await import(pathToFileURL(join(process.cwd(),'tests/harness.mjs')).href)
const h=await harness({root:process.argv[2]})
try{
 const ana=await h.person('Ana'),ben=await h.person('Ben')
 const date=new Date();date.setUTCDate(date.getUTCDate()+7+(8-date.getUTCDay())%7)
 const week=date.toISOString().slice(0,10),start=week+'T18:00:00Z',end=week+'T21:00:00Z'
 for(const p of [ana,ben])await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:week+'T23:59:00Z'})
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:ana.id,start,end,breakMinutes:0}]})
 await h.cmd('roster.publish',{id:draft.id,revision:draft.revision})
 const shift=(await h.state()).shifts.find(x=>x.status==='published')
 const called=await h.cmd('shift.callout',{id:shift.id,revision:shift.revision,note:'Legacy acceptance kept for review'},ana.cookie)
 const yes=await h.cmd('cover.respond',{id:called.offers[0].id,revision:called.offers[0].revision,decision:'accepted'},ben.cookie)
 assert.equal(yes.shiftRevision,undefined,'the source is genuinely pre-pin production code')
 await writeFile(process.argv[3],JSON.stringify({ana:{id:ana.id},ben:{id:ben.id,email:ben.email},called:{shift:{id:called.shift.id}},yes}),{mode:0o600})
}finally{await h.close()}

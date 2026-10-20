// LOG-001: capture old native receipt revisions in a pre-content-revision checkout.
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {harness}=await import(pathToFileURL(join(process.cwd(),'tests/harness.mjs')).href)
const h=await harness({root:process.argv[2]})
try{
 const priya=await h.person('Priya','manager'),omar=await h.person('Omar','manager')
 const first=await h.cmd('log.save',{site:'',date:'2026-10-12',category:'incident',text:'Original closing note',attachment:{name:'floor.txt',type:'text/plain',data:Buffer.from('legacy floor inspection').toString('base64')}},priya.cookie)
 const read=await h.cmd('log.read',{id:first.id,revision:first.revision},omar.cookie)
 const edit=await h.cmd('log.save',{id:first.id,revision:read.revision,date:'2026-10-12',category:'incident',text:'Corrected closing note'},priya.cookie)
 const last=await h.cmd('log.read',{id:edit.id,revision:edit.revision},omar.cookie)
 assert.equal(last.contentRevision,undefined,'capture genuine pre-content-revision production records')
 await writeFile(process.argv[3],JSON.stringify({id:first.id,fileId:first.attachment.id,omar:omar.email,priya:priya.email,rawReadRevisions:last.reads.map(r=>r.revision),originalReads:last.reads}),{mode:0o600})
}finally{await h.close()}

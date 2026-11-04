// Additional public-door fixtures in the declared conformance journey. All
// identities and signatures belong only to disposable native installations.
import assert from 'node:assert/strict'
import {randomUUID,webcrypto} from 'node:crypto'
import {harness} from './harness.mjs'
import initializeHistory from './agent-history.mjs'
import {signJws,policyEnvelope,autonomousPolicy} from '../src/modules/agent-door/conformance/crypto.mjs'

export default async function ({tool}) {
 const visible=await tool('lanyard.context.read',{})
 assert.equal(visible.status,200)
 await identityProof()
}

export async function identityProof() {
 const clock=Date.parse('2026-11-04T12:00:00Z')
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 const publicKey=await webcrypto.subtle.exportKey('jwk',pair.publicKey),kid=randomUUID(),issuer='https://synthetic-business.example.invalid',installationId=randomUUID()
 const keys={[kid]:publicKey},owner='business-owner',member='business-member'
 const h=await harness({now:new Date(clock).toISOString(),auth:{RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys),RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:'self-host',subject:installationId,email:'owner@venue.example',keys})}})
 try {
  const signer={privateKey:pair.privateKey,kid,issuer,installationId},business='synthetic-workforce',now=()=>Math.floor(clock/1000)
  const settings=await signJws(pair.privateKey,kid,'rer-business-settings+jwt',{v:1,iss:issuer,aud:'self-host',sub:installationId,business,email:h.auth.OWNER_EMAIL,owner_id:owner,jti:randomUUID(),iat:now(),exp:now()+300,rev:1,values:{},logo:null,team:[{id:member,email:'sasha@synthetic.example.invalid',name:'Sasha Kim',role:'admin',invite:1}]})
  assert.equal((await h.send('/api/rer/business-settings',{settings})).status,200)
  const policy=await policyEnvelope({now:()=>clock,signer,origin:h.origin,business,seq:0,revision:0},autonomousPolicy())
  assert.equal((await h.send('/api/rer/agent-policy',{policy:policy.policy})).status,200)
  const token=overrides=>signJws(pair.privateKey,kid,'at+jwt',{iss:issuer,aud:h.origin+'/mcp',sub:owner,email:h.auth.OWNER_EMAIL,act:{sub:'synthetic-coordinator',name:'Sage',specialist:'workforce coordinator'},client_id:'synthetic-client',scope:'workforce:read workforce:prepare',business,consent:'synthetic-consent',jti:randomUUID(),iat:now(),exp:now()+300,...overrides})
  const call=async(overrides={},name='lanyard.context.read',args={},requestState)=>h.send('/mcp',{jsonrpc:'2.0',id:'identity',method:'tools/call',params:{name,arguments:args,requestState,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{authorization:'Bearer '+await token(overrides),'mcp-protocol-version':'2026-07-28','mcp-method':'tools/call','mcp-name':name})
  const valid=await call();assert.equal(valid.status,200);assert.equal(valid.value.result.isError,false)
  const nativeId=valid.value.result.structuredContent.actor.id
  assert.equal((await call({sub:'unknown-subject'})).status,401,'a matching owner email never selects an unknown subject')
  assert.equal((await call({sub:member,email:'sasha@synthetic.example.invalid',act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}})).status,401,'an OA account without native workforce admission cannot sponsor')
  assert.equal((await call({consent:undefined})).status,401,'Business consent is required')
  const moved=await call({email:'renamed@synthetic.example.invalid'})
  assert.equal(moved.status,401,'a changed token email is refused without moving the Business binding')
  assert.equal((await call()).value.result.structuredContent.actor.id,nativeId,'the original native sponsor binding remains unchanged')
  await h.confirmMail('sasha@synthetic.example.invalid')
  const staff=await h.cmd('staff.save',{name:'Sasha Kim',email:'sasha@synthetic.example.invalid',payrollId:'SASHA',active:true,role:'manager'})
  const nativeEditor=await h.signIn('sasha@synthetic.example.invalid')
  assert.equal((await h.send('/agents/api/state',undefined,nativeEditor)).status,200,'a signed Business admin is a policy editor without acquiring native owner authority')
  const narrowed=await call({sub:member,email:'sasha@synthetic.example.invalid',act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}})
  assert.equal(narrowed.value.result._meta['com.runeditrun/error'].code,'native_authority_required','a Business admin retains native preparation limits')
  await h.cmd('staff.save',{id:staff.id,revision:staff.revision,name:staff.name,email:staff.email,payrollId:staff.payrollId,active:false,role:'manager'})
  assert.equal((await call({sub:member,email:'sasha@synthetic.example.invalid',act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}})).status,401,'native deactivation stops the next call')
  const worker=await h.cmd('staff.save',{name:'Alex Rivera',email:'alex@synthetic.example.invalid',payrollId:'ALEX',active:true,role:'staff',site:'Ocean Beach'})
  const privateGrant=await h.cmd('agent.create',{label:'Local-only comparison',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true})
  const borrowed=await call({scope:'comparison.read lanyard:local-key',client_id:privateGrant.id,act:{sub:'lanyard-key:'+privateGrant.id,name:'Pretended local key'}},'lanyard.demand.read',{site:'Ocean Beach',date:'2026-01-19'})
  assert.equal(borrowed.value.result._meta['com.runeditrun/error'].code,'resource_unavailable','a signed Business token cannot borrow a local key grant')
  const unused=await h.cmd('staff.save',{name:'Unused but disclosed',email:'disclosed@synthetic.example.invalid',payrollId:'DISCLOSED',active:false,role:'staff'})
  assert.equal((await call()).value.result.isError,false)
  await h.cmd('staff.erase',{id:unused.id,revision:unused.revision},h.owner,409)
  const hold={schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'named-owner',class:'*',do:'approval',approver:['sponsor'],wait:'PT1H'}],spend:{none:true}}
  const held=await policyEnvelope({now:()=>clock,signer,origin:h.origin,business,seq:1,revision:1},hold)
  assert.equal((await h.send('/api/rer/agent-policy',{policy:held.policy})).status,200)
  const args={week:'2026-01-19',shifts:[{staffId:worker.id,start:'2026-01-19T10:00:00Z',end:'2026-01-19T12:00:00Z',breakMinutes:0}],idempotency_key:'native-approval-proof'}
  const before=await h.state(),pending=await call({},'lanyard.roster.prepare',args)
  const approval=pending.value.result._meta['com.runeditrun/approval']
  assert.ok(approval?.id);assert.equal((await h.state()).version,before.version)
  const view=(await h.send('/agents/api/approvals/'+approval.id,undefined,h.owner)).value.approval
  assert.equal(view.prepared_by.label,'Sage for Jordan Venue');assert.ok(view.summary_sha256)
  const decision={revision:view.revision,summary_sha256:view.summary_sha256}
  assert.equal((await h.send('/agents/api/approvals/'+approval.id+'/approve',decision,'',{authorization:'Bearer '+await token({})})).status,403)
  assert.equal((await h.send('/agents/api/approvals/'+approval.id+'/approve',decision,h.owner)).status,200)
  const complete=await call({},'lanyard.roster.prepare',args,pending.value.result.requestState)
  assert.equal(complete.value.result.isError,false)
  const effect=await h.state(),draft=effect.rosters.find(r=>r.week===args.week)
  assert.equal(draft.preparedByLabel,'Sage for Jordan Venue');assert.equal(draft.policyApprovers[0].id,nativeId)
  const repeated=await call({},'lanyard.roster.prepare',args,pending.value.result.requestState)
  assert.equal(repeated.value.result.isError,false);assert.equal((await h.state()).version,effect.version)
  const changed=await call({},'lanyard.roster.prepare',{...args,shifts:[{...args.shifts[0],label:'Changed after decision'}]})
  assert.equal(changed.value.result._meta['com.runeditrun/error'].code,'idempotency_conflict')
  const open=await policyEnvelope({now:()=>clock,signer,origin:h.origin,business,seq:2,revision:2},autonomousPolicy())
  assert.equal((await h.send('/api/rer/agent-policy',{policy:open.policy})).status,200)
  const stale=await call({},'lanyard.roster.prepare',{...args,idempotency_key:'stale-source-proof',expected_revision:before.version})
  assert.equal(stale.value.result._meta['com.runeditrun/error'].code,'revision_conflict')
  const time={staffId:worker.id,start:'2026-01-06T10:00:00Z',end:'2026-01-06T12:00:00Z',breakMinutes:0,reason:'Synthetic omitted punch for native review',idempotency_key:'first-policy-time'}
  const first=await call({},'lanyard.time.prepare',time)
  assert.equal(first.value.result.isError,false)
  const firstState=await h.state()
  const overlap=await call({},'lanyard.time.prepare',{...time,idempotency_key:'overlapping-time'})
  assert.equal(overlap.value.result._meta['com.runeditrun/error'].code,'native_conflict')
  assert.equal((await h.state()).version,firstState.version,'overlap refusal preserves the native witness')
  const reviewPolicy={...autonomousPolicy(),rules:[{id:'review-preparation',class:'*',do:'review'}],reviewers:['sponsor']}
  const reviewed=await policyEnvelope({now:()=>clock,signer,origin:h.origin,business,seq:3,revision:3},reviewPolicy)
  assert.equal((await h.send('/api/rer/agent-policy',{policy:reviewed.policy})).status,200)
  const second=await call({},'lanyard.time.prepare',{...time,start:'2026-01-07T10:00:00Z',end:'2026-01-07T12:00:00Z',idempotency_key:'second-policy-time'})
  assert.equal(second.value.result.isError,false,'a distinct native interval succeeds under review policy')
  assert.equal((await h.state()).timesheets.filter(t=>t.staffId===worker.id).length,2)
  await h.cmd('agent.create',{label:'Company learning reader',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true,companyAgents:true})
  await h.cmd('settings.save',{timezone:'UTC'})
  await initializeHistory({request:(url,options)=>h.mf.dispatchFetch(url,options),origin:h.origin,cookie:h.owner})
  const evidence=await call({scope:'comparison.read'},'lanyard.learn.read',{site:'Ocean Beach',weeks:2})
  assert.equal(evidence.value.result.isError,false)
  const learning=evidence.value.result.structuredContent
  assert.equal(learning.status,'insufficient');assert.equal(learning.proposal,null)
  const noHistory=await h.state()
  const proposal=await call({scope:'comparison.read'},'lanyard.learn.propose',{site:'Ocean Beach',weeks:2,digest:learning.digest,idempotency_key:'insufficient-history-proposal'})
  assert.equal(proposal.value.result._meta['com.runeditrun/error'].code,'native_conflict')
  assert.equal((await h.state()).version,noHistory.version,'unknown historical outcomes cannot produce a proposal')
  console.log('PASS LANYARD-FIXTURES: distinct time intervals succeed under autonomous and review policies; overlap and insufficient learning history refuse without native effects')
  assert.equal((await h.send('/agents/api/pause',{paused:true},h.owner)).status,200)
  const paused=await call({},'lanyard.roster.prepare',{...args,idempotency_key:'paused-source-proof'})
  assert.equal(paused.value.result._meta['com.runeditrun/error'].code,'agents_paused')
  assert.equal((await h.state()).version,noHistory.version)
  console.log('PASS LANYARD-NATIVE: exact-summary named approval; agent decision refused; native attribution and approver; one-effect replay; argument conflict; stale revision; Pause without an effect')
  const audit=(await h.send('/agents/api/audit',undefined,h.owner)).value
  assert.equal(audit.differs_from_policy,0)
  console.log('PASS LANYARD-IDENTITY: valid scoped owner; unknown subject; inadmissible workforce member; missing consent; changed-email refusal with unchanged binding; native admin limits; immediate deactivation; audit differs_from_policy=0')
  await payrollSelectionProof({h,call,token,signer,business,nativeId,clock})
 } finally {await h.close()}
}

async function payrollSelectionProof({h,call,token,signer,business,nativeId,clock}) {
 assert.equal((await h.send('/agents/api/pause',{paused:false},h.owner)).status,200)
 const pin=r=>({id:r.id,revision:r.revision}),tool='lanyard.payroll.prepare'
 const worker=await h.person('SyntheticLanyardPayroll'),reviewer=await h.person('SyntheticLanyardReviewer','manager')
 const group=await h.cmd('paygroup.save',{name:'Synthetic ordinary work',cadence:'semimonthly',from:'2026-10-01',payDays:5,workweekStart:0,staffIds:[worker.id]})
 let first=await h.cmd('paygroup.period',{groupId:group.id,date:'2026-10-12'}),second=await h.cmd('paygroup.period',{groupId:group.id,date:'2026-10-19'})
 const enter=async(date,end)=>{
  const prepared=await h.cmd('time.prepare',{staffId:worker.id,start:`${date}T10:00:00Z`,end:`${date}T${end}:00:00Z`,breakMinutes:0,reason:'Synthetic reviewed ordinary work'})
  return h.cmd('time.approve',pin(prepared),reviewer.cookie)
 }
 const eligible=await enter('2026-10-12','12'),held=await enter('2026-10-19','13')
 const lock=async period=>{
  period=await h.cmd('period.signoff',pin(period),worker.cookie)
  period=await h.cmd('period.signoff',pin(period),reviewer.cookie)
  return h.cmd('period.lock',pin(period))
 }
 first=await lock(first)
 assert.deepEqual([first.status,second.status],['locked','open'])
 const sources=structuredClone((await h.state()).timesheets)
 let sequence=4
 const policy=async(mode,max=1)=>{
  const document={...autonomousPolicy(),rules:[{id:'larger-call',class:'*',do:'blocked'},{id:'ordinary-sources',class:'standard',max,do:mode,...(mode==='approval'?{approver:['sponsor'],wait:'PT1H'}:{})}],...(mode==='review'?{reviewers:['sponsor']}:{})}
  const signed=await policyEnvelope({now:()=>clock,signer,origin:h.origin,business,seq:sequence,revision:sequence},document)
  sequence++
  assert.equal((await h.send('/api/rer/agent-policy',{policy:signed.policy})).status,200)
 }
 const meta=result=>result.value.result._meta,decision=result=>meta(result)['com.runeditrun/decision']
 const claims=async()=>(await h.db.prepare('SELECT * FROM l_payroll_claims ORDER BY time_id,time_revision').all()).results
 const facts=(result,measure,disposition)=>{
  assert.equal(result.status,200)
  assert.deepEqual(decision(result).classes.map(({class:cls,facts})=>({class:cls,facts})),[{class:'standard',facts:{measure}}])
  assert.equal(decision(result).disposition,disposition)
 }
 const summary=rows=>rows.map(t=>`${worker.name}: ${t.start} to ${t.end}; ${t.minutes} approved minutes; source ${t.id} revision ${t.revision}`)
 const draft=async(result,rows)=>{
  assert.equal(result.value.result.isError,false)
  const answer=result.value.result.structuredContent.result,state=await h.state(),batch=state.batches.find(b=>b.id===answer.id)
  assert.equal(batch.status,'draft');assert.equal(batch.preparedByLabel,'Sage for Jordan Venue')
  assert.deepEqual(batch.lines.map(l=>[l.timeId,l.revision,l.minutes]),rows.map(t=>[t.id,t.revision,t.id===eligible.id?120:180]))
  assert.deepEqual(await claims(),[],'preparation never claims or exports hours')
  assert.deepEqual(state.timesheets,sources,'preparation never changes approved work')
  return batch
 }
 const approval=async pending=>{
  const id=meta(pending)['com.runeditrun/approval'].id
  return (await h.send('/agents/api/approvals/'+id,undefined,h.owner)).value.approval
 }
 const approve=async view=>h.send('/agents/api/approvals/'+view.id+'/approve',{revision:view.revision,summary_sha256:view.summary_sha256},h.owner)
 const replay=async(args,completed,requestState)=>{
  await h.restart()
  const before=await h.state(),beforeClaims=await claims(),repeated=await call({},tool,args,requestState)
  assert.equal(repeated.value.result.isError,false)
  assert.deepEqual(repeated.value.result.structuredContent,completed.value.result.structuredContent)
  assert.deepEqual(await h.state(),before,'completed replay after restart has no native effect')
  assert.deepEqual(await claims(),beforeClaims,'completed replay never changes source claims')
 }
 for(const mode of ['autonomous','review','approval']) {
  await policy(mode)
  const before=await h.state(),args={idempotency_key:`synthetic-lanyard-${mode}-one`,expected_revision:before.version}
  const result=await call({},tool,args);facts(result,1,mode)
  let completed=result
  if(mode==='approval') {
   assert.deepEqual(await h.state(),before,'named approval waits without native writes')
   const view=await approval(result)
   assert.deepEqual(view.summary.items,summary([eligible]));assert.deepEqual(view.classes,[{class:'standard',facts:{measure:1}}])
   assert.equal((await h.send('/agents/api/approvals/'+view.id+'/approve',{revision:view.revision,summary_sha256:view.summary_sha256},'',{authorization:'Bearer '+await token({})})).status,403)
   assert.deepEqual(await h.state(),before,'an agent cannot supply the named human approval')
   assert.equal((await approve(view)).status,200)
   completed=await call({},tool,args,result.value.result.requestState)
  }
  const batch=await draft(completed,[eligible])
  assert.deepEqual(batch.held.map(t=>t.timeId),[held.id])
  if(mode==='review') {
   const reviews=(await h.send('/agents/api/reviews',undefined,h.owner)).value.reviews
   const review=reviews.find(r=>r.decision_id===decision(result).id)
   assert.deepEqual(review.summary.items,summary([eligible]));assert.deepEqual(review.classes,[{class:'standard',facts:{measure:1}}])
  }
  if(mode==='approval')assert.equal(batch.policyApprovers[0].id,nativeId)
  await replay(args,completed,result.value.result.requestState)
  console.log(`PROBE BASE-AGENT-006 ${mode}: MCP ordinary payroll with one locked and one open source -> measure 1, eligible-only draft, completed replay after restart`)
 }
 await policy('autonomous')
 const beforeHeld=await h.state()
 const unavailable=await call({},tool,{ids:[held.id],idempotency_key:'synthetic-lanyard-held-selection'})
 facts(unavailable,0,'autonomous')
 assert.equal(meta(unavailable)['com.runeditrun/error'].code,'native_conflict')
 const heldAudit=(await h.send('/agents/api/audit',undefined,h.owner)).value.rows.find(r=>r.id===decision(unavailable).id)
 assert.deepEqual(heldAudit.classes,[{class:'standard',facts:{measure:0}}]);assert.equal(heldAudit.outcome,'refused')
 assert.deepEqual(await h.state(),beforeHeld,'explicit held time refuses without writes')
 const duplicates=await call({},tool,{ids:[eligible.id,eligible.id],idempotency_key:'synthetic-lanyard-duplicate-selection'})
 facts(duplicates,1,'autonomous')
 assert.equal(meta(duplicates)['com.runeditrun/error'].code,'invalid_arguments')
 assert.deepEqual(await h.state(),beforeHeld,'duplicate source IDs cannot duplicate prepared time')
 await policy('approval')
 const staleArgs={expected_revision:beforeHeld.version,idempotency_key:'synthetic-lanyard-stale-payroll'}
 const pending=await call({},tool,{idempotency_key:'synthetic-lanyard-changing-period'})
 const pendingView=await approval(pending)
 assert.deepEqual(pendingView.summary.items,summary([eligible]))
 second=await lock(second)
 const afterLock=await h.state()
 const changed=await approve(pendingView)
 assert.equal(changed.value.approval.state,'refused');assert.equal(changed.value.approval.code,'approval_evidence_changed')
 assert.deepEqual(await h.state(),afterLock,'changed eligibility cannot execute an earlier reviewed summary')
 const stale=await call({},tool,staleArgs)
 assert.equal(meta(stale)['com.runeditrun/error'].code,'revision_conflict')
 assert.equal(meta(stale)['com.runeditrun/error'].current_revision,afterLock.version)
 assert.deepEqual(await h.state(),afterLock,'stale expected revision refuses without writes')
 for(const mode of ['autonomous','review','approval']) {
  await policy(mode)
  const before=await h.state(),result=await call({},tool,{idempotency_key:`synthetic-lanyard-${mode}-two`})
  facts(result,2,'blocked');assert.equal(result.value.result.isError,true)
  const audit=(await h.send('/agents/api/audit',undefined,h.owner)).value
  const row=audit.rows.find(r=>r.id===decision(result).id)
  assert.deepEqual(row.classes,[{class:'standard',facts:{measure:2}}]);assert.equal(row.outcome,'refused')
  assert.equal(audit.differs_from_policy,0)
  assert.deepEqual(await h.state(),before,'two eligible sources exceed the one-source per-call threshold without writes')
  assert.deepEqual(await claims(),[],'policy refusal leaves source claims empty')
  console.log(`PROBE BASE-AGENT-006 ${mode}-threshold: lock second period then MCP payroll -> measure 2, blocked at max 1, refused audit retains facts, no native writes`)
 }
 // Explicit subsets count the selected eligible sources, rather than every available source.
 await policy('review')
 const subset=await call({},tool,{ids:[held.id],idempotency_key:'synthetic-lanyard-subset'})
 facts(subset,1,'review');await draft(subset,[held])
 await policy('approval',2)
 const args={idempotency_key:'synthetic-lanyard-both-reviewed'},both=await call({},tool,args)
 facts(both,2,'approval')
 const bothView=await approval(both)
 assert.deepEqual(bothView.summary.items,summary([eligible,held]))
 assert.equal((await approve(bothView)).status,200)
 const completed=await call({},tool,args,both.value.result.requestState),batch=await draft(completed,[eligible,held])
 await replay(args,completed,both.value.result.requestState)
 const key=await h.cmd('agent.create',{label:'Synthetic preparation key'})
 const beforeExport=await h.state()
 assert.equal((await h.send('/api/lanyard/agent/command',{name:'payroll.export',input:pin(batch)},'',{authorization:'Bearer '+key.token})).status,403)
 assert.deepEqual(await h.state(),beforeExport,'preparation credentials cannot export payroll')
 const exported=await h.cmd('payroll.export',pin(batch))
 assert.equal(exported.status,'exported');assert.equal(exported.lines.reduce((n,l)=>n+l.minutes,0),300)
 const afterExport=await h.state()
 assert.deepEqual((await claims()).map(c=>c.time_id).sort(),[eligible.id,held.id].sort())
 assert.deepEqual(afterExport.timesheets,sources)
 await replay(args,completed,both.value.result.requestState)
 assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text,exported.csv)
 await policy('autonomous')
 const afterDownload=await h.state(),exportedClaims=await claims()
 const claimed=await call({},tool,{ids:[eligible.id],idempotency_key:'synthetic-lanyard-claimed-selection'})
 facts(claimed,0,'autonomous')
 assert.equal(meta(claimed)['com.runeditrun/error'].code,'native_conflict')
 assert.deepEqual(await h.state(),afterDownload,'claimed sources cannot be prepared again by explicit selection')
 assert.deepEqual(await claims(),exportedClaims)
 console.log('PROBE BASE-AGENT-006 source-review: stale revision and changed pending approval refuse; subset measures 1; max 2 reviews both sources; only human export claims 300 minutes; restart replay and download remain unchanged')
}

// Additional public-door fixtures in the declared conformance journey. All
// identities and signatures belong only to disposable native installations.
import assert from 'node:assert/strict'
import {randomUUID,webcrypto} from 'node:crypto'
import {harness} from './harness.mjs'
import initializeHistory from './agent-history.mjs'
import {optimizationFixture} from './fairness-optimization-fixture.mjs'
import {signJws,policyEnvelope,autonomousPolicy} from '../src/modules/agent-door/conformance/crypto.mjs'

export default async function ({tool}) {
 const visible=await tool('lanyard.context.read',{})
 assert.equal(visible.status,200)
 await identityProof()
 await comparisonAttributionProof()
}

async function signedInstallation() {
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 const publicKey=await webcrypto.subtle.exportKey('jwk',pair.publicKey),kid=randomUUID(),issuer='https://synthetic-business.example.invalid',installationId=randomUUID()
 const keys={[kid]:publicKey},owner='business-owner',member='business-member'
 const h=await harness({auth:{RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys),RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:'self-host',subject:installationId,email:'owner@venue.example',keys})}})
 try {
  const signer={privateKey:pair.privateKey,kid,issuer,installationId},business='synthetic-workforce',now=()=>Math.floor(Date.now()/1000)
  const settings=await signJws(pair.privateKey,kid,'rer-business-settings+jwt',{v:1,iss:issuer,aud:'self-host',sub:installationId,business,email:h.auth.OWNER_EMAIL,owner_id:owner,jti:randomUUID(),iat:now(),exp:now()+300,rev:1,values:{},logo:null,team:[{id:member,email:'sasha@synthetic.example.invalid',name:'Sasha Kim',role:'admin',invite:1}]})
  assert.equal((await h.send('/api/rer/business-settings',{settings})).status,200)
  const policy=await policyEnvelope({signer,origin:h.origin,business,seq:0,revision:0},autonomousPolicy())
  assert.equal((await h.send('/api/rer/agent-policy',{policy:policy.policy})).status,200)
  const token=overrides=>signJws(pair.privateKey,kid,'at+jwt',{iss:issuer,aud:h.origin+'/mcp',sub:owner,email:h.auth.OWNER_EMAIL,act:{sub:'synthetic-coordinator',name:'Sage',specialist:'workforce coordinator'},client_id:'synthetic-client',scope:'workforce:read workforce:prepare',business,consent:'synthetic-consent',jti:randomUUID(),iat:now(),exp:now()+300,...overrides})
  const call=async(overrides={},name='lanyard.context.read',args={},requestState)=>h.send('/mcp',{jsonrpc:'2.0',id:'identity',method:'tools/call',params:{name,arguments:args,requestState,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{authorization:'Bearer '+await token(overrides),'mcp-protocol-version':'2026-07-28','mcp-method':'tools/call','mcp-name':name})
  return {h,signer,business,member,token,call}
 } catch(error) {await h.close();throw error}
}

export async function identityProof() {
 const {h,signer,business,member,token,call}=await signedInstallation()
 try {
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
  const held=await policyEnvelope({signer,origin:h.origin,business,seq:1,revision:1},hold)
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
  const open=await policyEnvelope({signer,origin:h.origin,business,seq:2,revision:2},autonomousPolicy())
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
  const reviewed=await policyEnvelope({signer,origin:h.origin,business,seq:3,revision:3},reviewPolicy)
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
 } finally {await h.close()}
}

// Shared by normal agent conformance and the existing comparison browser journey.
// Only the historical receipt is seeded: current reads use signed native doors.
export async function comparisonAttributionFixture() {
 const {h,call}=await signedInstallation()
 try {
  const f=await optimizationFixture(h),sponsor='Jordan <venue> & "owner"'
  assert.equal((await h.send('/auth/display-name',{displayName:sponsor},h.owner)).status,200)
  const label='Shared <comparison> & "grant"',key=await h.cmd('agent.create',{label,scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true,companyAgents:true})
  const agents=[{id:'synthetic-lanyard-1',name:'Sage <plan> & "crew"'},{id:'synthetic-lanyard-2',name:'River & <review>'}]
  const workforce=async()=>(await h.db.batch(['l_meta','l_staff','l_records','l_payroll_claims','l_commands'].map(table=>h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))).map(result=>result.results)
  const expected=[],before=await h.state(),beforeRecords=await workforce(),native=await f.read()
  for(const agent of [...agents,{id:'lanyard-key:'+key.id,name:label}]) {
   const seen=new Set((await h.state()).events.map(e=>e.id))
   const r=agent===agents[0]||agent===agents[1]
    ?await call({scope:'comparison.read',act:{sub:agent.id,name:agent.name,specialist:'workforce coordinator'}},'lanyard.tradeoff.compare',{site:'Ocean Beach',week:f.week})
    :await h.send(f.path.replace('/fairness/','/agent/fairness/'),undefined,'',{authorization:'Bearer '+key.token})
   assert.equal(r.status,200,r.text)
   const result=r.value.result?.structuredContent??r.value
   assert.equal(result.status,'known');assert.equal(result.low.cost.total.status,'small-cell');assert.equal(result.low.cost.total.cents,null)
   assert.deepEqual(result.low.assignments,native.low.assignments)
   for(const p of [f.alex,f.ben,f.manager,f.foreign])for(const value of [p.name,p.email,p.payrollId])assert.ok(!JSON.stringify(result).includes(value),'Comparison remains redacted')
   const events=(await h.state()).events.filter(e=>!seen.has(e.id)&&e.action==='comparison.read')
   assert.equal(events.length,1,'Each actual read creates one retained receipt')
   const event=events[0]
   assert.equal(event.agentId,agent.id);assert.equal(event.agentName,agent.name);assert.equal(event.sponsorName,sponsor)
   assert.equal(event.actorLabel,`${agent.name} for ${sponsor}`)
   assert.equal(JSON.parse(event.entityId).keyId,key.id,'All three actors use the same explicitly consented grant')
   expected.push({id:event.id,agentId:agent.id,agentName:agent.name,sponsorName:sponsor,label:`${agent.name} for ${sponsor}`,operationId:event.operationId,at:event.at})
  }
  // These old receipts predate retained attribution. A current matching key is
  // deliberately present, and even incomplete names must not be backfilled.
  const historical=['synthetic-lanyard-history-1','synthetic-lanyard-history-2','synthetic-lanyard-history-3']
  for(const [i,id] of historical.entries())await h.db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at,agent_id,agent_name,sponsor_name) VALUES(?,?,?, ?,?,?,?,?,?)')
   .bind(id,before.actor.id,'agent','comparison.read',JSON.stringify({keyId:key.id,site:'Ocean Beach',week:f.week}),new Date().toISOString(),i?'synthetic-historical-agent':null,i===1?'Retained old agent':null,i===2?'Retained old sponsor':null).run()
  const historicalEvents=(await h.state()).events.filter(e=>historical.includes(e.id))
  assert.equal(historicalEvents.length,3);assert.ok(historicalEvents.every(e=>e.actorLabel===null))
  assert.deepEqual(await workforce(),beforeRecords,'Reads and receipt projection do not change persisted workforce records')
  // A later account name and registration update cannot rename the old acts.
  assert.equal((await h.send('/auth/display-name',{displayName:'Current owner name'},h.owner)).status,200)
  const seen=new Set((await h.state()).events.map(e=>e.id))
  const renamed=await call({scope:'comparison.read',act:{sub:agents[0].id,name:'Current agent name',specialist:'workforce coordinator'}},'lanyard.tradeoff.compare',{site:'Ocean Beach',week:f.week})
  assert.equal(renamed.value.result.isError,false)
  const current=(await h.state()).events.filter(e=>e.action==='comparison.read'&&!seen.has(e.id))
  assert.equal(current.length,1)
  expected.push({id:current[0].id,agentId:agents[0].id,agentName:'Current agent name',sponsorName:'Current owner name',label:'Current agent name for Current owner name',operationId:current[0].operationId,at:current[0].at})
  const check=async()=>{
   const state=await h.state(),audit=await h.send('/agents/api/audit',undefined,h.owner)
   assert.equal(audit.status,200);assert.equal(audit.value.differs_from_policy,0)
   for(const item of expected) {
    const receipt=await h.db.prepare('SELECT agent_id,agent_name,sponsor_name,operation_id,at FROM l_events WHERE id=?').bind(item.id).first()
    assert.deepEqual(receipt,{agent_id:item.agentId,agent_name:item.agentName,sponsor_name:item.sponsorName,operation_id:item.operationId,at:item.at})
    const event=state.events.find(e=>e.id===item.id),row=audit.value.rows.find(r=>r.operation_id===item.operationId&&r.tool==='lanyard.tradeoff.compare'&&r.outcome==='done')
    assert.ok(row,'Receipt reconciles to a completed shared-door audit')
    assert.equal(event.actorLabel,item.label);assert.equal(row.label,item.label)
    assert.equal(row.agent.id,item.agentId);assert.equal(row.agent.name,item.agentName)
    assert.equal(row.sponsor.id,before.actor.id);assert.equal(row.sponsor.name,item.sponsorName)
   }
   assert.deepEqual(await workforce(),beforeRecords,'Projection and refusals preserve persisted workforce records')
   const ownerPage=await h.send('/app/agent',undefined,h.owner);assert.equal(ownerPage.status,200)
   for(const cookie of [f.manager.cookie,f.foreign.cookie,f.alex.cookie]) {
    assert.ok(!(await h.state(cookie)).events.some(e=>e.action==='comparison.read'))
    const page=await h.send('/app/agent',undefined,cookie)
    assert.ok(!page.text.includes('data-comparison-read='));assert.ok(!page.text.includes('Comparison read activity'))
   }
   return {state,ownerPage}
  }
  const refused=async()=>{
   const events=(await h.state()).events.filter(e=>e.action==='comparison.read')
   const foreign=await call({scope:'comparison.read'},'lanyard.tradeoff.compare',{site:'Mission',week:f.week})
   assert.equal(foreign.value.result._meta['com.runeditrun/error'].code,'resource_unavailable')
   assert.deepEqual((await h.state()).events.filter(e=>e.action==='comparison.read'),events,'Foreign cafe refusal creates no comparison receipt')
  }
  await h.finishSetup();await refused();await check()
  const revoke=async()=>{
   const events=(await h.state()).events.filter(e=>e.action==='comparison.read')
   await h.cmd('agent.revoke',{id:key.id})
   for(const agent of agents){
    const r=await call({scope:'comparison.read',act:{sub:agent.id,name:agent.name,specialist:'workforce coordinator'}},'lanyard.tradeoff.compare',{site:'Ocean Beach',week:f.week})
    assert.equal(r.value.result._meta['com.runeditrun/error'].code,'resource_unavailable');assert.equal(r.value.result.structuredContent,undefined)
   }
   const local=await h.send(f.path.replace('/fairness/','/agent/fairness/'),undefined,'',{authorization:'Bearer '+key.token})
   assert.equal(local.status,401)
   assert.deepEqual((await h.state()).events.filter(e=>e.action==='comparison.read'),events,'Revoked reads cannot append or disclose receipts')
   await check()
  }
  return {h,f,key,label,expected,historical,check,revoke}
 } catch(error) {await h.close();throw error}
}

export async function comparisonAttributionProof() {
 const fixture=await comparisonAttributionFixture()
 try {
  await fixture.h.restart();await fixture.check()
  await fixture.revoke();await fixture.h.restart();await fixture.check()
  console.log('PASS BASE-AGENT-008: two signed agents and a local key retain distinct attribution on one grant; historical attribution unavailable; audit reconciliation, restart, revocation, owner-only visibility, foreign refusal, redaction and unchanged workforce')
 } finally {await fixture.h.close()}
}

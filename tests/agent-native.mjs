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

// Additional public-door fixtures in the declared conformance journey. All
// identities and signatures belong only to disposable native installations.
import assert from 'node:assert/strict'
import {randomUUID,webcrypto} from 'node:crypto'
import {harness} from './harness.mjs'
import initializeHistory from './agent-history.mjs'
import {learnFixture} from './learn-demand-journey.mjs'
import {signJws,policyEnvelope,autonomousPolicy} from '../src/modules/agent-door/conformance/crypto.mjs'

export default async function ({tool}) {
 const visible=await tool('lanyard.context.read',{})
 assert.equal(visible.status,200)
 await identityProof()
 await learningResourceProof()
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
  const resource=async(uri,overrides={},requestState)=>h.send('/mcp',{jsonrpc:'2.0',id:'resource',method:'resources/read',params:{uri,requestState,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{authorization:'Bearer '+await token(overrides),'mcp-protocol-version':'2026-07-28','mcp-method':'resources/read','mcp-name':uri})
  const record=response=>{
   assert.equal(response.status,200);assert.equal(response.value.error,undefined)
   const content=response.value.result.contents
   assert.equal(content.length,1);assert.equal(content[0]._meta['com.runeditrun/untrusted'],true)
   return JSON.parse(content[0].text)
  }
  const link=response=>{
   assert.equal(response.value.result.isError,false)
   const links=response.value.result.content.filter(x=>x.type==='resource_link')
   assert.equal(links.length,1);return links[0].uri
  }
  const redacted=value=>{
   const walk=v=>{
    if(!v||typeof v!=='object')return
    for(const [key,child] of Object.entries(v)) {
     assert.ok(!['email','payrollId','payroll_id','rateBasis','rate_cents','hourlyRateCents','csv','csvPreview','fileBase64','token','token_hash','reference','contacts'].includes(key),`Private field ${key} stays absent`)
     walk(child)
    }
   };walk(value)
  }
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
  const deniedResource=await resource('lanyard://time/missing',{sub:member,email:staff.email,act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}})
  assert.equal(deniedResource.value.error.data.code,'resource_unavailable')
  const narrowed=await call({sub:member,email:'sasha@synthetic.example.invalid',act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}})
  assert.equal(narrowed.value.result._meta['com.runeditrun/error'].code,'native_authority_required','a Business admin retains native preparation limits')
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
  const weekUri=link(complete)
  const heldRead=await resource(weekUri)
  assert.equal(heldRead.value.error.data.code,'approval_required')
  assert.equal(heldRead.value.result,undefined,'held resource content is withheld')
  const readApproval=heldRead.value.error.data.approval
  const readView=(await h.send('/agents/api/approvals/'+readApproval.id,undefined,h.owner)).value.approval
  assert.equal((await h.send('/agents/api/approvals/'+readApproval.id+'/approve',{revision:readView.revision,summary_sha256:readView.summary_sha256},h.owner)).status,200)
  const heldWeek=record(await resource(weekUri,{},heldRead.value.error.data.requestState))
  assert.equal(heldWeek.week,args.week);assert.equal(heldWeek.status,'draft')
  assert.equal(heldWeek.shifts.length,1);assert.equal(heldWeek.shifts[0].staffId,worker.id)
  redacted(heldWeek)
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
  const timeUri=link(first),firstTime=record(await resource(timeUri))
  assert.equal(firstTime.staffId,worker.id);assert.equal(firstTime.minutes,120);assert.equal(firstTime.status,'submitted')
  redacted(firstTime)
  const contextState=(await call()).value.result.structuredContent
  assert.deepEqual(firstTime,contextState.timesheets.find(t=>t.id===firstTime.id),'resource equals the current reduced native projection')
  const missingRead=await resource('lanyard://time/missing')
  assert.deepEqual(deniedResource.value,missingRead.value,'native non-owner and missing record responses are indistinguishable')
  const memberToken={sub:member,email:staff.email,act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}}
  assert.deepEqual((await resource(timeUri,memberToken)).value,(await resource('lanyard://time/missing',memberToken)).value,'a real native record is indistinguishable from a missing id for the non-owner')
  await h.cmd('staff.save',{id:staff.id,revision:staff.revision,name:staff.name,email:staff.email,payrollId:staff.payrollId,active:false,role:'manager'})
  assert.equal((await call({sub:member,email:staff.email,act:{sub:'synthetic-member-agent',name:'River',specialist:'workforce coordinator'}})).status,401,'native deactivation stops the next call')
  assert.equal((await resource(timeUri,memberToken)).status,401,'sponsor deactivation stops resource reads')
  const missingScope=await resource(timeUri,{scope:'workforce:prepare'})
  assert.equal(missingScope.status,403);assert.equal(missingScope.value.result,undefined)
  const approved=await h.cmd('time.approve',{id:firstTime.id,revision:firstTime.revision})
  assert.equal(record(await resource(timeUri)).status,'approved','readback follows a separate native human decision')
  const batch=await call({},'lanyard.payroll.prepare',{ids:[approved.id],idempotency_key:'resource-payroll'})
  const payrollUri=link(batch),payroll=record(await resource(payrollUri))
  assert.equal(payroll.status,'draft');assert.deepEqual(payroll.lines.map(x=>x.minutes),[120]);redacted(payroll)
  await h.restart()
  assert.deepEqual(record(await resource(payrollUri)),payroll,'current reduced payroll survives restart')
  const current=await h.state()
  const changedSource=await call({},'lanyard.time.prepare',{...time,start:'2026-01-08T10:00:00Z',end:'2026-01-08T12:00:00Z',idempotency_key:'resource-stale-time',expected_revision:current.version-1})
  assert.equal(changedSource.value.result._meta['com.runeditrun/error'].code,'revision_conflict')
  assert.equal((await h.state()).version,current.version)
  assert.deepEqual(record(await resource(payrollUri)),payroll)
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
  assert.equal((await resource(timeUri)).value.error.data.code,'agents_paused','Pause withholds existing resource content')
  assert.equal((await h.send('/agents/api/pause',{paused:false},h.owner)).status,200)
  const resumed=await policyEnvelope({signer,origin:h.origin,business,seq:4,revision:4},autonomousPolicy())
  assert.equal((await h.send('/api/rer/agent-policy',{policy:resumed.policy})).status,200)
  const localResource=async(uri,key)=>h.send('/mcp',{jsonrpc:'2.0',id:'local-resource',method:'resources/read',params:{uri,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{authorization:'Bearer '+key.token,'mcp-protocol-version':'2026-07-28','mcp-method':'resources/read','mcp-name':uri})
  const localKey=await h.cmd('agent.create',{label:'Resource revocation proof'})
  assert.deepEqual(record(await localResource(timeUri,localKey)),record(await resource(timeUri)))
  await h.cmd('agent.revoke',{id:localKey.id})
  assert.equal((await localResource(timeUri,localKey)).status,401)
  const revoked=await policyEnvelope({signer,origin:h.origin,business,seq:5,revision:5},autonomousPolicy(),{revoked:{agents:[],consents:['synthetic-consent']}})
  assert.equal((await h.send('/api/rer/agent-policy',{policy:revoked.policy})).status,200)
  assert.equal((await resource(timeUri)).status,401,'consent revocation stops current resource reads')
  assert.equal((await h.state()).version,noHistory.version,'resource reads and refusals never prepare, approve or export work')
  console.log('PASS LANYARD-RESOURCES: native held and autonomous readback, independent minutes, reduced projections, redaction, untrusted markers, current approval, restart, scope and native-role refusal, stale-source refusal, key and consent revocation')
  console.log('PASS LANYARD-NATIVE: exact-summary named approval; agent decision refused; native attribution and approver; one-effect replay; argument conflict; stale revision; Pause without an effect')
  const audit=(await h.send('/agents/api/audit',undefined,h.owner)).value
  assert.equal(audit.differs_from_policy,0)
  console.log('PASS LANYARD-IDENTITY: valid scoped owner; unknown subject; inadmissible workforce member; missing consent; changed-email refusal with unchanged binding; native admin limits; immediate deactivation; audit differs_from_policy=0')
 } finally {await h.close()}
}

// Fixed-clock native history and preparation; no protocol or record injection.
export async function learningResourceProof() {
 const h=await harness({now:'2026-10-28T12:00:00Z'})
 try {
  const {read,alex}=await learnFixture(h)
  const key=await h.cmd('agent.create',{label:'Learning resource reader',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true})
  const foreign=await h.cmd('agent.create',{label:'Other cafe reader',scopes:['comparison.read'],cafes:['Elsewhere'],comparisonConsent:true})
  const rpc=(method,params,credential=key)=>h.send('/mcp',{jsonrpc:'2.0',id:'learning-resource',method,params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{authorization:'Bearer '+credential.token,'mcp-protocol-version':'2026-07-28','mcp-method':method,...(method==='resources/read'?{'mcp-name':params.uri}:method==='tools/call'?{'mcp-name':params.name}:{})})
  const parsed=response=>{
   assert.equal(response.status,200);assert.equal(response.value.error,undefined)
   const content=response.value.result.contents
   assert.equal(content.length,1);assert.equal(content[0]._meta['com.runeditrun/untrusted'],true)
   return JSON.parse(content[0].text)
  }
  const listed=await rpc('resources/templates/list',{})
  assert.deepEqual(listed.value.result.resourceTemplates.map(x=>x.uriTemplate).sort(),['lanyard://learning/{id}','lanyard://payroll/{id}','lanyard://time/{id}','lanyard://weeks/{week}'])
  const unused=await h.cmd('staff.save',{name:'Undisclosed unused person',email:'unused-'+h.auth.OWNER_EMAIL,payrollId:'synthetic-lanyard-unused',active:false,role:'staff'})
  const time=await h.cmd('time.prepare',{staffId:alex.id,start:'2026-10-20T10:00:00Z',end:'2026-10-20T11:00:00Z',breakMinutes:0,reason:'Synthetic resource custody proof'})
  assert.equal(parsed(await rpc('resources/read',{uri:'lanyard://time/'+time.id})).minutes,60)
  assert.ok(await h.db.prepare('SELECT 1 FROM l_agent_custody WHERE staff_id=?').bind(alex.id).first(),'resource disclosure retains the native staff custody fence')
  assert.equal((await h.cmd('staff.erase',{id:unused.id,revision:unused.revision})).erased,true,'a resource read never retains undisclosed unrelated people')
  await h.cmd('staff.erase',{id:alex.id,revision:(await h.state()).staff.find(p=>p.id===alex.id).revision},h.owner,409)
  const e=(await read()).value
  assert.deepEqual([e.status,e.comparableDays,e.proposal.to],['proposal',6,30])
  const proposal=await rpc('tools/call',{name:'lanyard.learn.propose',arguments:{site:'Ocean Beach',weeks:2,digest:e.digest,idempotency_key:'learning-resource-preparation'}})
  assert.equal(proposal.value.result.isError,false)
  const links=proposal.value.result.content.filter(x=>x.type==='resource_link')
  assert.equal(links.length,1)
  const uri=links[0].uri,record=parsed(await rpc('resources/read',{uri}))
  assert.deepEqual([record.status,record.weeks,record.change.field,record.change.from,record.change.to],['proposed',2,'growthPercent',0,30])
  assert.deepEqual([record.evaluation.biasPercent,record.evaluation.currentMeanAbsoluteErrorCents,record.evaluation.candidateMeanAbsoluteErrorCents],[30,3000,0])
  const native=(await h.state()).learnproposals.find(p=>p.id===record.id)
  assert.deepEqual(record,{id:native.id,revision:native.revision,version:native.version,status:native.status,weeks:native.weeks,change:native.change,evaluation:native.evaluation})
  const before=await h.state()
  assert.deepEqual((await rpc('resources/read',{uri},foreign)).value,(await rpc('resources/read',{uri:'lanyard://learning/missing'},foreign)).value,'foreign cafe and missing records are indistinguishable')
  const unscoped=await h.cmd('agent.create',{label:'No comparison consent'})
  assert.equal((await rpc('resources/read',{uri},unscoped)).status,403)
  const wrongScope=await rpc('resources/read',{uri:'lanyard://people/'+alex.id})
  assert.equal(wrongScope.value.error.data.code,'tool_not_found','people are outside the bounded resource surface')
  assert.equal((await h.state()).version,before.version)
  await h.cmd('learn.decide',{id:record.id,revision:record.revision,decision:'declined',reason:'Owner reviewed the proposal without changing assumptions'})
  await h.restart()
  const decided=parsed(await rpc('resources/read',{uri}))
  assert.equal(decided.id,record.id);assert.equal(decided.status,'declined');assert.equal(decided.revision,record.revision+1)
  const current=await h.state()
  assert.deepEqual(current.demandrules,before.demandrules)
  assert.deepEqual(current.sales,before.sales);assert.deepEqual(current.demandforecasts,before.demandforecasts)
  await h.cmd('agent.revoke',{id:key.id})
  assert.equal((await rpc('resources/read',{uri})).status,401)
  assert.equal((await h.state()).version,current.version)
  console.log('PASS LANYARD-LEARNING-RESOURCES: native preparation link, independently expected proposal and evaluation, current reduced state, foreign cafe and missing equality, scope refusal, native decision and restart, revoked consent key, unchanged source history')
 } finally {await h.close()}
}

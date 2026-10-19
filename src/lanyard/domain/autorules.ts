// AUTO-001: owner-authorized automatic approval of clean punched time at one cafe. Until TEAM-001 brings
// payroll roles the owner is the payroll administrator: only the owner saves, authorizes, pauses or
// revokes a rule. A rule approves a submitted timesheet only when it was punched against a published
// shift at the rule's cafe, starts and ends in the same minutes as the shift, keeps the
// scheduled break, carries the employee's break attestation and has no exception, break premium,
// correction, manager edit or overtime (over 40 recorded hours that week), and is not a manager's or the
// owner's own time. Everything else stays for a human with its reasons. A preview reads without writing;
// authorizing needs the exact preview digest, approves that preview's clean items at their revisions and
// turns the rule on, so new clean punches are approved as they are submitted; each approval records the
// rule, its version and the input revision.
import {type Context,type Row,type State,keys,text,need,get,exact,put,sha,canonical} from './model'
import {siteOf} from './team'
import {project} from './overtime'
import {weekOf} from './openshifts'
import {approve} from './time'

const owner=(c:Context)=>need(c.a.role==='owner','Owner required',403)
const minute=(v:string)=>Math.floor(Date.parse(v)/60000)
/** Why a timesheet needs a human under this rule; empty when the rule may approve it. */
export function reasons(s:State,rule:Row,t:Row,now:string):string[] {
 const out:string[]=[],clock=t.clockId?s.clocks.find(k=>k.id===t.clockId):undefined,shift=clock?.shiftId?s.shifts.find(x=>x.id===clock.shiftId):undefined
 const person=s.staff.find(p=>p.id===t.staffId)
 if(!clock)out.push('not punched')
 else if(!shift||shift.status!=='published')out.push('no published shift')
 else {
  if(minute(t.start)!==minute(shift.start)||minute(t.end)!==minute(shift.end))out.push('not the scheduled start and end')
  if(t.breakMinutes!==shift.breakMinutes)out.push('breaks differ from the schedule')
 }
 if((shift?siteOf(s,shift):person?.site??'')!==rule.site)out.push('another cafe')
 if(!t.breakAttestation)out.push('no break attestation')
 if(t.exceptions?.length)out.push(...t.exceptions.map((e:string)=>`exception: ${e}`))
 if(t.premiums?.length)out.push('break premium')
 if(t.corrects)out.push('correction')
 if(t.edited)out.push('edited by a manager')
 if(person?.role==='manager'||t.staffId===rule.authorizedStaffId)out.push('own time of a person who approves time')
 if(project(s,t.staffId,weekOf(s,t.start),now).actualMinutes>40*60)out.push('overtime')
 return out
}
export async function preview(s:State,rule:Row,now:string) {
 const items=s.timesheets.filter(t=>t.status==='submitted').map(t=>{const why=reasons(s,rule,t,now);return {timesheetId:t.id,revision:t.revision,staffId:t.staffId,decision:why.length?'human':'approve',reasons:why}})
  .filter(x=>!x.reasons.includes('another cafe'))
 return {ruleId:rule.id,version:rule.version,status:rule.status,digest:await sha(canonical({rule:[rule.id,rule.revision],items:items.map(x=>[x.timesheetId,x.revision,x.decision])})),items}
}
function approveBy(c:Context,rule:Row,t:Row) {
 const done=approve({...c,a:{id:`rule:${rule.id}`,email:'',name:'',role:'owner',staffId:null} as any},t)
 return Object.assign(done,{automation:{ruleId:rule.id,version:rule.version,inputRevision:t.revision,at:c.now}})
}
export async function autoRules(c:Context,name:string,p:Record<string,any>) {
 if(name==='autorule.save') {
  owner(c);keys(p,['id','revision','site'])
  const old=p.id===undefined?undefined:get(c.s,'autorules',p.id);if(old){exact(old,p);need(old.status!=='revoked','A revoked rule stays revoked',409)}
  const site=text(p.site,'site',80,true);need(!c.s.autorules.some(r=>r!==old&&r.site===site&&r.status!=='revoked'),'This cafe already has a rule',409)
  // A new version starts paused: it approves nothing until the owner authorizes its preview.
  return put(c,'autorules',{site,status:'draft',version:(old?.version??0)+1,authorizedBy:null,authorizedStaffId:null,authorizedAt:null,history:[...(old?.history??[]),{version:(old?.version??0)+1,status:'draft',by:c.a.id,at:c.now}]},old)
 }
 if(['autorule.authorize','autorule.pause','autorule.revoke'].includes(name)) {
  owner(c);keys(p,name==='autorule.authorize'?['id','revision','digest']:['id','revision']);const r=get(c.s,'autorules',p.id);exact(r,p);need(r.status!=='revoked','A revoked rule stays revoked',409)
  if(name!=='autorule.authorize'){const status=name==='autorule.pause'?'paused':'revoked';return put(c,'autorules',{...r,status,history:[...r.history,{version:r.version,status,by:c.a.id,at:c.now}]},r)}
  const v=await preview(c.s,r,c.now);need(v.digest===text(p.digest,'digest',64),'Timesheets or the rule changed since the preview; preview again',409)
  const on=put(c,'autorules',{...r,status:'active',authorizedBy:c.a.id,authorizedStaffId:c.a.staffId??null,authorizedAt:c.now,history:[...r.history,{version:r.version,status:'active',by:c.a.id,at:c.now}]},r)
  const approved=v.items.filter(x=>x.decision==='approve').map(x=>approveBy(c,on,get(c.s,'timesheets',x.timesheetId)).id);c.entity=on.id
  return {...on,approved}
 }
 return undefined
}
/** After any command: an active rule approves the clean time that command submitted at its cafe. */
export function autoApprove(c:Context,before:State) {
 const rules=c.s.autorules.filter(r=>r.status==='active');if(!rules.length)return
 const fresh=c.s.timesheets.filter(t=>t.status==='submitted'&&!before.timesheets.some(b=>b.id===t.id&&b.revision===t.revision))
 for(const t of fresh){const rule=rules.find(r=>!reasons(c.s,r,t,c.now).length);if(rule)approveBy(c,rule,t)}
}

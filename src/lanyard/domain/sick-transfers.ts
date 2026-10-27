import {type Context,type State,type Row,need,keys,text,integer,get,exact,put,self} from './model'
import {date} from './aca'
import {localDate} from './settings'
import {sickBalance,sickRule,sickWork} from './sick'

const participant=(s:State,id:string,plan:Row,on:string)=>s.staff.some(w=>w.id===id&&w.active&&!w.erased_at&&(w.site===plan.site||sickWork(s,id,plan.site).some(w=>w.date<=on)))
function available(c:Context,r:Record<string,any>){
 const plan=get(c.s,'sickpolicies',r.policyId),rule=sickRule(plan,r.date)
 need(rule&&['OR','OR_UNPAID'].includes(rule.preset),'Donations require an effective Oregon sick-time preset',409)
 need(rule.donations===true,'Employer policy does not allow sick-time donations',409)
 need(!r.policyRevision||r.policyRevision===rule.revision,'Leave policy changed; prepare fresh donor consent',409)
 need(participant(c.s,r.donorId,plan,r.date)&&participant(c.s,r.recipientId,plan,r.date),'Both employees must be active at the policy workplace',409)
 const donor=sickBalance(c.s,r.donorId,plan,r.date),recipient=sickBalance(c.s,r.recipientId,plan,r.date)
 need(donor.balanceMinutes>=r.minutes,'Insufficient current donor balance',409)
 need(rule.bankCap===null||recipient.balanceMinutes+r.minutes<=rule.bankCap,'Donation exceeds the recipient bank cap',409)
 return plan
}
/** No transfer happens until the donor consents and a separate owner approves.
 * The transfer is a bank event, never worked time, paid service or an absence. */
export function sickTransferCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('sicktransfer.'))return
 if(name==='sicktransfer.prepare'){
  need(c.a.role==='owner','Only the owner prepares private donations',403)
  keys(p,['policyId','donorId','recipientId','date','minutes'])
  const donorId=text(p.donorId,'donor'),recipientId=text(p.recipientId,'recipient'),on=date(p.date,'donation date')
  need(donorId!==recipientId,'Choose two different employees')
  need(on===localDate(c.now,c.s.timezone),'Donations must be reviewed on their effective venue date',409)
  const facts={policyId:text(p.policyId,'policy'),donorId,recipientId,date:on,minutes:integer(Number(p.minutes),'donated minutes',1,1440)}
  const plan=available(c,facts),policyRevision=sickRule(plan,on)!.revision,recipientName=c.s.staff.find(w=>w.id===recipientId)!.name
  return put(c,'sicktransfers',{...facts,policyRevision,recipientName,status:'awaiting-consent',preparedBy:c.a.id,preparedAt:c.now})
 }
 const r=get(c.s,'sicktransfers',p.id);exact(r,p)
 if(name==='sicktransfer.withdraw'){
  keys(p,['id','revision']);need(self(c.a)===r.donorId,'Only the donor can withdraw',403)
  need(['awaiting-consent','consented'].includes(r.status),'Donation already decided',409)
  return put(c,'sicktransfers',{...r,status:'withdrawn',withdrawnBy:c.a.id,withdrawnAt:c.now},r)
 }
 if(name==='sicktransfer.consent'){
  keys(p,['id','revision','consent']);need(self(c.a)===r.donorId,'Only the donor can consent',403)
  need(r.status==='awaiting-consent','Donation is no longer awaiting consent',409)
  need(p.consent==='yes','Explicit donor consent required')
  available(c,r)
  return put(c,'sicktransfers',{...r,status:'consented',consentedBy:c.a.id,consentedAt:c.now},r)
 }
 need(c.a.role==='owner','Only the owner decides private donations',403)
 keys(p,['id','revision','decision'])
 need(['approved','rejected'].includes(p.decision),'Choose approve or reject')
 need(['awaiting-consent','consented'].includes(r.status),'Donation already decided',409)
 need(c.a.staffId!==r.donorId&&c.a.staffId!==r.recipientId,'You cannot decide your own donation',403)
 if(p.decision==='approved'){
  need(r.status==='consented','The donor must consent before approval',409)
  need(r.date===localDate(c.now,c.s.timezone),'Prepare fresh consent for a later donation date',409)
  available(c,r)
 }
 return put(c,'sicktransfers',{...r,status:p.decision,decidedBy:c.a.id,decidedAt:c.now},r)
}

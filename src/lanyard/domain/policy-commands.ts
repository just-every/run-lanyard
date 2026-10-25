import {type Context,type Row,keys,text,need,integer,put,exact} from './model'
import {date} from './aca'
import {workweek} from './payschedules'
import {BREAK_VERSION,BREAK_VERSIONS,breakSources} from './policy-breaks'
import {VERSION,sources} from './policy-catalog'
import {policyClassification} from './policy'
import {releasePreview} from './policy-release'
const version=(r:Row)=>{const {versions,...v}=r;return v}
export async function policyCommand(c:Context,name:string,p:Record<string,any>){
 if(!['policy.save','policy.preview','policy.review'].includes(name))return
 need(c.a.role==='owner','Only the owner maintains or reviews policy calculations',403)
 if(name==='policy.review'){
  keys(p,['staffId','week']);need(c.s.staff.some(x=>x.id===p.staffId),'Person not found',404)
  const week=date(p.week,'workweek');need(workweek(c.s,p.staffId,week)===week,'Use the employee workweek start')
  return policyClassification(c.s,p.staffId,week)
 }
 keys(p,['id','revision','site','from','preset','jurisdiction','dailyMinutes','doubleMinutes','weeklyMinutes','minimumRestMinutes','reviewReason','breakVersion','reviewDigest'])
 const site=text(p.site,'site',80,true),old=c.s.policies.find(r=>r.site===site)
 if(old){need(p.id===old.id,'Reload the existing policy',409);exact(old,p)}else need(!p.id,'Policy not found',404)
 const from=date(p.from,'effective date'),preset=text(p.preset,'preset',20)
 need(preset==='custom'||Object.hasOwn(sources,preset),'Choose a shipped preset or custom')
 if(old)need(from>=old.from,'A policy revision cannot precede its previous effective date',409)
 need(!c.s.periods.some(r=>['locked','closed'].includes(r.status)&&r.end>=from),'Policy changes cannot reach locked or closed payroll; choose a later effective date',409)
 const reviewReason=text(p.reviewReason,old?'reviewed recalculation reason':'review reason',500)
 const custom=preset==='custom'
 if(!custom)need(['jurisdiction','dailyMinutes','doubleMinutes','weeklyMinutes'].every(k=>p[k]===undefined),'Maintained overtime thresholds cannot be overridden; use custom')
 const limit=(v:any,label:string,fallback:number)=>v===undefined?fallback:integer(Number(v),label,1,10080)
 const dailyMinutes=custom?limit(p.dailyMinutes,'daily threshold',1440):['CA','AK','NV'].includes(preset)?480:preset==='CO'?720:1440
 const doubleMinutes=custom?limit(p.doubleMinutes,'double-time threshold',1440):preset==='CA'?720:1440
 need(doubleMinutes>=dailyMinutes,'Double time cannot begin before overtime')
 const minimumRestMinutes=p.minimumRestMinutes===undefined?0:integer(Number(p.minimumRestMinutes),'employer minimum rest',0,1440)
 if(preset==='CA')need(!c.s.mealrules.some(r=>r.site===site&&r.enabled),'Disable automatic meal deduction before applying California policy',409)
 const breakVersion=breakSources[preset]?(p.breakVersion??BREAK_VERSION):null
 need(p.breakVersion===undefined||breakVersion!==null,'This preset has no maintained break rules')
 need(breakVersion===null||BREAK_VERSIONS.includes(breakVersion),'Choose a supported break-rule version')
 const candidate={site,from,preset,jurisdiction:custom?text(p.jurisdiction,'jurisdiction',120):preset,presetVersion:VERSION,breakVersion,source:custom?'':sources[preset],dailyMinutes,doubleMinutes,weeklyMinutes:custom?limit(p.weeklyMinutes,'weekly threshold',2400):2400,minimumRestMinutes,minimumRestLabel:'Employer-configured, unmaintained minimum rest',reviewReason,by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),version(old)]:[]}
 const upgrade=!!old&&old.preset===preset&&(old.breakVersion!==breakVersion||old.presetVersion!==VERSION)
 const review=name==='policy.preview'||upgrade?await releasePreview(c.s,candidate,old):null
 if(name==='policy.preview')return review
 if(upgrade)need(p.reviewDigest===review!.digest,'Review the preset release and current open-period recalculation before applying it',409)
 return put(c,'policies',{...candidate,...(upgrade?{releaseReview:{...review,reason:reviewReason,by:c.a.id,at:c.now}}:{})},old)
}

// FAIR-001 employer-confirmed history. Recording time never stands in for effective eligibility.
import {type Context,type State,type Row,type Staff,keys,text,integer,need,manager,self,staff,put,exact} from './model'
import {date} from './aca'
import {salesSite} from './sales'

export const FAIR_TAGS=['closing','close-then-open','weekend','holiday'] as const
export type FairTag=typeof FAIR_TAGS[number]
export type EligibilityMember={staffId:string;staffRevision:number;active:boolean;position:string;homeSite:string;employment:{id:string;revision:number;type:string|null;startDate:string|null}|null;profile:{id:string;revision:number;jobs:string[];skills:string[];certifications:{name:string;expires:string}[];sites:string[]}|null;jobs:{id:string;revision:number;name:string;skills:string[];certifications:string[]}[]}
export type FairCohort=Row&{site:string;position:string;from:string;until:string|null;members:EligibilityMember[];recordedBy:string;recordedAt:string}
const version=(r:Row)=>{const {versions,...v}=r;return v}
const time=(v:unknown,label:string)=>{const t=text(v,label,5);need(/^([01]\d|2[0-3]):[0-5]\d$/.test(t),`Invalid ${label}: use HH:MM`);return t}
export const fairnessPolicy=(s:State,site:string)=>s.fairnesspolicies.find(r=>r.site===site)??null
export function cohortOn(s:State,site:string,position:string,on:string):FairCohort|null {
 return (s.fairnesscohorts.filter(r=>r.site===site&&r.position===position&&r.from<=on&&(!r.until||r.until>=on)).sort((a,b)=>b.from.localeCompare(a.from)||String(b.recordedAt).localeCompare(String(a.recordedAt)))[0] as FairCohort|undefined)??null
}
/** Qualifications are evaluated from the confirmed basis, including inclusive certificate expiry. */
export function memberEligible(m:EligibilityMember,site:string,position:string,on:string,jobId?:string):boolean {
 if(!m.active)return false
 if(m.employment?.startDate&&m.employment.startDate>on)return false
 if(m.profile&&!m.profile.sites.includes(site)||!m.profile&&m.homeSite!==site)return false
 const jobs=m.jobs.filter(j=>(j.id===position||j.name===position)&&(!jobId||j.id===jobId))
 if(m.profile?.jobs.length) {
  return jobs.some(j=>m.profile!.jobs.includes(j.id)&&j.skills.every(v=>m.profile!.skills.includes(v))&&j.certifications.every(v=>m.profile!.certifications.some(c=>c.name===v&&c.expires>=on)))
 }
 return !jobId&&m.position===position
}
export function eligibleMembers(s:State,site:string,position:string,on:string):string[]|null {
 const c=cohortOn(s,site,position,on)
 return c?c.members.filter(m=>memberEligible(m,site,position,on)).map(m=>m.staffId):null
}
export function eligibleAt(s:State,staffId:string,site:string,position:string,on:string):boolean|null {
 const members=eligibleMembers(s,site,position,on);return members===null?null:members.includes(staffId)
}
function capture(s:State,p:Staff):EligibilityMember {
 const profile=s.workforce.find(v=>v.staffId===p.id),employment=s.employment.find(v=>v.staffId===p.id)
 return {staffId:p.id,staffRevision:p.version,active:Boolean(p.active)&&!p.erased_at,position:p.position??'',homeSite:p.site??'',
  employment:employment?{id:employment.id,revision:employment.revision,type:employment.type??null,startDate:employment.startDate??null}:null,
  profile:profile?{id:profile.id,revision:profile.revision,jobs:[...profile.jobs],skills:[...profile.skills],certifications:profile.certifications.map((v:any)=>({name:v.name,expires:v.expires})),sites:[...profile.sites]}:null,
  jobs:s.jobs.filter(j=>profile?.jobs.includes(j.id)).map(j=>({id:j.id,revision:j.revision,name:j.name,skills:[...j.skills],certifications:[...j.certifications]}))}
}
function scope(c:Context,site:string){manager(c.a);need(salesSite(c.s,c.a,site),'Only a manager of this cafe',403)}
function interval(p:Record<string,any>){const from=date(p.from,'effective first day'),until=p.until===undefined||p.until===''?null:date(p.until,'effective last day');need(!until||until>=from,'Last day precedes first day');return {from,until}}
/** A request is employee-selected extra minutes per venue week, not preferred hours inferred as demand. */
export function requestOn(s:State,staffId:string,on:string,asOf?:string) {
 const candidates=s.fairnessrequests.flatMap(r=>[...(r.versions??[]),version(r)]).filter(r=>r.staffId===staffId&&r.from<=on&&(!r.until||r.until>=on)&&(!asOf||r.recordedAt<=asOf))
 return candidates.sort((a,b)=>b.from.localeCompare(a.from)||String(b.recordedAt).localeCompare(String(a.recordedAt))||b.revision-a.revision)[0]??null
}
export function fairnessCommands(c:Context,name:string,p:Record<string,any>) {
 if(!['fairness.policy.save','fairness.cohort.save','fairness.request.save'].includes(name))return undefined
 if(name==='fairness.policy.save') {
  keys(p,['site','revision','tags','closingTime','openingTime','closeOpenHours'])
  const site=text(p.site,'site',80,true);scope(c,site)
  const old=fairnessPolicy(c.s,site);if(old)exact(old,p)
  need(Array.isArray(p.tags)&&p.tags.every((v:unknown)=>FAIR_TAGS.includes(v as FairTag)),'Choose closing, close-then-open, weekend or holiday tags')
  const tags=[...new Set(p.tags)]
  return put(c,'fairnesspolicies',{site,tags,closingTime:time(p.closingTime,'closing time'),openingTime:time(p.openingTime,'opening time'),closeOpenHours:integer(p.closeOpenHours,'close-to-open hours',1,48),recordedBy:c.a.id,recordedAt:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old??undefined)
 }
 if(name==='fairness.request.save') {
  keys(p,['id','revision','staffId','from','until','minutes']);need(c.a.role!=='agent','Staff or manager required',403)
  const id=p.staffId?staff(c,p.staffId).id:self(c.a)!
  if(id!==c.a.staffId){const person=staff(c,id);scope(c,person.site??'')}
  const range=interval(p),old=p.id?c.s.fairnessrequests.find(r=>r.id===p.id):c.s.fairnessrequests.find(r=>r.staffId===id&&r.from===range.from)
  need(!p.id||old,'Request not found',404);if(old){need(old.staffId===id,'Cannot move a request between employees');exact(old,p)}
  return put(c,'fairnessrequests',{staffId:id,...range,minutes:integer(p.minutes,'requested extra minutes per week',0,10080),recordedBy:c.a.id,recordedAt:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old)
 }
 keys(p,['id','revision','site','position','from','until','staffIds'])
 const site=text(p.site,'site',80,true),position=text(p.position,'role',80);scope(c,site)
 const range=interval(p),old=p.id?c.s.fairnesscohorts.find(r=>r.id===p.id):c.s.fairnesscohorts.find(r=>r.site===site&&r.position===position&&r.from===range.from)
 need(!p.id||old,'Cohort not found',404)
 if(old){need(old.site===site&&old.position===position&&old.from===range.from,'Cohort identity cannot change');exact(old,p)}
 need(Array.isArray(p.staffIds)&&p.staffIds.length>0&&p.staffIds.length<=500,'Confirm the complete eligible employee list')
 const ids=p.staffIds.map((v:unknown)=>text(v,'staff id',80));need(new Set(ids).size===ids.length,'Duplicate employee')
 const members=c.s.staff.filter(v=>!v.erased_at).map(v=>capture(c.s,v)).filter(m=>{const on=m.employment?.startDate&&m.employment.startDate>range.from?m.employment.startDate:range.from;return (!range.until||on<=range.until)&&memberEligible(m,site,position,on)})
 // The complete captured population, including zero-assignment people, prevents cherry-picked spreads.
 need(members.length===ids.length&&members.every(m=>ids.includes(m.staffId)),'Confirm every active employee eligible for this role and site, without omissions or ineligible members',409)
 return put(c,'fairnesscohorts',{site,position,...range,members,recordedBy:c.a.id,recordedAt:c.now,basis:'Employer confirms this effective range from the retained eligibility sources; recorded time does not establish earlier eligibility',versions:old?[...(old.versions??[]),version(old)]:[]},old)
}

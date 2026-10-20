// PEOPLE-002: employer-recorded qualifications and effective-dated USD job rates.
// Keep the exact inputs and their revisions on prepared work; never reprice history.
import {type Context,type State,type Row,keys,text,need,manager,integer,staff,get,exact,put} from './model'
import {date,dayAfter} from './aca'
import {instantAt,localDate} from './settings'
import {employment} from './offerorder'
const list=(v:unknown,label:string)=>{need(Array.isArray(v)&&v.length<=100,`Provide up to 100 ${label}`);return [...new Set(v.map(x=>text(x,label,80)))]}
export const profileOf=(s:State,id:string)=>s.workforce.find(r=>r.staffId===id)
export function workforce(c:Context,name:string,p:Record<string,any>) {
 if(!['job.save','workforce.save'].includes(name))return undefined
 manager(c.a)
 if(name==='job.save') {
  keys(p,['id','revision','name','skills','certifications'])
  const old=p.id?get(c.s,'jobs',p.id):undefined;if(old)exact(old,p)
  if(old&&c.a.role==='manager')need(!c.s.workforce.some(r=>r.jobs.includes(old.id)&&c.s.staff.find(v=>v.id===r.staffId)?.site!==c.s.staff.find(v=>v.id===c.a.staffId)?.site),'The owner maintains jobs shared across cafes',403)
  const label=text(p.name,'job name',80);need(!c.s.jobs.some(j=>j.id!==old?.id&&j.name===label),'Job name already exists',409)
  return put(c,'jobs',{name:label,skills:list(p.skills,'skills'),certifications:list(p.certifications,'certifications'),by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old)
 }
 keys(p,['id','revision','staffId','jobs','skills','certifications','sites','preferences','minHours','maxHours','classification','employmentType','startDate','rates'])
 const person=staff(c,p.staffId)
 // Existing cafe management scope; owner acts for the missing payroll administrator role.
 need(c.a.role==='owner'||person.site===c.s.staff.find(x=>x.id===c.a.staffId)?.site,'Only a manager of this cafe',403)
 const old=profileOf(c.s,person.id);if(old){need(p.id===old.id,'Use the existing profile revision',409);exact(old,p)}else need(!p.id,'Profile not found',404)
 const jobs=list(p.jobs,'jobs');need(jobs.every(id=>c.s.jobs.some(j=>j.id===id)),'Job not found',404)
 const skills=list(p.skills,'skills'),sites=list(p.sites,'eligible sites');need(sites.length,'Choose at least one eligible site')
 const preferences=list(p.preferences,'preferences'),minHours=integer(p.minHours,'minimum weekly hours',0,168),maxHours=integer(p.maxHours,'maximum weekly hours',0,168);need(minHours<=maxHours,'Minimum hours exceed maximum')
 need(Array.isArray(p.certifications)&&p.certifications.length<=100,'Provide certifications')
 const certifications=p.certifications.map((v:any)=>{need(v&&typeof v==='object','Invalid certification');keys(v,['name','expires']);return {name:text(v.name,'certification',80),expires:date(v.expires,'certification expiry')}})
 need(new Set(certifications.map((v:any)=>v.name)).size===certifications.length,'Duplicate certification')
 need(Array.isArray(p.rates)&&p.rates.length<=100,'Provide effective-dated rates')
 const rates=p.rates.map((v:any)=>{need(v&&typeof v==='object','Invalid rate');keys(v,['job','from','cents']);need(v.job===''||jobs.includes(v.job),'Rate job is not granted');return {job:v.job,from:date(v.from,'rate start'),cents:integer(v.cents,'USD cents per hour',0,999999)}}).sort((a:any,b:any)=>a.from.localeCompare(b.from)||a.job.localeCompare(b.job))
 need(new Set(rates.map((v:any)=>v.job+'|'+v.from)).size===rates.length,'Duplicate effective job rate')
 freezeRates(c,person.id)
 employment(c,person.id,false,p)
 return put(c,'workforce',{staffId:person.id,jobs,skills,certifications,sites,preferences,minHours,maxHours,classification:text(p.classification,'employment classification',80),rates,by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old)
}
function version(r:Row){const {versions,...v}=r;return v}
/** Every venue date touched must be eligible, including an overnight certification expiry. */
export function qualification(s:State,id:string,x:Record<string,any>):string|null {
 const p=profileOf(s,id),job=x.job?s.jobs.find(j=>j.id===x.job):null
 if(p?.jobs.length&&!x.job)return 'Choose a job for this employee'
 if(x.job&&!job)return 'Job not found'
 if(x.job&&(!p||!p.jobs.includes(x.job)))return 'Not qualified for job'
 if(p&&!p.sites.includes(x.site||s.staff.find(v=>v.id===id)?.site||''))return 'Not eligible at this site'
 if(!job)return null
 if(job.skills.some((v:string)=>!p!.skills.includes(v)))return 'Missing job skill'
 const last=localDate(new Date(Date.parse(x.end)-1).toISOString(),s.timezone)
 if(job.certifications.some((v:string)=>!p!.certifications.some((c:any)=>c.name===v&&c.expires>=last)))return 'Certification missing or expired'
 return null
}
export function rateAt(s:State,id:string,job:string,on:string) {
 const p=profileOf(s,id),eligible=p?.rates.filter((r:any)=>(r.job===job||r.job==='')&&r.from<=on)??[]
 // Job-specific rate takes precedence over the general effective rate.
 const r=eligible.filter((r:any)=>r.job===job).at(-1)??eligible.filter((r:any)=>r.job==='').at(-1)
 return {cents:r?.cents??s.staff.find(v=>v.id===id)?.rate_cents??null,from:r?.from??null,profileId:p?.id??null,profileRevision:p?.revision??null}
}
export function rateBasis(s:State,id:string,x:Record<string,any>) {
 const start=Date.parse(x.start),end=Date.parse(x.end),parts:any[]=[];let at=start
 while(at<end){const on=localDate(new Date(at).toISOString(),s.timezone),next=Math.min(end,Date.parse(instantAt(dayAfter(on),'00:00',s.timezone))),weight=next-at,minutes=Math.floor(x.minutes*weight/(end-start));parts.push({date:on,weight,minutes,...rateAt(s,id,x.job??'',on)});at=next}
 let left=x.minutes-parts.reduce((n,p)=>n+p.minutes,0)
 for(const p of [...parts].sort((a,b)=>(x.minutes*b.weight/(end-start)-b.minutes)-(x.minutes*a.weight/(end-start)-a.minutes)||a.date.localeCompare(b.date)))if(left-->0)p.minutes++
 return {staffId:id,job:x.job??'',site:x.site||s.staff.find(v=>v.id===id)?.site||'',jobRevision:s.jobs.find(j=>j.id===x.job)?.revision??null,segments:parts.map(({weight,...v})=>v),costCents:parts.some(p=>p.cents===null)?null:parts.reduce((n,p)=>n+Math.round(p.minutes*p.cents/60),0)}
}
export function priced(s:State,id:string,x:Record<string,any>) {return x.rateBasis?.staffId===id?x.rateBasis:s.rateSnapshots.find(r=>r.subjectId===x.id&&r.staffId===id)?.basis??rateBasis(s,id,x)}
/** Retain legacy cost inputs before the first rate/profile edit, without changing locked time. */
export function freezeRates(c:Context,id:string){for(const x of [...c.s.shifts,...c.s.timesheets])if(x.staffId===id&&!x.rateBasis&&!c.s.rateSnapshots.some(r=>r.subjectId===x.id&&r.staffId===id))put(c,'rateSnapshots',{staffId:id,subjectId:x.id,basis:rateBasis(c.s,id,x)})}
/** Rate snapshots in staff/agent views never disclose a coworker's wages. */
export function withoutRates(row:Row){const {rateBasis,...safe}=row;return safe}

/** Public mutation answers follow the same wage exclusion as snapshots. */
export function hideRates(v:any):any {if(Array.isArray(v))return v.map(hideRates);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='rateBasis').map(([k,x])=>[k,hideRates(x)]));return v}

// ACA-001: employer-reviewed standard measurement groups and paid non-work service.
// These credits never create punches, payroll earnings or leave-bank transactions.
import {type Actor,type Context,type State,type Row,keys,text,need,integer,exact,get,put} from './model'
export type AcaPlan=Row&{name:string;start:string;end:string;adminEnd:string;stabilityEnd:string;months:number;staffIds:string[];versions:Record<string,any>[]}

export const dayAfter=(d:string,n=1)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
export function date(v:unknown,label:string):string {
 const d=text(v,label,10);need(/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d,`Invalid ${label}`);return d
}
export const monthsAfter=(d:string,n:number)=>{const x=new Date(d+'T00:00:00Z');x.setUTCMonth(x.getUTCMonth()+n);return x.toISOString().slice(0,10)}
export const daysBetween=(a:string,b:string)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000
export const mayReadPerson=(s:State,a:Actor,id:string)=>a.role==='owner'||(a.role==='manager'&&(s.staff.find(p=>p.id===a.staffId)?.site??'')===(s.staff.find(p=>p.id===id)?.site??''))
export function plansFor(s:State,a:Actor):AcaPlan[] {
 if(!['owner','manager'].includes(a.role))return []
 return (s.acaPlans as AcaPlan[]).map(p=>({...p,staffIds:p.staffIds.filter(id=>mayReadPerson(s,a,id)),versions:a.role==='owner'?p.versions:[]})).filter(p=>p.staffIds.length)
}
export function aca(c:Context,name:string,p:Record<string,any>) {
 if(!['aca.plan.save','aca.credit.save'].includes(name))return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
 if(name==='aca.plan.save') {
  keys(p,['id','revision','name','start','end','adminEnd','stabilityEnd','staffIds'])
  const old=p.id?get(c.s,'acaPlans',p.id):undefined;if(old)exact(old,p)
  const start=date(p.start,'measurement start'),end=date(p.end,'measurement end'),adminEnd=date(p.adminEnd,'administrative end'),stabilityEnd=date(p.stabilityEnd,'stability end')
  const months=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1
  need(start.endsWith('-01')&&dayAfter(end)===monthsAfter(start,months)&&months>=3&&months<=12,'Measurement must span 3–12 whole calendar months')
  need(adminEnd>=end&&daysBetween(end,adminEnd)<=90,'Administrative period must be 0–90 days after measurement')
  need(stabilityEnd>=dayAfter(monthsAfter(dayAfter(adminEnd),Math.max(6,months)),-1),'Full-time stability must last at least six months and the measurement length')
  need(Array.isArray(p.staffIds)&&p.staffIds.length>0&&p.staffIds.length<=500,'Choose variable-hour employees')
  const staffIds=[...new Set(p.staffIds.map((id:unknown)=>text(id,'staffId')))];need(staffIds.every(id=>c.s.staff.some(v=>v.id===id&&!v.erased_at)),'Staff not found',404)
  return put(c,'acaPlans',{name:text(p.name,'measurement name'),start,end,adminEnd,stabilityEnd,months,staffIds,by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),oldVersion(old)]:[]},old)
 }
 keys(p,['id','revision','staffId','date','minutes','category','reference','reason'])
 const old=p.id?get(c.s,'acaCredits',p.id):undefined;if(old)exact(old,p)
 const staffId=text(p.staffId,'staffId');need(c.s.staff.some(v=>v.id===staffId&&!v.erased_at),'Staff not found',404);need(!old||old.staffId===staffId,'A service correction keeps the employee')
 const on=date(p.date,'service date');need(on<=c.now.slice(0,10),'Service credit cannot be in the future')
 const minutes=integer(typeof p.minutes==='string'?Number(p.minutes):p.minutes,'service minutes',0,1440),reference=text(p.reference,'source reference',160)
 need(['vacation','holiday','illness','disability','layoff','jury','military','leave'].includes(p.category),'Choose a paid non-work service category')
 need(!c.s.acaCredits.some(x=>x.id!==old?.id&&x.reference===reference),'This service source already has a credit; correct its exact revision',409)
 return put(c,'acaCredits',{staffId,date:on,minutes,category:p.category,reference,reason:text(p.reason,'reason',500),by:c.a.id,at:c.now,source:'employer-recorded',versions:old?[...(old.versions??[]),oldVersion(old)]:[]},old)
}
function oldVersion(row:Record<string,any>) {const {versions,...v}=row;return v}

// PAYRULE-002: reviewed non-work holiday inputs and signed per-job/area/code corrections.
import {type Context,type Row,keys,text,need,put,canonical} from './model'
import {nonWorkReview,workedHoliday} from './holidays'
import {date} from './aca'
import {instantAt} from './settings'
import {heldByPeriod} from './periods'
export function holidayPay(c:Context,name:string,p:Record<string,any>) {
 if(name!=='holidaypay.approve')return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
 keys(p,['staffId','site','date','reference','digest']);const staffId=text(p.staffId,'staff ID'),site=text(p.site,'site',80,true),on=date(p.date,'holiday date'),reference=text(p.reference,'paid-service source reference',120)
 const r=nonWorkReview(c.s,staffId,site,on,c.now);need(r&&r.eligible&&!r.pending,'Holiday pay is ineligible or awaiting work',409);need(r.digest===p.digest,'Holiday facts changed; reload before approving',409);need(r.costCents!==null,'Set the employee rate first',409)
 need(!c.s.holidaypay.some(x=>x.staffId===staffId&&x.holidayId===r.holidayId||x.reference===reference),'Holiday pay or source reference already approved',409)
 const credit=c.s.acaCredits.find(x=>x.reference===reference)
 need(!credit||credit.staffId===staffId&&credit.date===on&&credit.minutes===r.minutes,'Paid-service reference conflicts with an existing ACA credit',409)
 return put(c,'holidaypay',{...r,reference,status:'approved',approvedBy:c.a.id,approvedAt:c.now})
}
const key=(l:any)=>canonical([l.holidayId,l.date,l.job??'',l.area??'',l.site,l.code??l.payCode])
export function holidayLines(c:Context,t:Row,base:Record<string,any>) {
 const groups=new Map<string,any>()
 for(const f of workedHoliday(c.s,t,c.now)) {
  need(!f.pending,'Holiday eligibility awaits approved adjacent work',409)
  if(!f.eligible)continue
  need(f.costCents!==null,'Holiday premium needs the retained job rate',409)
  const k=key(f),old=groups.get(k)
  groups.set(k,{...base,...f,holidayLine:true,payCode:f.code,minutes:(old?.minutes??0)+f.minutes,costCents:(old?.costCents??0)+f.costCents})
 }
 const previous=c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines).filter((l:any)=>l.rootId===t.rootId&&l.holidayLine)
 for(const l of previous){const k=key(l),old=groups.get(k);groups.set(k,{...l,...base,...old,minutes:(old?.minutes??0)-l.minutes,costCents:(old?.costCents??0)-l.costCents})}
 return [...groups.values()].filter(l=>l.minutes!==0||l.costCents!==0)
}
export function nonWorkLines(c:Context) {
 return c.s.holidaypay.filter(r=>r.status==='approved'&&!r.batchId).map(r=>({...r,start:instantAt(r.date,'00:00',c.s.timezone),end:instantAt(r.date,'00:00',c.s.timezone),holidayPayId:r.id,payrollId:c.s.staff.find(p=>p.id===r.staffId)?.payroll_id,payCode:r.code,holidayLine:true})).filter(r=>!heldByPeriod(c.s,r))
}

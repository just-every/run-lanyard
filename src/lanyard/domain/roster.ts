import {type Context,type Row,keys,text,need,prepare,manager,self,staff,work,get,exact,put,overlap} from './model'
import {localDate} from './settings'
// Glove's prepare/approve split and Dial's occurrence fences: publication acts
// on the exact draft and all conflicts are checked inside its state version.
export function conflicts(c:Context,shifts:Row[],week:string) {
 const errors:{shiftId:string;staffId:string;reason:string}[]=[]
 for(const s of shifts) {
  const person=c.s.staff.find(p=>p.id===s.staffId)
  const windows=c.s.availability.filter(a=>a.staffId===s.staffId).sort((a,b)=>a.start.localeCompare(b.start))
  let through=s.start;for(const w of windows)if(w.start<=through&&w.end>through)through=w.end
  const reason=!person?.active||person.erased_at?'Staff inactive':through<s.end?'Outside availability':c.s.leave.some(l=>l.staffId===s.staffId&&l.status==='approved'&&overlap(l,s))?'Approved leave':null
  if(reason)errors.push({shiftId:s.id,staffId:s.staffId,reason})
  const others=[...shifts.filter(x=>x.id!==s.id),...c.s.shifts.filter(x=>x.status==='published'&&c.s.rosters.find(r=>r.id===x.rosterId)?.week!==week)]
  if(others.some(x=>x.staffId===s.staffId&&overlap(x,s)))errors.push({shiftId:s.id,staffId:s.staffId,reason:'Overlapping shift'})
 }
 return errors
}
export function roster(c:Context,name:string,p:Record<string,any>) {
 if(name==='roster.prepare') {
  prepare(c.a);keys(p,['week','shifts']);const week=text(p.week,'week',10),monday=new Date(week+'T00:00:00Z');need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&Number.isFinite(monday.getTime())&&monday.toISOString().slice(0,10)===week&&monday.getUTCDay()===1,'Week must be a Monday YYYY-MM-DD')
  need(Array.isArray(p.shifts)&&p.shifts.length>0&&p.shifts.length<=250,'Provide 1–250 shifts');const weekEnd=new Date(monday.getTime()+7*86400000).toISOString().slice(0,10)
  const prior=c.s.rosters.find(r=>r.week===week&&r.status==='draft');if(prior)for(const s of c.s.shifts.filter(s=>s.rosterId===prior.id))put(c,'shifts',{...s,status:'superseded'},s)
  const r=put(c,'rosters',{week,timezone:c.s.timezone,status:'draft',preparedBy:c.a.id,preparedAt:c.now},prior)
  const shifts=p.shifts.map((value:any)=>{need(value&&typeof value==='object'&&!Array.isArray(value),'Invalid shift');keys(value,['staffId','start','end','breakMinutes','label']);const w=work(value),date=localDate(w.start,c.s.timezone);need(date>=week&&date<weekEnd,'Shift must start in the selected venue week');return put(c,'shifts',{rosterId:r.id,staffId:staff(c,value.staffId).id,...w,label:text(value.label,'label',120,true),status:'draft'})})
  c.entity=r.id;return {...r,shifts,conflicts:conflicts(c,shifts,week),approvalRequired:'roster.publish',approval:{id:r.id,revision:r.revision}}
 }
 if(name==='roster.publish') {
  manager(c.a);keys(p,['id','revision']);const r=get(c.s,'rosters',p.id);exact(r,p);need(r.status==='draft','Only drafts can be published',409);need(r.timezone===c.s.timezone,'Venue timezone changed; prepare this roster again',409);const shifts=c.s.shifts.filter(s=>s.rosterId===r.id&&s.status==='draft'),issues=conflicts(c,shifts,r.week);need(shifts.length>0,'Empty roster',409);need(!issues.length,issues.map(x=>x.reason).join('; '),409)
  for(const old of c.s.rosters.filter(x=>x.week===r.week&&x.status==='published')){put(c,'rosters',{...old,status:'superseded'},old);for(const s of c.s.shifts.filter(s=>s.rosterId===old.id&&s.status==='published'))put(c,'shifts',{...s,status:'superseded'},s)}
  for(const s of shifts)put(c,'shifts',{...s,status:'published'},s)
  return put(c,'rosters',{...r,status:'published',publishedBy:c.a.id,publishedAt:c.now},r)
 }
 if(name==='shift.confirm') {
  keys(p,['id','revision']);const r=get(c.s,'shifts',p.id);need(r.staffId===self(c.a),'Only your own shift',403);exact(r,p);need(r.status==='published','Shift is no longer published',409);return put(c,'shifts',{...r,confirmedAt:c.now,confirmedBy:c.a.id},r)
 }
 return undefined
}

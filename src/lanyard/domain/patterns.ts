// AVAIL-001: recurring weekly availability. A pattern holds available, preferred and
// unavailable blocks per weekday from an effective first day (to an optional last day),
// one-off date exceptions and preferred/maximum weekly hours. Only an approved pattern
// is effective; the newest approved pattern starting on or before a date governs it.
import {type Context,type State,type Row,keys,text,integer,need,manager,self,staff,put,get,exact} from './model'
import {localDate,instantAt} from './settings'

type Block={day:number;kind:string;start:string;end:string}
type Exception={date:string;kind:string;start?:string;end?:string}
const KINDS=['available','preferred','unavailable'],DAYS=['mon','tue','wed','thu','fri','sat','sun']
const addDays=(date:string,n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
const isDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d
const weekdayOf=(date:string)=>(new Date(date+'T00:00:00Z').getUTCDay()+6)%7
const range=(v:string)=>{const m=/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]|24):([0-5]\d)$/.exec(v);need(m&&`${m[3]}:${m[4]}`>`${m[1]}:${m[2]}`&&(m[3]!=='24'||m[4]==='00'),`Invalid times "${v}": use HH:MM-HH:MM on one day`);return {start:`${m![1]}:${m![2]}`,end:`${m![3]}:${m![4]}`}}

/** Lines such as "Mon available 07:00-15:00" (or block objects) as blocks. */
function blocksOf(v:unknown):Block[] {
 const list=typeof v==='string'?v.split(/\n|;/).map(x=>x.trim()).filter(Boolean).map(line=>{const [d,kind,times]=line.split(/\s+/);return {day:DAYS.indexOf((d??'').slice(0,3).toLowerCase()),kind,...range(times??'')}}):v
 need(Array.isArray(list)&&list.length<=50,'Give up to 50 weekly blocks')
 return list.map((b:any)=>{need(b&&Number.isInteger(b.day)&&b.day>=0&&b.day<=6,'Each block needs a weekday');need(KINDS.includes(b.kind),'Each block is available, preferred or unavailable');const r=range(`${b.start}-${b.end}`);return {day:b.day,kind:b.kind,...r}})
}
/** Lines such as "2026-11-26 unavailable" or "2026-11-27 available 09:00-13:00" as exceptions. */
function exceptionsOf(v:unknown):Exception[] {
 if(v===undefined||v==='')return []
 const list=typeof v==='string'?v.split(/\n|;/).map(x=>x.trim()).filter(Boolean).map(line=>{const [date,kind,times]=line.split(/\s+/);return {date,kind,...(times?range(times):{})}}):v
 need(Array.isArray(list)&&list.length<=100,'Give up to 100 exceptions')
 return list.map((x:any)=>{need(typeof x?.date==='string'&&isDate(x.date),'Each exception needs a YYYY-MM-DD date');need(KINDS.includes(x.kind),'Each exception is available, preferred or unavailable');need(x.kind==='unavailable'||(x.start&&x.end),'An available exception needs its times');return {date:x.date,kind:x.kind,...(x.start?range(`${x.start}-${x.end}`):{})}})
}
/** The approved pattern governing a venue date, if any. */
export function patternOn(s:State,staffId:string,date:string) {
 return s.patterns.filter(p=>p.staffId===staffId&&p.status==='approved'&&p.from<=date&&(!p.until||p.until>=date)).sort((a,b)=>b.from.localeCompare(a.from)||String(b.decidedAt).localeCompare(String(a.decidedAt)))[0]
}
/** A date's blocks as instants: that date's exceptions replace its weekday blocks. */
function windowsOn(s:State,p:Row,date:string) {
 const own=p.exceptions.filter((x:Exception)=>x.date===date),list=own.length?own:p.blocks.filter((b:Block)=>b.day===weekdayOf(date))
 return list.map((b:any)=>({kind:b.kind,start:instantAt(date,b.start??'00:00',s.timezone),end:b.end==='24:00'||!b.end?instantAt(addDays(date,1),'00:00',s.timezone):instantAt(date,b.end,s.timezone)}))
}
/**
 * How the effective patterns read a shift: null when no pattern governs its days, else whether
 * available or preferred blocks cover it, whether it touches an unavailable block, and whether all of it is preferred.
 */
export function patternFit(s:State,staffId:string,w:Record<string,any>) {
 const days:string[]=[];for(let d=localDate(w.start,s.timezone);d<=localDate(new Date(Date.parse(w.end)-1).toISOString(),s.timezone);d=addDays(d,1))days.push(d)
 const governed=days.map(d=>({d,p:patternOn(s,staffId,d)}));if(governed.every(x=>!x.p))return null
 const windows=governed.flatMap(x=>x.p?windowsOn(s,x.p,x.d):[])
 const cover=(kinds:string[])=>{let through=w.start;for(const v of windows.filter(v=>kinds.includes(v.kind)).sort((a,b)=>a.start.localeCompare(b.start)))if(v.start<=through&&v.end>through)through=v.end;return through>=w.end}
 return {covered:cover(['available','preferred']),unavailable:windows.some(v=>v.kind==='unavailable'&&v.start<w.end&&v.end>w.start),preferred:cover(['preferred'])}
}
/** Published shifts from the pattern's first day that it would flag. */
function collisions(s:State,p:Record<string,any>,now:string) {
 const trial={...s,patterns:[...s.patterns.filter(x=>x.id!==p.id),{...p,status:'approved',decidedAt:'9999'}]} as State
 return s.shifts.filter(x=>x.staffId===p.staffId&&x.status==='published'&&x.end>now&&localDate(x.start,s.timezone)>=p.from&&(!p.until||localDate(x.start,s.timezone)<=p.until)).filter(x=>{const f=patternFit(trial,p.staffId,x);return f&&(!f.covered||f.unavailable)}).map(x=>({shiftId:x.id,start:x.start,end:x.end}))
}
const hours=(v:unknown,label:string)=>v===undefined||v===''||v===null?null:integer(typeof v==='string'?Number(v):v,label,0,168)

export function patterns(c:Context,name:string,p:Record<string,any>) {
 if(name==='availability.policy') {
  manager(c.a);keys(p,['requireApproval','revision']);const old=c.s.availrules[0];if(old)exact(old,p)
  return put(c,'availrules',{requireApproval:p.requireApproval===true||p.requireApproval==='true',savedBy:c.a.id,savedAt:c.now},old)
 }
 if(name==='pattern.save') {
  keys(p,['staffId','from','until','blocks','exceptions','preferredHours','maxHours']);need(c.a.role!=='agent','Staff or manager required',403)
  const staffId=p.staffId?staff(c,p.staffId).id:self(c.a);if(staffId!==c.a.staffId)manager(c.a)
  const from=text(p.from,'from',10);need(isDate(from),'Invalid first day: use YYYY-MM-DD');const until=text(p.until,'until',10,true)||null;need(!until||isDate(until)&&until>=from,'Invalid last day')
  const blocks=blocksOf(p.blocks);need(blocks.length>0,'Give at least one weekly block')
  const preferredHours=hours(p.preferredHours,'preferred hours'),maxHours=hours(p.maxHours,'maximum hours');need(preferredHours===null||maxHours===null||preferredHours<=maxHours,'Preferred hours exceed the maximum')
  const own=staffId===c.a.staffId,pending=own&&c.s.availrules[0]?.requireApproval===true
  const r={staffId,from,until,blocks,exceptions:exceptionsOf(p.exceptions),preferredHours,maxHours,status:pending?'pending':'approved',submittedBy:c.a.id,submittedAt:c.now,...(pending?{}:{decidedBy:c.a.id,decidedAt:c.now})}
  return {...put(c,'patterns',r),collisions:collisions(c.s,r,c.now)}
 }
 if(name==='pattern.decide') {
  manager(c.a);keys(p,['id','revision','decision']);const r=get(c.s,'patterns',p.id);exact(r,p);need(r.status==='pending','Already decided',409)
  need(['approved','declined'].includes(p.decision),'Invalid decision');need(r.staffId!==c.a.staffId&&r.submittedBy!==c.a.id,'You cannot decide your own availability',403)
  const done=put(c,'patterns',{...r,status:p.decision,decidedBy:c.a.id,decidedAt:c.now},r)
  return {...done,collisions:p.decision==='approved'?collisions(c.s,done,c.now):[]}
 }
 return undefined
}

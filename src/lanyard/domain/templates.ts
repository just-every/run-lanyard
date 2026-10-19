// SCHEDULE-002: reusable week templates, copying days of one week into another, and
// recurring shifts with explicit end dates and skipped dates. Each adds rows to a new
// draft revision of the target week through draftWeek, so availability, approved leave
// and overlaps are rechecked and nothing is published or confirmed by copying.
import {type Context,type Row,keys,text,integer,need,manager,put,get,exact} from './model'
import {draftWeek} from './roster'

type Slot={staffId:string;day:number;start:string;end:string;breakMinutes:number;label:string;site:string}
const addDays=(date:string,n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
const isDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d
const date=(v:unknown,label:string)=>{const d=text(v,label,10);need(isDate(d),`Invalid ${label}: use YYYY-MM-DD`);return d}
const monday=(v:unknown)=>{const d=date(v,'week');need(new Date(d+'T00:00:00Z').getUTCDay()===1,'Week must be a Monday YYYY-MM-DD');return d}
const clockTime=(v:unknown,label:string)=>{const t=text(v,label,5);need(/^([01]\d|2[0-3]):[0-5]\d$/.test(t),`Invalid ${label}: use HH:MM`);return t}

/** An instant's venue wall date and HH:MM. */
function wall(instant:string|number,tz:string) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]))
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}
}
/** The UTC instant of a venue wall date and time (the later instant when a DST change repeats it). */
export function instantAt(day:string,time:string,tz:string) {
 const target=Date.parse(`${day}T${time}:00Z`);let guess=target
 for(let i=0;i<3;i++){const w=wall(guess,tz);guess+=target-Date.parse(`${w.date}T${w.time}:00Z`)}
 return new Date(guess).toISOString()
}
/** A week's current rows: its draft when one is open, else its published revision. */
function currentRows(c:Context,week:string) {
 const r=c.s.rosters.find(x=>x.week===week&&x.status==='draft')??c.s.rosters.find(x=>x.week===week&&x.status==='published')
 return r?c.s.shifts.filter(x=>x.rosterId===r.id&&x.status===r.status).sort((a,b)=>a.start.localeCompare(b.start)||String(a.staffId).localeCompare(String(b.staffId))):[]
}
const input=(x:Row)=>({staffId:x.staffId,start:x.start,end:x.end,breakMinutes:x.breakMinutes,label:x.label??'',site:x.site??''})
function slotOf(c:Context,week:string,x:Row):Slot {
 const a=wall(x.start,c.s.timezone),b=wall(x.end,c.s.timezone)
 return {staffId:x.staffId,day:Math.round((Date.parse(a.date)-Date.parse(week))/86400000),start:a.time,end:b.time,breakMinutes:x.breakMinutes,label:x.label??'',site:x.site??''}
}
function rowOf(c:Context,week:string,s:Slot) {
 const day=addDays(week,s.day),start=instantAt(day,s.start,c.s.timezone),end=instantAt(s.end>s.start?day:addDays(day,1),s.end,c.s.timezone)
 return {staffId:s.staffId,start,end,breakMinutes:s.breakMinutes,label:s.label,site:s.site}
}
const dayList=(v:unknown)=>{if(v===undefined)return [0,1,2,3,4,5,6];const list=(Array.isArray(v)?v:[v]).map(d=>integer(typeof d==='string'?Number(d):d,'day',0,6));need(list.length>0,'Choose at least one day');return [...new Set(list)]}
/** Adds slots to the target week's current rows as a new draft; people no longer active are left out and named. */
function addToWeek(c:Context,week:string,slots:Slot[]) {
 need(slots.length>0,'Nothing to add to this week',409)
 const active=(id:string)=>c.s.staff.some(p=>p.id===id&&p.active&&!p.erased_at)
 const leftOut=[...new Set(slots.filter(s=>!active(s.staffId)).map(s=>s.staffId))].map(staffId=>({staffId,reason:'No longer active'}))
 return {...draftWeek(c,week,[...currentRows(c,week).map(input),...slots.filter(s=>active(s.staffId)).map(s=>rowOf(c,week,s))]),leftOut}
}

export function templates(c:Context,name:string,p:Record<string,any>) {
 if(name==='template.save') {
  manager(c.a);keys(p,['name','week']);const week=monday(p.week),rows=currentRows(c,week);need(rows.length,'This week has no shifts to save',409)
  return put(c,'templates',{name:text(p.name,'name',80),sourceWeek:week,slots:rows.map(x=>slotOf(c,week,x)),savedBy:c.a.id,savedAt:c.now})
 }
 if(name==='template.apply') {
  manager(c.a);keys(p,['id','week','days']);const t=get(c.s,'templates',p.id),days=dayList(p.days)
  return addToWeek(c,monday(p.week),t.slots.filter((s:Slot)=>days.includes(s.day)))
 }
 if(name==='roster.copy') {
  manager(c.a);keys(p,['fromWeek','week','days']);const from=monday(p.fromWeek),week=monday(p.week),days=dayList(p.days);need(from!==week,'Choose another week to copy from')
  return addToWeek(c,week,currentRows(c,from).map(x=>slotOf(c,from,x)).filter(s=>days.includes(s.day)))
 }
 if(name==='recurrence.save') {
  manager(c.a);keys(p,['id','revision','staffId','days','start','end','breakMinutes','label','site','from','until','except','removed'])
  const old=p.id?get(c.s,'recurrences',p.id):undefined;if(old)exact(old,p)
  if(p.removed===true||p.removed==='true'){need(old,'Choose a recurring shift to remove',404);return put(c,'recurrences',{...old,removed:true,removedBy:c.a.id,removedAt:c.now},old)}
  const person=c.s.staff.find(v=>v.id===text(p.staffId,'staffId'));need(person&&person.active&&!person.erased_at,'Active staff required')
  need(p.days!==undefined,'Choose at least one day')
  const from=date(p.from,'from'),until=date(p.until,'until');need(from<=until,'The pattern ends before it starts')
  const except=(typeof p.except==='string'?p.except.split(/[\s,]+/).filter(Boolean):p.except??[]) as unknown[]
  need(Array.isArray(except)&&except.length<=100,'Invalid skipped dates')
  const breakMinutes=integer(typeof p.breakMinutes==='string'?Number(p.breakMinutes):p.breakMinutes??0,'breakMinutes',0,1440)
  return put(c,'recurrences',{staffId:person.id,days:dayList(p.days),start:clockTime(p.start,'start'),end:clockTime(p.end,'end'),breakMinutes,label:text(p.label,'label',120,true),site:text(p.site,'site',80,true),from,until,except:except.map(d=>date(d,'skipped date')),savedBy:c.a.id,savedAt:c.now},old)
 }
 if(name==='recurrence.apply') {
  manager(c.a);keys(p,['week']);const week=monday(p.week)
  const slots=c.s.recurrences.filter(r=>!r.removed).flatMap(r=>[0,1,2,3,4,5,6].filter(i=>{const d=addDays(week,i);return r.days.includes(i)&&d>=r.from&&d<=r.until&&!r.except.includes(d)}).map(day=>({staffId:r.staffId,day,start:r.start,end:r.end,breakMinutes:r.breakMinutes,label:r.label,site:r.site})))
  need(slots.length,'No recurring shifts fall in this week',409)
  return addToWeek(c,week,slots)
 }
 return undefined
}

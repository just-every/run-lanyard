// MINOR-001: employer-recorded birth/permit facts and non-agricultural hour checks.
// Preset core limits are versioned; exceptions/variances never silently waive a limit.
import {type Context,type State,type Row,keys,text,need,integer,put,get,exact} from './model'
import {date,dayAfter} from './aca'
import {wall,localDate,instantAt} from './settings'
import {minorWork,rollingWork} from './minor-work'
import {minorEvidence,evidenceFor,minorPermitIssues,supervised} from './minor-evidence'
const RULE_VERSION='2026-10-27'
const SOURCES:Record<string,string>={federal:'https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture',CA:'https://www.dir.ca.gov/dlse/MinorsSummaryCharts.pdf',NY:'https://dol.ny.gov/hours-work-minors',IL:'https://labor.illinois.gov/laws-rules/fls/child-labor-law-compliance.html',WA:'https://www.lni.wa.gov/workers-rights/youth-employment/hours-of-work',OR:'https://www.oregon.gov/boli/employers/pages/minor-workers.aspx',CO:'https://cdle.colorado.gov/dlss/youth-law'}
export const minorPresets=Object.entries(SOURCES).map(([id,source])=>({id,source,version:RULE_VERSION,scope:'Non-agricultural hour limits and employer document reviews; no hazardous-task clearance'}))
export function minorCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='minor.save')return
 need(c.a.role==='owner','Only the owner maintains private birth and permit records',403)
 keys(p,['staffId','id','revision','birthDate','state','permit','permitThrough','calendarFrom','calendarThrough','schoolDays','schoolStart','schoolEnd','authorizations'])
 const person=c.s.staff.find(x=>x.id===p.staffId&&!x.erased_at);need(person,'Person not found',404)
 const old=c.s.minors.find(x=>x.staffId===person.id);if(old){need(p.id===old.id,'Reload the existing minor record',409);exact(old,p)}
 const birthDate=date(p.birthDate,'birth date');need(birthDate<=localDate(c.now,c.s.timezone),'Birth date cannot be in the future')
 need(Object.hasOwn(SOURCES,p.state),'Choose a maintained state or federal preset')
 const calendarFrom=date(p.calendarFrom,'school calendar start'),calendarThrough=date(p.calendarThrough,'school calendar end');need(calendarThrough>=calendarFrom&&Date.parse(calendarThrough)-Date.parse(calendarFrom)<=366*86400000,'Provide at most one year of school calendar')
 const input=typeof p.schoolDays==='string'?p.schoolDays.split(/[\s,]+/).filter(Boolean):p.schoolDays;need(Array.isArray(input)&&input.length<=366,'Provide dated school days')
 const schoolDays=[...new Set(input.map(x=>date(x,'school date')))];need(schoolDays.every(d=>d>=calendarFrom&&d<=calendarThrough),'School dates must be within the calendar')
 const minute=(v:any)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):Number(v)
 const schoolStart=integer(minute(p.schoolStart),'school start minute',0,1439),schoolEnd=integer(minute(p.schoolEnd),'school end minute',1,1440);need(schoolStart<schoolEnd,'School ends after it starts')
 const {versions,...prior}:any=old??{}
 const permit=text(p.permit,'work permit reference',160,true),permitThrough=p.permitThrough?date(p.permitThrough,'permit expiry'):''
 return put(c,'minors',{staffId:person.id,birthDate,state:p.state,permit,permitThrough,calendarFrom,calendarThrough,schoolDays,schoolStart,schoolEnd,authorizations:minorEvidence(c,{...p,birthDate,permit,permitThrough,calendarFrom,calendarThrough,schoolDays,schoolStart,schoolEnd},old),presetVersion:RULE_VERSION,source:SOURCES[p.state],by:c.a.id,at:c.now,versions:old?[...(versions??[]),prior]:[]},old)
}
const week=(on:string)=>dayAfter(on,-new Date(on+'T00:00:00Z').getUTCDay())
const age=(birth:string,on:string)=>Number(on.slice(0,4))-Number(birth.slice(0,4))-(on.slice(5)<birth.slice(5)?1:0)
function pieces(s:State,w:any){
 const parts:any[]=[],start=Date.parse(w.start),end=Date.parse(w.end);let at=start
 while(at<end){const on=localDate(new Date(at).toISOString(),s.timezone),next=Math.min(end,Date.parse(instantAt(dayAfter(on),'00:00',s.timezone)));parts.push({date:on,start:new Date(at).toISOString(),end:new Date(next).toISOString(),minutes:(w.minutes??(end-start)/60000)*(next-at)/(end-start)});at=next}
 return parts
}
/** No birth date or age leaves this module in a warning. */
export function minorIssues(s:State,staffId:string,w:any,other?:any[],skip:string[]=[]):string[]{
 const r=s.minors.find(x=>x.staffId===staffId);if(!r)return []
 const warnings:string[]=[],add=(v:string)=>warnings.push(`Minor work rule ${r.state} (${RULE_VERSION}): ${v}`)
 const mine=(other??s.shifts.filter(x=>x.status==='published')).filter(x=>x.staffId===staffId&&x.id!==w.id&&!skip.includes(x.id))
 const all=minorWork(s,staffId,w,mine),candidate=pieces(s,w)
 for(const p of candidate){
  const years=age(r.birthDate,p.date);if(years>=18)continue
  if(years<14){add('work under age 14 requires separate authorization');continue}
  if(p.date<r.calendarFrom||p.date>r.calendarThrough){add('school calendar is not configured for this date');continue}
  // A missing calendar date is unknown, never permission to use a holiday limit.
  const weekStart=week(p.date),weekEnd=dayAfter(weekStart,6),nextDate=dayAfter(p.date)
  if((years<16||['NY','WA'].includes(r.state))&&(weekStart<r.calendarFrom||weekEnd>r.calendarThrough))add('school calendar must cover the full workweek')
  if(years>=16&&['CA','WA','NY'].includes(r.state)&&nextDate>r.calendarThrough)add('school calendar must include the next day')
  const site=w.site??s.staff.find(x=>x.id===staffId)?.site??'',authorized=(kind:string)=>evidenceFor(r,kind,p.date,site).length>0
  const school=r.schoolDays.includes(p.date),schoolWeek=r.schoolDays.some((d:string)=>week(d)===week(p.date)),day=new Date(p.date+'T00:00:00Z').getUTCDay(),tomorrow=r.schoolDays.includes(dayAfter(p.date))
  const labor=dayAfter(p.date.slice(0,4)+'-09-01',(8-new Date(p.date.slice(0,4)+'-09-01T00:00:00Z').getUTCDay())%7),summer=p.date>=p.date.slice(0,4)+'-06-01'&&p.date<=labor
  let daily=years<16?(school?180:480):1440,weekly=years<16?(schoolWeek?1080:2400):10080,earliest=years<16?420:0,latest=years<16?(summer?1260:1140):1440,days=7
  if(r.state==='CA'){days=6;if(years>=16){daily=school&&tomorrow?240:480;weekly=2880;earliest=300;latest=tomorrow?1320:1440}}
  if(r.state==='NY'){days=6;if(years>=16){daily=school&&day>=1&&day<=4?240:480;weekly=schoolWeek?1680:2880;earliest=360;latest=schoolWeek?1320:1440;if(schoolWeek&&authorized('parent-consent')&&(!tomorrow||authorized('school-consent')))latest=1440}}
  if(r.state==='IL'&&years<16){days=6;if(school)daily=Math.min(daily,480-(r.schoolEnd-r.schoolStart))}
  if(r.state==='WA'){days=6;if(years<16)weekly=schoolWeek?960:2400;else{daily=schoolWeek&&day>=1&&day<=4?240:480;weekly=schoolWeek?1200:2880;earliest=schoolWeek?420:300;latest=schoolWeek&&day!==5&&day!==6&&tomorrow?1320:1440;if(schoolWeek&&authorized('wa-special-variance')&&authorized('parent-consent')&&authorized('school-consent')){daily=day>=1&&day<=4?360:480;weekly=1680;latest=day===5||day===6?1440:1320}}}
  if(r.state==='OR'&&years>=16)weekly=2640
  if(r.state==='CO'&&years>=16){daily=480;weekly=2400}
  const a=wall(p.start,s.timezone),b=wall(p.end,s.timezone),from=Number(a.time.slice(0,2))*60+Number(a.time.slice(3)),until=b.date===p.date?Number(b.time.slice(0,2))*60+Number(b.time.slice(3)):1440
  const label=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
  const lateCalifornia=r.state==='CA'&&years>=16&&!school&&from<30&&until<=30
  if((from<earliest&&!lateCalifornia)||until>latest)add(`outside permitted clock hours (${label(earliest)}–${label(latest)} venue time)`)
  if(school&&years<16&&from<r.schoolEnd&&until>r.schoolStart)add('work overlaps configured school hours')
  if(r.state==='WA'&&school&&years>=16&&from<r.schoolEnd&&until>r.schoolStart&&!evidenceFor(r,'school-release',p.date,site).some((a:any)=>from>=a.classEndMinute))add('work overlaps configured school hours; school release must establish that active classes have ended')
  const validation=minorPermitIssues(r,p.date,years,site);validation.issues.forEach(add)
  if(validation.permit){daily=Math.min(daily,validation.permit.dailyMinutes);weekly=Math.min(weekly,validation.permit.weeklyMinutes);if(from<validation.permit.startMinute||until>validation.permit.endMinute)add('outside employer-validated permit clock hours')}
  if(r.state==='WA'){
   if(!authorized('parent-consent')||(schoolWeek&&!authorized('school-consent')))add('current parent and applicable school authorization required for this workplace')
   const lateStart=Math.max(Date.parse(p.start),Date.parse(instantAt(p.date,'20:00',s.timezone)))
   if(Date.parse(p.end)>lateStart&&!supervised(s,r,p.date,site,lateStart,Date.parse(p.end)))add('responsible adult supervision must cover all work after 20:00')
  }
  if(r.permitThrough&&p.date>r.permitThrough)add('recorded work permit has expired; employer validation required')
  const dayMinutes=all.filter(x=>x.date===p.date).reduce((n,x)=>n+x.minutes,0)
  if(dayMinutes>daily)add(`${school?'school-day':'daily'} limit ${daily} minutes exceeded`)
  const weekParts=all.filter(x=>week(x.date)===week(p.date))
  if(weekParts.reduce((n,x)=>n+x.minutes,0)>weekly)add(`${schoolWeek?'school-week':'non-school-week'} limit ${weekly} minutes exceeded`)
  if(['CO','IL'].includes(r.state)&&(r.state==='CO'||years<16)&&rollingWork(all,Date.parse(p.start),Date.parse(p.end))>480+1e-8)add('rolling 24-hour limit 480 minutes exceeded')
  if(new Set(weekParts.map(x=>x.date)).size>days)add(`maximum ${days} workdays per week exceeded`)
 }
 return [...new Set(warnings)]
}
export function checkMinorAssignments(s:State,before:State){
 for(const x of s.shifts.filter(x=>x.status==='published')){const old=before.shifts.find(y=>y.id===x.id);if(old?.status==='published'&&old.staffId===x.staffId&&old.start===x.start&&old.end===x.end)continue;const issues=minorIssues(s,x.staffId,x);need(!issues.length,issues.join('; '),409)}
}
export function minorClock(s:State,staffId:string,at:string,shiftId:string|null){
 const shift=s.shifts.find(x=>x.id===shiftId),w:any={...shift,start:at,end:shift?.end&&shift.end>at?shift.end:new Date(Date.parse(at)+60000).toISOString()};w.minutes=(Date.parse(w.end)-Date.parse(at))/60000-(shift?.breakMinutes??0)
 return minorIssues(s,staffId,w,undefined,shift?[shift.id]:[])
}

/** Worked facts are always retained: flag a violation for review, never erase it. */
export function minorTime(s:State,t:Record<string,any>,shiftId?:string|null){
 const clock=s.clocks.find(k=>k.id===t.clockId)
 const source=t.edited||t.corrects?t:t.captured?{...t,...t.captured}:t
 return minorIssues(s,t.staffId,source,undefined,[shiftId,clock?.shiftId,t.segmentPlan?.shiftId].filter(Boolean))
}

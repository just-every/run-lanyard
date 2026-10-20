import {priced} from './workforce'
// REPORT-003: labor percentage and sales per labor hour by 15-, 30- or 60-minute interval for one cafe
// and venue day, for scheduled hours (published shifts) and actual hours (live timesheets and open
// punches up to now), overall and per position, against SALES-001 hourly sales. Each shift, timesheet or
// punch counts by its overlap with the interval scaled by paid minutes over its span (an unpaid break
// spread evenly); cost is those minutes at the person's hourly rate, to the cent. A shorter interval takes
// an equal share of its hour's sales; an hour without hourly sales is incomplete, never zero. Owners and
// that cafe's managers save named dayparts with a target labor percentage; an interval starting inside a
// daypart whose actual labor percentage exceeds its target is flagged.
import {type Context,type Row,type State,keys,text,integer,need,manager,put} from './model'
import {instantAt,localDate} from './settings'
import {siteOf} from './team'
import {salesSite} from './sales'

const clockTime=(v:unknown,label:string)=>{const t=text(v,label,5);need(/^([01]\d|2[0-3]):[0-5]\d$/.test(t)||t==='24:00',`Invalid ${label}: use HH:MM`);return t}
export function dayparts(c:Context,name:string,p:Record<string,any>) {
 if(name!=='daypart.save')return undefined
 manager(c.a);keys(p,['site','name','start','end','targetPercent','revision','removed'])
 const site=text(p.site,'site',80,true),label=text(p.name,'daypart name',40);need(salesSite(c.s,c.a,site),'You do not set targets for this cafe',403)
 const old=c.s.dayparts.find(r=>r.site===site&&r.name.toLowerCase()===label.toLowerCase())
 if(old)need(integer(typeof p.revision==='string'?Number(p.revision):p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'This daypart changed; reload before saving',409)
 if(p.removed===true||p.removed==='true'){need(old,'Daypart not found',404);return put(c,'dayparts',{...old,removed:true,savedBy:c.a.id,savedAt:c.now},old)}
 const start=clockTime(p.start,'start'),end=clockTime(p.end,'end');need(start<end,'A daypart ends after it starts')
 const target=Number(typeof p.targetPercent==='string'?p.targetPercent.replace('%',''):p.targetPercent);need(Number.isFinite(target)&&target>0&&target<=100,'Invalid target labor %')
 need(!c.s.dayparts.some(r=>r!==old&&!r.removed&&r.site===site&&r.start<end&&start<r.end),'Dayparts at a cafe cannot overlap',409)
 return put(c,'dayparts',{site,name:label,start,end,targetPercent:Math.round(target*10)/10,removed:false,savedBy:c.a.id,savedAt:c.now},old)
}
const live=(t:Row)=>['submitted','approved','returned'].includes(t.status)
const at=(v:string)=>Date.parse(v)
export function intervalReport(s:State,site:string,date:string,size:number,now:string) {
 need(/^\d{4}-\d{2}-\d{2}$/.test(date),'Choose a day (YYYY-MM-DD)');need([15,30,60].includes(size),'Intervals are 15, 30 or 60 minutes')
 const tz=s.timezone,person=(id:string)=>s.staff.find(p=>p.id===id),role=(id:string)=>person(id)?.position||'Team'
 const scheduled=s.shifts.filter(x=>x.status==='published'&&siteOf(s,x)===site).flatMap(x=>x.rateBasis?.workSegments?.length?x.rateBasis.workSegments.map((p:any)=>({...x,...p})):x)
 const worked=[...s.timesheets.filter(t=>live(t)&&siteOf(s,t)===site&&!s.timesheets.some(x=>x.corrects===t.id&&live(x))).flatMap(t=>t.workSegments?.length?t.workSegments.map((p:any)=>({...t,...p})):t),...s.clocks.filter(k=>k.status==='open'&&k.start<now&&siteOf(s,k)===site).map(k=>({...k,end:now,minutes:Math.max(0,Math.floor((at(now)-at(k.start))/60000))}))]
 const sales=s.sales.filter(r=>r.site===site&&r.date===date&&r.metric==='sales'&&r.hour!==null)
 const parts=s.dayparts.filter(r=>r.site===site&&!r.removed)
 const count=(list:Row[],a:number,b:number)=>{
  const out={minutes:0,cents:0,byPosition:{} as Record<string,{minutes:number;cents:number}>}
  for(const x of list){const span=at(x.end)-at(x.start),overlap=Math.min(b,at(x.end))-Math.max(a,at(x.start));if(span<=0||overlap<=0)continue
   const basis=priced(s,x.staffId,x),date=localDate(new Date(Math.max(a,at(x.start))).toISOString(),tz),rate=basis.segments.find((v:any)=>v.date===date)?.cents??0
   const m=overlap/60000*x.minutes/(span/60000),c=m*rate/60,r=role(x.staffId),g=out.byPosition[r]??={minutes:0,cents:0}
   out.minutes+=m;out.cents+=c;g.minutes+=m;g.cents+=c}
  const round=(v:{minutes:number;cents:number})=>({minutes:Math.round(v.minutes*100)/100,cents:Math.round(v.cents)})
  return {...round(out),byPosition:Object.fromEntries(Object.entries(out.byPosition).sort().map(([k,v])=>[k,round(v)]))}
 }
 const ratio=(v:{minutes:number;cents:number},cents:number|null)=>({laborPercent:cents?Math.round(v.cents/cents*1000)/10:null,salesPerLaborHour:cents!==null&&v.minutes?Math.round(cents*60/v.minutes):null})
 const intervals=Array.from({length:1440/size},(_,i)=>{
  const hh=String(Math.floor(i*size/60)).padStart(2,'0'),mm=String(i*size%60).padStart(2,'0'),time=`${hh}:${mm}`,next=i*size+size
  const a=at(instantAt(date,time,tz)),b=next>=1440?at(instantAt(new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10),'00:00',tz)):at(instantAt(date,`${String(Math.floor(next/60)).padStart(2,'0')}:${String(next%60).padStart(2,'0')}`,tz))
  const hour=sales.filter(r=>r.hour===Number(hh)),cents=hour.length?Math.round(hour.reduce((n,r)=>n+r.value,0)*size/60):null
  const sched=count(scheduled,a,b),act=count(worked,a,b),part=parts.find(d=>d.start<=time&&time<d.end)??null,actual={...act,...ratio(act,cents)}
  return {time,start:new Date(a).toISOString(),end:new Date(b).toISOString(),salesCents:cents,salesBasis:cents===null?null:size<60?'hourly sales split evenly':'hourly sales',incomplete:cents===null,
   scheduled:{...sched,...ratio(sched,cents)},actual,daypart:part?{name:part.name,targetPercent:part.targetPercent}:null,exceeded:Boolean(part&&actual.laborPercent!==null&&actual.laborPercent>part.targetPercent)}
 })
 return {site,date,size,dayparts:parts.map(({id,revision,name,start,end,targetPercent})=>({id,revision,name,start,end,targetPercent})),intervals}
}

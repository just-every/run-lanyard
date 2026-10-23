// PAYRULE-001: ordered additional pay inside each retained area, never extra worked time.
import {type Context,type State,type Row,keys,text,integer,need,get,exact,put,canonical} from './model'
import {date} from './aca'
import {priced} from './workforce'
export function differentialCommand(c:Context,name:string,p:Record<string,any>) {
 if(name!=='differential.save')return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
 keys(p,['id','revision','name','from','through','site','role','tag','startMinute','endMinute','days','mode','value','order','code'])
 const old=p.id?get(c.s,'differentials',p.id):undefined;if(old)exact(old,p)
 const from=date(p.from,'effective from'),through=p.through?date(p.through,'effective through'):'';need(!through||through>=from,'Effective end precedes start')
 const days=typeof p.days==='string'?p.days.split(',').map(Number):Array.isArray(p.days)?p.days.flatMap((v:any)=>String(v).split(',').map(Number)):p.days
 need(Array.isArray(days)&&days.length>0&&days.length<=7&&new Set(days).size===days.length,'Choose distinct weekdays 0–6')
 days.forEach(d=>integer(d,'weekday',0,6))
 const minute=(v:any,end=false)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v==='00:00'&&end?1440:Number(v.slice(0,2))*60+Number(v.slice(3)):Number(v)
 const startMinute=integer(minute(p.startMinute),'start minute',0,1439),endMinute=integer(minute(p.endMinute,true),'end minute',1,1440);need(startMinute<endMinute,'Use separate rules for a window crossing midnight')
 need(['added','multiplier'].includes(p.mode),'Choose added cents/hour or multiplier')
 const value=Number(p.value);need(Number.isFinite(value)&&(p.mode==='added'?Number.isSafeInteger(value)&&value>=0&&value<=999999:value>=1&&value<=10&&Number.isInteger(value*100)),'Invalid differential value')
 const code=text(p.code,'mapped payroll code',80);need(!['regular','meal premium','rest premium','weekly overtime premium'].includes(code),'Choose a distinct differential code')
 const {versions,...prior}:any=old??{}
 return put(c,'differentials',{name:text(p.name,'name',80),from,through,site:text(p.site,'site',80,true),role:text(p.role,'position',80,true),tag:text(p.tag,'shift tag',120,true),startMinute,endMinute,days:[...days].sort(),mode:p.mode,value,order:integer(Number(p.order),'stacking order',0,999),code,by:c.a.id,at:c.now,versions:old?[...(versions??[]),prior]:[]},old)
}
/** Corrections inherit the complete old rule set, including absence of a rule. */
export function differentialRules(s:State,t:Row):any[] {
 const prior=s.timesheets.find(x=>x.id===t.corrects)
 return prior?.differentialRules??structuredClone(s.differentials)
}
/** Split at UTC minute boundaries (DST repetitions are distinct elapsed minutes).
 * Allocate each area's payable minutes once by elapsed weight/largest remainder.
 * A multiplier operates on the running rate after earlier rules; each line is only its increment. */
export function differentialBasis(s:State,t:Row,rules:any[]) {
 if(!rules.length)return []
 const shift=s.shifts.find(x=>x.id===t.segmentPlan?.shiftId)??s.shifts.find(x=>x.staffId===t.staffId&&x.start<t.end&&x.end>t.start&&x.status==='published')
 const context=s.timesheets.find(x=>x.id===t.corrects)?.differentialContext??t.differentialContext
 const tag=context?.tag??shift?.label??'',role=context?.role??s.staff.find(x=>x.id===t.staffId)?.position??''
 const areas=t.workSegments?.length?t.workSegments:[{...t,rateBasis:priced(s,t.staffId,t)}]
 return areas.flatMap((area:any)=>{
  const pieces:any[]=[],end=Date.parse(area.end),begin=Date.parse(area.start),format=new Intl.DateTimeFormat('en-CA',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
  for(let at=begin;at<end;){
   const next=Math.min(end,(Math.floor(at/60000)+1)*60000),p=Object.fromEntries(format.formatToParts(new Date(at)).map(x=>[x.type,x.value])),on=`${p.year}-${p.month}-${p.day}`,minute=Number(p.hour)*60+Number(p.minute),day=new Date(on+'T00:00:00Z').getUTCDay(),rate=area.rateBasis.segments.find((x:any)=>x.date===on)?.cents??null
   const effective=rules.map(r=>[...(r.versions??[]),r].filter(v=>v.from<=on).sort((a,b)=>a.from.localeCompare(b.from)||a.revision-b.revision).at(-1)).filter(Boolean)
   const active=effective.filter(r=>(!r.through||on<=r.through)&&(!r.site||r.site===area.rateBasis.site)&&(!r.role||r.role===role)&&(!r.tag||r.tag===tag)&&r.days.includes(day)&&r.startMinute<=minute&&minute<r.endMinute).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))
   const signature=canonical([on,rate,active.map(r=>[r.id,r.revision])]),last=pieces.at(-1)
   if(last?.signature===signature){last.end=new Date(next).toISOString();last.weight+=next-at}else pieces.push({signature,date:on,start:new Date(at).toISOString(),end:new Date(next).toISOString(),weight:next-at,rateCents:rate,active,job:area.job??'',area:area.area,site:area.rateBasis.site})
   at=next
  }
  const total=end-begin;for(const p of pieces)p.minutes=Math.floor(area.minutes*p.weight/total)
  let left=area.minutes-pieces.reduce((n,p)=>n+p.minutes,0)
  for(const p of [...pieces].sort((a,b)=>(area.minutes*b.weight/total-b.minutes)-(area.minutes*a.weight/total-a.minutes)||a.start.localeCompare(b.start)))if(left-->0)p.minutes++
  return pieces.map(({signature,weight,active,...p})=>{
   let rate=p.rateCents
   const additions=active.map((r:any)=>{const increment=r.mode==='added'?r.value:rate===null?null:rate*(r.value-1);if(rate!==null&&increment!==null)rate+=increment;return {ruleId:r.id,ruleRevision:r.revision,name:r.name,code:r.code,order:r.order,mode:r.mode,value:r.value,unitCents:increment,costCents:increment===null?null:Math.round(p.minutes*increment/60)}})
   return {...p,baseCostCents:p.rateCents===null?null:Math.round(p.minutes*p.rateCents/60),additions,costCents:additions.some((x:any)=>x.costCents===null)?null:additions.reduce((n:number,x:any)=>n+x.costCents,0)}
  })
 })
}
const key=(l:any)=>canonical([l.job??'',l.area??'',l.site,l.payCode,l.ruleId])
export function differentialLines(c:Context,t:Row,base:Record<string,any>) {
 const groups=new Map<string,any>()
 for(const p of t.differentialBasis??[])for(const a of p.additions){need(a.costCents!==null,'Differential needs a retained hourly rate',409);const line={...base,...p,...a,payCode:a.code,differentialLine:true},k=key(line),old=groups.get(k);groups.set(k,{...line,start:old?.start??p.start,minutes:(old?.minutes??0)+p.minutes,costCents:(old?.costCents??0)+a.costCents})}
 const previous=c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines).filter((l:any)=>l.rootId===t.rootId&&l.differentialLine)
 for(const l of previous){const k=key(l),old=groups.get(k);groups.set(k,{...l,...base,...old,minutes:(old?.minutes??0)-l.minutes,costCents:(old?.costCents??0)-l.costCents})}
 return [...groups.values()].filter(l=>l.minutes||l.costCents).map(({additions,...l})=>l)
}
export function differentialEstimate(s:State,staffId:string,start:string,end:string){
 const parts=s.timesheets.filter(t=>t.staffId===staffId&&t.status==='approved').flatMap(t=>t.differentialBasis??[]).filter(p=>p.date>=start&&p.date<=end)
 return {baseCostCents:parts.some(p=>p.baseCostCents===null)?null:parts.reduce((n,p)=>n+p.baseCostCents,0),baseMinutes:parts.reduce((n,p)=>n+p.minutes,0),minutes:parts.filter(p=>p.additions.length).reduce((n,p)=>n+p.minutes,0),costCents:parts.some(p=>p.costCents===null)?null:parts.reduce((n,p)=>n+p.costCents,0)}
}

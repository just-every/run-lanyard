import {laborCosts} from './labor-cost'
// SALES-001: sales and workload entered by hand or from a CSV, for cafes whose POS has no connector.
// Each value is one cafe, venue date, hour (or the whole day), metric and value; a day holds either one
// daily value or hourly values per metric. Every value is labelled manual (form or CSV) and a correction
// keeps each earlier value with who and when. The owner enters for any cafe, a manager for their home
// cafe (until TEAM-001); staff and agent keys never read sales.
import {type Actor,type Context,type Row,type State,keys,text,integer,need,manager,put,sha,canonical} from './model'
import {localDate} from './settings'
import {siteOf} from './team'
import {weekOf} from './openshifts'
import {parse} from '../movein/csv'

const COUNTS=['transactions','covers'],FIELDS=['date','hour','site','sales','transactions','covers']
const isDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
const home=(s:State,a:Actor)=>s.staff.find(p=>p.id===a.staffId)?.site??''
/** The cafes this person enters and reads sales for: every cafe for the owner, a manager's home cafe. */
export const salesSite=(s:State,a:Actor,site:string)=>a.role==='owner'||a.role==='manager'&&site===home(s,a)
function metricOf(v:unknown) {
 const m=text(v,'metric',40).trim().toLowerCase();need(/^[a-z][a-z ]*$/.test(m),'A metric is sales, transactions, covers or a name in letters');return m
}
function hourOf(v:unknown):number|null {
 if(v===undefined||v===null||v==='')return null
 const t=typeof v==='number'?String(v):text(v,'hour',5),m=t.match(/^(\d{1,2})(?::00)?$/);need(m&&Number(m[1])<=23,'Invalid hour: use 0–23 or HH:00');return Number(m![1])
}
/** Sales are whole cents from dollars ("$1,234.56"); counts and named metrics are whole numbers. */
function valueOf(metric:string,v:unknown) {
 const t=typeof v==='number'?String(v):text(v,metric,20).replace(/[$,\s]/g,'')
 if(metric==='sales'){need(/^\d+(\.\d{1,2})?$/.test(t),'Invalid sales: dollars and cents');return integer(Math.round(Number(t)*100),'sales',0,1_000_000_000)}
 need(/^\d+$/.test(t),`Invalid ${metric}: a whole number`);return integer(Number(t),metric,0,10_000_000)
}
type Entry={site:string;date:string;hour:number|null;metric:string;value:number}
const same=(r:Row|Entry,e:Entry)=>r.site===e.site&&r.date===e.date&&r.metric===e.metric
/** Why an entry cannot be added beside the cafe's existing values (or the other entries before it), or null. */
function clash(rows:(Row|Entry)[],e:Entry) {
 if(rows.some(r=>same(r,e)&&r.hour===e.hour))return `${e.metric} for ${e.date}${e.hour===null?'':` ${e.hour}:00`} is already entered`
 if(rows.some(r=>same(r,e)&&(r.hour===null)!==(e.hour===null)))return `${e.date} already has ${e.hour===null?'hourly':'a daily'} ${e.metric}`
 return null
}
/** Mapping: field → CSV column, as an object or "field=Column" lines; fields are date, hour, site, sales, transactions, covers or metric:<name>. Unmapped headers that name a field map to it. */
function mappingOf(v:unknown,header:string[]) {
 const given:Record<string,string>=typeof v==='string'?Object.fromEntries(v.split(/[;\n]/).map(x=>x.split('=').map(y=>y.trim())).filter(x=>x.length===2&&x[0]&&x[1])):v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,string>:{}
 need(v===undefined||v===''||Object.keys(given).length,'Invalid mapping: field=Column lines')
 const out:Record<string,number>={},low=header.map(x=>x.trim().toLowerCase())
 for(const f of FIELDS){const i=low.indexOf(f);if(i>=0)out[f]=i}
 for(const [f,col] of Object.entries(given)){need(FIELDS.includes(f)||/^metric:[a-z][a-z ]*$/.test(f),`Unknown mapping field ${f}`);const i=low.indexOf(String(col).trim().toLowerCase());need(i>=0,`No column named ${col}`);out[f]=i}
 need('date' in out,'Map a date column');need(Object.keys(out).some(f=>f==='sales'||COUNTS.includes(f)||f.startsWith('metric:')),'Map at least one metric column')
 return out
}
/** The reviewed preview of an upload: its entries, duplicates (against the cafe's values and earlier file rows) and row errors. */
export async function previewOf(s:State,a:Actor,p:Record<string,any>) {
 need(typeof p.csv==='string'&&p.csv.trim()&&p.csv.length<=200_000,'Paste a CSV of up to 200,000 characters');const csv=p.csv,rows=parse(csv).filter(r=>r.cells.some(c=>c.trim()));need(rows.length>1,'The CSV needs a header and at least one row')
 const map=mappingOf(p.mapping,rows[0].cells),fixed=text(p.site,'site',80,true),entries:(Entry&{line:number})[]=[],errors:{line:number;message:string}[]=[],duplicates:{line:number;reason:string}[]=[]
 for(const r of rows.slice(1)) {
  const cell=(f:string)=>f in map?(r.cells[map[f]]??'').trim():''
  try {
   const site='site' in map?cell('site'):fixed,date=cell('date');need(isDate(date),'Invalid date: use YYYY-MM-DD');need(salesSite(s,a,site),`You do not enter sales for ${site||'this cafe'}`,403)
   const hour=hourOf(cell('hour'))
   for(const f of Object.keys(map).filter(f=>f==='sales'||COUNTS.includes(f)||f.startsWith('metric:'))){const raw=cell(f);if(!raw)continue;const metric=f.startsWith('metric:')?f.slice(7):f
    const e={site,date,hour,metric,value:valueOf(metric,raw)},why=clash([...s.sales,...entries],e);if(why)duplicates.push({line:r.line,reason:why});entries.push({...e,line:r.line})}
  } catch(error:any){errors.push({line:r.line,message:error.message})}
 }
 return {entries,duplicates,errors,fingerprint:await sha(canonical(entries))}
}
export async function sales(c:Context,name:string,p:Record<string,any>) {
 if(name==='sales.save') {
  manager(c.a);keys(p,['id','revision','site','date','hour','metric','value'])
  if(p.id!==undefined) {
   // A correction: the same cafe, day, hour and metric with a new value; earlier values stay.
   const r=c.s.sales.find(x=>x.id===p.id);need(r,'Sales entry not found',404);need(salesSite(c.s,c.a,r.site),'Not found',404)
   need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===r.revision,'This entry changed; reload before correcting',409)
   const value=valueOf(r.metric,p.value);need(value!==r.value,'Nothing to correct')
   return put(c,'sales',{...r,value,source:'form',versions:[...r.versions,{value:r.value,source:r.source,by:r.savedBy,at:r.savedAt}],savedBy:c.a.id,savedAt:c.now},r)
  }
  const site=text(p.site,'site',80,true),date=text(p.date,'date',10);need(isDate(date),'Invalid date: use YYYY-MM-DD');need(salesSite(c.s,c.a,site),'You do not enter sales for this cafe',403)
  const metric=metricOf(p.metric),e={site,date,hour:hourOf(p.hour),metric,value:valueOf(metric,p.value)},why=clash(c.s.sales,e);need(!why,`${why}; correct it instead`,409)
  return put(c,'sales',{...e,source:'form',versions:[],savedBy:c.a.id,savedAt:c.now})
 }
 if(name==='sales.preview'){manager(c.a);keys(p,['csv','mapping','site']);return previewOf(c.s,c.a,p)}
 if(name==='sales.import') {
  manager(c.a);keys(p,['csv','mapping','site','fingerprint']);const v=await previewOf(c.s,c.a,p)
  need(v.fingerprint===text(p.fingerprint,'fingerprint',64),'The file or the cafe’s sales changed since the preview; preview again',409)
  need(!v.errors.length,`Fix rows first: ${v.errors.map(e=>`line ${e.line}`).join(', ')}`)
  need(!v.duplicates.length,`Duplicate rows refused: ${v.duplicates.map(d=>`line ${d.line}`).join(', ')}`,409)
  const ids=v.entries.map(({line,...e})=>put(c,'sales',{...e,source:'csv',versions:[],savedBy:c.a.id,savedAt:c.now}).id)
  return {imported:ids.length,ids}
 }
 return undefined
}
/** A cafe's week of entered sales beside its scheduled labor: labor % = scheduled labor cost / entered sales (one decimal), sales per labor hour = entered sales / scheduled hours (to the cent). */
export function salesWeek(s:State,week:string,site:string) {
 const dates=[0,1,2,3,4,5,6].map(i=>new Date(Date.parse(week+'T00:00:00Z')+i*86400000).toISOString().slice(0,10))
 const costs=laborCosts(s,week,site,new Date().toISOString()),worked=costs.actual.sourceCount>0
 const ratio=(sales:number,cents:number|null,minutes:number)=>({laborPercent:sales&&cents!==null?Math.round(cents/sales*1000)/10:null,salesPerLaborHour:sales&&minutes?Math.round(sales*60/minutes):null})
 const days=dates.map((date,i)=>{
  const rows=s.sales.filter(r=>r.site===site&&r.date===date),labor=costs.days[i][worked?'actual':'scheduled']
  const total=(metric:string)=>rows.some(r=>r.metric===metric)?rows.filter(r=>r.metric===metric).reduce((n,r)=>n+r.value,0):null
  const cents=labor.totalCents,minutes=labor.minutes,salesCents=total('sales')
  const metrics=Object.fromEntries([...new Set(rows.map(r=>r.metric))].sort().map(m=>[m,total(m)]))
  return {date,salesCents,metrics,hourly:rows.some(r=>r.hour!==null),label:rows.length?'Manual':null,laborBasis:worked?'worked estimate':'scheduled estimate',laborCents:cents,laborMinutes:minutes,...ratio(salesCents??0,cents,minutes),entries:rows.map(r=>({id:r.id,revision:r.revision,hour:r.hour,metric:r.metric,value:r.value,source:r.source,versions:r.versions,savedAt:r.savedAt}))}
 })
 const entered=days.filter(d=>d.salesCents!==null),sum=(k:'salesCents'|'laborCents'|'laborMinutes')=>entered.reduce((n,d)=>n+(d[k]??0),0)
 const laborCents=entered.some(d=>d.laborCents===null)?null:sum('laborCents')
 return {week,site,days,entered:{days:entered.length,laborBasis:worked?'worked estimate':'scheduled estimate',salesCents:sum('salesCents'),laborCents,laborMinutes:sum('laborMinutes'),...ratio(sum('salesCents'),laborCents,sum('laborMinutes'))}}
}

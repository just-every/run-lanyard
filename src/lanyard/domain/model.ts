export type Actor = { id: string; email: string; role: 'owner'|'manager'|'staff'|'agent'; staffId?: string; isOwner?: boolean; name?: string }
export type Row = { id: string; revision: number; [key: string]: any }
export const kinds = ['availability','leave','rosters','shifts','clocks','timesheets','batches','forecasts','offers','teamviews','clockrules','leaverules','postings','mealrules','templates','recurrences','patterns','availrules'] as const
export type Kind = typeof kinds[number]
export type Staff = { id:string; name:string; email:string; payroll_id:string|null; role:'staff'|'manager'; active:number; version:number; erased_at:string|null; position:string|null; rate_cents:number|null; site:string|null }
export type State = {version:number;timezone:string;staff:Staff[];claims:any[]} & Record<Kind,Row[]>
export type Context = { a:Actor; s:State; now:string; sql:D1PreparedStatement[]; db:D1Database; entity:string }
export function fail(message:string,status=400):never { throw Object.assign(new Error(message),{status}) }
export function need(value:unknown,message:string,status=400):asserts value { if(!value) fail(message,status) }
export function object(value:unknown):Record<string,any> { need(value && typeof value==='object' && !Array.isArray(value),'Expected an object'); return value as Record<string,any> }
export function keys(p:Record<string,any>,allowed:string[]) { need(Object.keys(p).every(k=>allowed.includes(k)), 'Unknown input field') }
export function text(v:unknown,label:string,max=120,optional=false):string { if(optional && (v===undefined||v==='')) return ''; need(typeof v==='string' && v.trim().length>0 && v.length<=max && !/[\u0000-\u001f\u007f]/.test(v),`Invalid ${label}`); return v.trim() }
export function integer(v:unknown,label:string,min:number,max:number):number { need(typeof v==='number' && Number.isSafeInteger(v) && v>=min && v<=max,`Invalid ${label}`); return v }
export function instant(v:unknown,label='timestamp'):string { need(typeof v==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v),`Invalid ${label}: use ISO UTC`); const d=new Date(v); need(Number.isFinite(d.getTime()) && d.toISOString().slice(0,19)===v.slice(0,19),`Invalid ${label}`); return d.toISOString() }
export function window(p:Record<string,any>,maxDays=366) { const start=instant(p.start,'start'),end=instant(p.end,'end'); need(end>start && Date.parse(end)-Date.parse(start)<=maxDays*86400000,'Invalid time range'); return {start,end} }
export function work(p:Record<string,any>) { const w=window(p,2),breakMinutes=integer(p.breakMinutes,'breakMinutes',0,1440),minutes=Math.floor((Date.parse(w.end)-Date.parse(w.start))/60000)-breakMinutes; need(minutes>0,'Break must be shorter than worked time'); return {...w,breakMinutes,minutes} }
export const overlap=(a:Record<string,any>,b:Record<string,any>)=>a.start<b.end && a.end>b.start
export function get(s:State,k:Kind,id:unknown):Row { return s[k].find(r=>r.id===text(id,'id')) ?? fail('Not found',404) }
export function exact(r:Row,p:Record<string,any>) { need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===r.revision,'Revision changed; reload before deciding',409) }
export function put(c:Context,k:Kind,value:Record<string,any>,old?:Row):Row { const r={...value,id:old?.id??crypto.randomUUID(),revision:(old?.revision??0)+1}; c.s[k]=old?c.s[k].map(v=>v.id===old.id?r:v):[...c.s[k],r]; c.entity=r.id;return r }
export function manager(a:Actor) { need(a.role==='owner'||a.role==='manager','Manager approval required',403) }
export function prepare(a:Actor) { need(['owner','manager','agent'].includes(a.role),'Manager or delegated agent required',403) }
export function self(a:Actor) { need(a.role!=='agent'&&a.staffId,'Your session is not linked to active staff',403); return a.staffId }
export function staff(c:Context,id:unknown) { const r=c.s.staff.find(v=>v.id===text(id,'staffId'));need(r&&r.active&&!r.erased_at,'Active staff required');return r }
export async function sha(value:string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('') }
export function canonical(value:any):string { if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value) }

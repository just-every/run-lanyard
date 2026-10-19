// US formats in the venue's time zone, rendered on the server so every screen reads
// the same without JavaScript: "Mon Oct 19", "7:00 am – 3:00 pm", "$1,050.00", "30.0".
const cache=new Map<string,Intl.DateTimeFormat>()
function fmt(tz:string,options:Intl.DateTimeFormatOptions) {
 const key=tz+JSON.stringify(options);let f=cache.get(key)
 if(!f){f=new Intl.DateTimeFormat('en-US',{timeZone:tz,...options});cache.set(key,f)}
 return f
}
const parts=(tz:string,v:string|number|Date,options:Intl.DateTimeFormatOptions)=>Object.fromEntries(fmt(tz,options).formatToParts(new Date(v)).map(p=>[p.type,p.value]))

/** The venue calendar date of an instant, as YYYY-MM-DD. */
export function dateKey(v:string|number|Date,tz:string) {
 const p=parts(tz,v,{year:'numeric',month:'2-digit',day:'2-digit'});return `${p.year}-${p.month}-${p.day}`
}
/** A calendar date moved by whole days (dates only, so time zones never shift it). */
export const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10)
/** The Monday that starts the venue week holding this date. */
export function mondayOf(date:string) { const d=new Date(date+'T00:00:00Z').getUTCDay();return addDays(date,-((d+6)%7)) }
export const isMonday=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').getUTCDay()===1&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
/** A calendar date as "Mon Oct 19" (or "Oct 19" with weekday false). */
export function day(date:string,weekday=true) {
 return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',...(weekday?{weekday:'short'}:{}),month:'short',day:'numeric'}).format(new Date(date+'T12:00:00Z')).replace(',','')
}
export const weekday=(date:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short'}).format(new Date(date+'T12:00:00Z'))
/** A wall-clock time as "7:00 am". */
export const clock=(v:string|number|Date,tz:string)=>fmt(tz,{hour:'numeric',minute:'2-digit'}).format(new Date(v)).replace(/\s?([AP])M/,(_,m)=>` ${m.toLowerCase()}m`)
export const span=(start:string,end:string,tz:string)=>`${clock(start,tz)} – ${clock(end,tz)}`
/** An instant as "Sat Oct 24, 2026, 6:22 am PT". */
export function stamp(v:string|number|Date,tz:string,year=true) {
 const zone=parts(tz,v,{timeZoneName:'shortGeneric'}).timeZoneName??''
 return `${day(dateKey(v,tz))}${year?`, ${dateKey(v,tz).slice(0,4)}`:''}, ${clock(v,tz)} ${zone}`.trim()
}
/** An instant as "Wed Oct 14, 4:30 pm" (no year, no zone). */
export const when=(v:string|number|Date,tz:string)=>`${day(dateKey(v,tz))}, ${clock(v,tz)}`
export const hours=(minutes:number)=>(minutes/60).toFixed(1)
export const money=(cents:number)=>'$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
export const dollars=(whole:number)=>'$'+whole.toLocaleString('en-US')
export const percent=(part:number,whole:number)=>whole>0?(part/whole*100).toFixed(1)+'%':'—'
/** The short zone name, such as "PT". */
export const zoneName=(tz:string)=>parts(tz,Date.now(),{timeZoneName:'shortGeneric'}).timeZoneName??tz
/** US venue zones as People offers them: [IANA zone, region, city]. */
export const ZONES:[string,string,string][]=[['America/Los_Angeles','Pacific','Los Angeles'],['America/Denver','Mountain','Denver'],['America/Phoenix','Arizona','Phoenix'],['America/Chicago','Central','Chicago'],['America/New_York','Eastern','New York'],['America/Anchorage','Alaska','Anchorage'],['Pacific/Honolulu','Hawaii','Honolulu']]
const longZone=(tz:string)=>parts(tz,Date.now(),{timeZoneName:'longGeneric'}).timeZoneName??tz
/** A venue zone as People labels it, "Pacific (Los Angeles)". */
export function zoneLabel(tz:string) { const z=ZONES.find(([id])=>id===tz);return z?`${z[1]} (${z[2]})`:longZone(tz) }
/** A venue zone in a sentence, "Pacific time (Los Angeles)". */
export function zoneTime(tz:string) { const z=ZONES.find(([id])=>id===tz);return z?`${z[1]} time (${z[2]})`:longZone(tz) }
export const initials=(name:string)=>name.split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?'
/** An instant as the venue wall time a datetime-local input holds ("2026-10-24T07:00"). */
export function wallInput(v:string|number|Date,tz:string) {
 const p=parts(tz,v,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

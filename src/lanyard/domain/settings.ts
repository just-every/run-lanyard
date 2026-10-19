import {type Context,keys,text,need,fail} from './model'

export function timezone(value:unknown):string {
 const name=text(value,'timezone',80)
 // Named IANA zones (including UTC and Etc/GMT aliases), never numeric offsets.
 need(/^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)*$/.test(name),'Use a supported IANA timezone')
 try { return new Intl.DateTimeFormat('en-CA',{timeZone:name}).resolvedOptions().timeZone }
 catch { return fail('Use a supported IANA timezone') }
}

/** Compare venue calendar dates without assuming a fixed UTC offset or DST. */
export function localDate(instant:string,timeZone:string):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,calendar:'iso8601',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant))
 const part=(kind:string)=>parts.find(p=>p.type===kind)!.value
 return `${part('year')}-${part('month')}-${part('day')}`
}

/** An instant's venue wall date and HH:MM. */
export function wall(instant:string|number,tz:string) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]))
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}
}
/** The UTC instant of a venue wall date and time (the later instant when a DST change repeats it). */
export function instantAt(day:string,time:string,tz:string) {
 const target=Date.parse(`${day}T${time}:00Z`);let guess=target
 for(let i=0;i<3;i++){const w=wall(guess,tz);guess+=target-Date.parse(`${w.date}T${w.time}:00Z`)}
 return new Date(guess).toISOString()
}
export function settings(c:Context,name:string,p:Record<string,any>) {
 if(name!=='settings.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['timezone'])
 const next=timezone(p.timezone)
 need(!c.s.rosters.some(r=>r.status==='published'||r.publishedAt),'Venue timezone is fixed after the first published roster',409)
 c.s.timezone=next;c.entity='settings'
 return {timezone:next}
}

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

export function settings(c:Context,name:string,p:Record<string,any>) {
 if(name!=='settings.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['timezone'])
 const next=timezone(p.timezone)
 need(!c.s.rosters.some(r=>r.status==='published'||r.publishedAt),'Venue timezone is fixed after the first published roster',409)
 c.s.timezone=next;c.entity='settings'
 return {timezone:next}
}

// The schedule week as data: which revision is shown, the cafe, its people grouped by
// position, each person's shifts by day and week hours, and the labor footer's figures.
import {manager,rows,staffOf,venue} from './shared'
import {addDays,dateKey,isMonday,mondayOf} from './format'

export const VISIBLE_ROWS=7
export type Row={person:any;guest:boolean;cells:any[][];minutes:number;extra:boolean;cover?:any}
export type Group={name:string;rate:number|null;rows:Row[]}

/** Cafes come from people's home cafe and the cafes shifts were scheduled at. */
export function sitesOf(s:any):string[] {
 return [...new Set([...rows(s,'staff').filter(p=>p.active).map(p=>p.site),...rows(s,'shifts').map(x=>x.site)].filter(Boolean))].sort()
}
function defaultSite(s:any,sites:string[]) {
 const mine=staffOf(s,s.actor.staffId)?.site
 if(mine&&sites.includes(mine))return mine
 const count=(site:string)=>rows(s,'staff').filter(p=>p.active&&p.site===site).length
 return [...sites].sort((a,b)=>count(b)-count(a))[0]??''
}
/** The cafe a screen shows: the one asked for, all of them, or the viewer's (else the largest). */
export function siteOf(s:any,q:URLSearchParams,sites=sitesOf(s)) {
 const asked=q.get('site')??''
 return asked==='all'?'':sites.includes(asked)?asked:defaultSite(s,sites)
}
/** `focus` (the Schedule) lets the default week follow an open call-out; other screens stay on this week. */
export function weekModel(s:any,now:number,q:URLSearchParams,focus=false) {
 const tz=venue(s),today=dateKey(now,tz),thisWeek=mondayOf(today),at=new Date(now).toISOString()
 const open=(x:any)=>x.callout&&(!x.callout.coveredBy||rows(s,'coverageCases').some(c=>c.shiftId===x.id&&c.status==='reopened'))&&x.end>at
 // The Schedule opens on this week, or on next week when only next week holds a call-out still waiting for cover.
 const waiting=(monday:string)=>rows(s,'shifts').some(x=>x.status==='published'&&open(x)&&mondayOf(dateKey(x.start,tz))===monday)
 const week=isMonday(q.get('week'))?q.get('week')!:focus&&manager(s)&&!waiting(thisWeek)&&waiting(addDays(thisWeek,7))?addDays(thisWeek,7):thisWeek
 const days=[0,1,2,3,4,5,6].map(i=>addDays(week,i)),sites=sitesOf(s)
 const site=siteOf(s,q,sites)
 const rosters=rows(s,'rosters').filter(r=>r.week===week),published=rosters.find(r=>r.status==='published'),draft=rosters.find(r=>r.status==='draft')
 const view:'published'|'draft'|null=q.get('view')==='draft'&&draft?'draft':published?'published':draft?'draft':null
 const roster=view==='draft'?draft:view==='published'?published:null
 const shifts=roster?rows(s,'shifts').filter(x=>x.rosterId===roster.id&&x.status===roster.status):[]
 const homeOf=(x:any)=>x.site||staffOf(s,x.staffId)?.site||''
 const here=(x:any)=>!site||homeOf(x)===site
 const dayOf=(x:any)=>days.indexOf(dateKey(x.start,tz))
 // A shift someone called out of and a manager has covered stays visible in their row as a ghost.
 const ghosts=shifts.filter(x=>x.callout?.coveredBy&&x.callout.staffId)
 const callouts=shifts.filter(x=>open(x)&&here(x))
 const accepted=rows(s,'offers').filter(o=>o.status==='accepted'&&callouts.some(x=>x.id===o.shiftId))
 const members=rows(s,'staff').filter(p=>(p.active&&(!site||p.site===site))||shifts.some(x=>x.staffId===p.id&&here(x)&&(!site||p.site===site)))
 const guests=rows(s,'staff').filter(p=>!members.includes(p)&&(shifts.some(x=>x.staffId===p.id&&here(x))||accepted.some(o=>o.staffId===p.id)))
 // The people an open call-out names (the caller, the qualified, and the two the shortlist names as left out) stay in view.
 // So do the caller and the cover of a call-out decided this week, so the decision stays on screen.
 const involved=new Set<string>([...ghosts.filter(here).flatMap(x=>[x.callout.staffId,x.callout.coveredBy]),...callouts.flatMap(x=>[x.staffId,...(x.callout.qualified??[]).map((f:any)=>f.staffId),...(x.callout.leftOut??[]).filter((f:any)=>f.reason==='overtime'||f.reason==='already on').slice(0,2).map((f:any)=>f.staffId)])])
 const build=(p:any,guest:boolean):Row=>{
  const own=shifts.filter(x=>x.staffId===p.id&&(!guest||here(x)))
  const cells=days.map((_,i)=>[...own.filter(x=>dayOf(x)===i),...ghosts.filter(x=>x.callout.staffId===p.id&&dayOf(x)===i).map(x=>({...x,ghost:true}))])
  return {person:p,guest,cells,minutes:shifts.filter(x=>x.staffId===p.id).reduce((n,x)=>n+x.minutes,0),extra:false,cover:accepted.find(o=>o.staffId===p.id)}
 }
 const rank=(r:Row)=>r.cells.flat().some(x=>open(x))?0:involved.has(r.person.id)?1:2
 const byGroup=new Map<string,Row[]>()
 for(const r of [...members.map(p=>build(p,false)),...guests.map(p=>build(p,true))]){const g=r.person.position||'Team';byGroup.set(g,[...(byGroup.get(g)??[]),r])}
 const rateOf=(list:Row[])=>{const rates=[...new Set(list.map(r=>r.person.hourlyRateCents).filter((v:any)=>typeof v==='number'))];return rates.length===1?rates[0] as number:null}
 const groups:Group[]=[...byGroup].map(([name,list])=>({name,rate:rateOf(list.filter(r=>!r.guest)),rows:list.sort((a,b)=>Number(a.guest)-Number(b.guest)||rank(a)-rank(b)||b.minutes-a.minutes||a.person.name.localeCompare(b.person.name))}))
  .sort((a,b)=>Number(a.name==='Team')-Number(b.name==='Team')||Math.max(0,...b.rows.map(r=>r.person.hourlyRateCents??0))-Math.max(0,...a.rows.map(r=>r.person.hourlyRateCents??0))||a.name.localeCompare(b.name))
 // Rows in an open call-out always show; the rest fold under "+ N more staff" after the first few.
 let shown=0
 for(const g of groups)for(const r of g.rows)if(!r.guest)r.extra=++shown>VISIBLE_ROWS&&rank(r)===2&&!q.has('all')
 const extraCount=groups.flatMap(g=>g.rows).filter(r=>r.extra).length
 const forecast=rows(s,'forecasts').find(f=>f.week===week&&(f.site??'')===site)
 const atSite=shifts.filter(here)
 const basis=(x:any)=>x.rateBasis??rows(s,'rateSnapshots').find(r=>r.subjectId===x.id&&r.staffId===x.staffId)?.basis
 const cost=(x:any)=>basis(x)?basis(x).costCents??0:Math.round(x.minutes*(staffOf(s,x.staffId)?.hourlyRateCents??0)/60)
 const labor=days.map((_,i)=>atSite.filter(x=>dayOf(x)===i).reduce((n,x)=>n+cost(x),0))
 const laborMinutes=days.map((_,i)=>atSite.filter(x=>dayOf(x)===i).reduce((n,x)=>n+x.minutes,0))
 const unrated=new Set(atSite.filter(x=>basis(x)?basis(x).costCents===null:typeof staffOf(s,x.staffId)?.hourlyRateCents!=='number').map(x=>x.staffId)).size
 const people=new Set(shifts.map(x=>x.staffId)),confirmed=[...people].filter(id=>shifts.filter(x=>x.staffId===id).every(x=>x.confirmedAt)).length
 const headcount=rows(s,'staff').filter(p=>p.active&&(!site||p.site===site)).length
 return {tz,today,week,days,sites,site,published,draft,view,roster,shifts,groups,callouts,forecast,labor,laborMinutes,unrated,people:people.size,confirmed,headcount,extraCount}
}
export type Week=ReturnType<typeof weekModel>

// CLOCK-008: a clocked-in employee changes job, or cafe where their profile allows,
// without clocking out. Clock-out turns the changes into SCHEDULE-004 work segments.
import {type Context,type State,type Row,keys,text,need,self,instant,put} from './model'
import {qualification} from './workforce'
import {siteOf} from './team'
import {checkNetwork} from './clocknets'
import {provisional} from './closerules'

/** The job and cafe a punch starts on: its matched shift's, else no job at the home cafe. */
export function startOf(s:State,open:Row) {
 const shift=open.shiftId?s.shifts.find(x=>x.id===open.shiftId):undefined
 return {job:shift?.job??'',site:shift?siteOf(s,shift):s.staff.find(p=>p.id===open.staffId)?.site??''}
}
export function currentOf(s:State,open:Row) {const last=(open.transfers??[]).at(-1);return last?{job:last.job,site:last.site}:startOf(s,open)}

export function transfers(c:Context,name:string,p:Record<string,any>) {
 if(name!=='clock.transfer')return undefined
 keys(p,['commandId','capturedAt','job','site']);const staffId=self(c.a)!,at=instant(p.capturedAt,'capturedAt');need(Date.parse(at)<=Date.parse(c.now)+60000,'Job change cannot be in the future')
 const open=c.s.clocks.find(r=>r.staffId===staffId&&r.status==='open');need(open,'Clock in before changing job',409)
 need(!open.breaks?.some((b:any)=>!b.end),'End your break before changing job',409)
 need(!provisional(c.s,open,at),'Your clock was provisionally closed; confirm or correct your end time',409)
 const list=open.transfers??[],from=currentOf(c.s,open)
 need(at>open.start&&list.every((t:any)=>at>t.at)&&(open.breaks??[]).every((b:any)=>at>=b.end),'A job change follows your clock-in, your last change and your last break',409)
 const job=text(p.job,'job',80),site=p.site===undefined||p.site===''?from.site:text(p.site,'cafe',80)
 need(job!==from.job||site!==from.site,'You are already working this job here',409)
 // PEOPLE-002: the job, its skills and certifications and the cafe must all hold from the change to the shift's end.
 const shift=open.shiftId?c.s.shifts.find(x=>x.id===open.shiftId):undefined,end=shift&&shift.end>at?shift.end:new Date(Date.parse(at)+60000).toISOString()
 const issue=qualification(c.s,staffId,{job,site,start:at,end});need(!issue,issue??'Not qualified',409)
 // CLOCK-007: moving to another cafe is checked against that cafe's approved networks like a clock-in there.
 const net=site===from.site?{exceptions:[] as string[]}:checkNetwork(c.s,site,c.net)
 const exceptions=[...(open.exceptions??[]),...net.exceptions.filter(e=>!open.exceptions?.includes(e))]
 return put(c,'clocks',{...open,transfers:[...list,{at,job,site,from,by:c.a.id,receivedAt:c.now,commandId:text(p.commandId,'commandId',120),...(net.network?{network:net.network}:{})}],...(exceptions.length?{exceptions}:{})},open)
}

/** An open punch up to `now`, split at its recorded changes; each piece at its own job and cafe. */
export function openPieces(s:State,k:Row,now:string):Row[] {
 now=provisional(s,k,now)?.end??now
 const whole=(a:string,b:string)=>Math.max(0,Math.floor((Date.parse(b)-Date.parse(a))/60000))
 if(!k.transfers?.length)return [{...k,end:now,minutes:whole(k.start,now)}]
 const at=[k.start,...k.transfers.map((t:any)=>t.at).filter((v:string)=>v<now),now],who=[startOf(s,k),...k.transfers]
 return at.slice(0,-1).map((start:string,i:number)=>({...k,job:who[i].job,site:who[i].site,start,end:at[i+1],minutes:whole(start,at[i+1])})).filter((p:any)=>p.end>p.start)
}
/** Recorded changes replace a pinned SCHEDULE-004 area plan for their punch, so each payable minute counts once. */
export function transferPlan(s:State,open:Row,end:string) {
 const list=(open.transfers??[]).filter((t:any)=>t.at<end);if(!list.length)return null
 const origin=Date.parse(open.start),minute=(v:string)=>(Date.parse(v)-origin)/60000,first=startOf(s,open)
 const stops=[...list.map((t:any)=>minute(t.at)),minute(end)]
 return {transfers:true,shiftStart:open.start,shiftEnd:end,site:first.site,segments:[first,...list].map((v:any,i:number)=>({from:i?stops[i-1]:0,until:stops[i],job:v.job,area:'',site:v.site}))}
}

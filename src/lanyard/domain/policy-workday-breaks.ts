import {type State,type Row} from './model'
import {BREAK_VERSION,WORKDAY_BREAK_VERSIONS} from './policy-breaks'
import {breakReviewsFor} from './policy-break-review'
import {californiaRestDays} from './policy-rest-days'
import {workweek} from './payschedules'

/** Meal periods retain their continuous-service timing. California rest counts
 * and their premium cap instead follow the retained employer workday. */
export function workdayBreakReviews(s:State,staffId:string,parts:Parameters<typeof californiaRestDays>[2],rows:Row[],week:string,planned:boolean,ruleOn:(site:string,on:string)=>Row|undefined):Record<string,any>[]{
 const key=(p:Parameters<typeof californiaRestDays>[2][number])=>p.workdayKey??`${staffId}|${p.date}|00:00`
 const selected=new Set(parts.filter(p=>p.minutes>0&&workweek(s,staffId,p.date)===week).map(key))
 // A meal obligation can begin in the prior workweek and still affect a
 // selected employer day. Context supplies evidence, never extra paid time.
 const periods:Record<string,any>[]=breakReviewsFor(s,rows,week,planned,ruleOn,true).filter(period=>
  period.preset!=='CA'||period.version!==BREAK_VERSION||parts.some(p=>p.minutes>0&&period.timeIds.includes(p.timeId)&&selected.has(key(p))))
 const days=californiaRestDays(s,staffId,parts,rows,week,ruleOn,planned)
 for(const period of periods){
  if(period.preset!=='CA'||!(WORKDAY_BREAK_VERSIONS as readonly string[]).includes(period.version))continue
  const source=parts.filter(p=>period.timeIds.includes(p.timeId)&&(period.version!==BREAK_VERSION||p.minutes>0)),keys=new Set(source.map(key))
  period.issues=period.issues.filter((i:any)=>i.kind!=='rest');period.restPremiumMinutes=0
  if(keys.size===1){
   period.workdayKey=[...keys][0];period.workdayDate=source[0]?.workdayDate??source[0]?.date
  }else if(keys.size>1&&(period.version!==BREAK_VERSION||period.issues.some((i:any)=>i.kind==='meal'))){
   period.premiumDayUnknown=true
   period.issues.push({kind:'meal',state:'unknown',message:'Continuous service crosses an employer workday boundary; meal premium allocation requires review'})
  }
 }
 for(const day of days){
  const same=periods.find(p=>p.preset==='CA'&&p.version===day.version&&p.workdayKey===day.workdayKey&&p.timeIds.length===day.timeIds.length&&p.timeIds.every((id:string)=>day.timeIds.includes(id)))
  if(same){same.issues.push(...day.issues);Object.assign(same,{workdayDate:day.workdayDate,workdayKey:day.workdayKey,workedMinutes:day.workedMinutes,requiredRests:day.requiredRests,recordedRests:day.recordedRests,restPremiumMinutes:day.restPremiumMinutes})}
  else periods.push(day)
 }
 return periods
}

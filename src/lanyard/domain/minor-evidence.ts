import {type Context,type Row,type State,keys,need,text,integer,instant} from './model'
import {date} from './aca'

const kinds=['permit','parent-consent','school-consent','school-release','supervision','wa-special-variance']
const permitKinds:Record<string,string>={CA:'individual-work-permit',NY:'employment-certificate',IL:'employment-certificate',WA:'employer-endorsement',OR:'employer-certificate'}
/** Private employer reviews of external documents, never provider verification. */
export function minorEvidence(c:Context,p:Record<string,any>,old:Row|undefined){
 if(p.authorizations===undefined)return old&&old.state===p.state&&old.birthDate===p.birthDate&&old.permit===(p.permit??'')&&old.permitThrough===(p.permitThrough??'')&&['calendarFrom','calendarThrough','schoolStart','schoolEnd'].every(key=>old[key]===p[key])&&JSON.stringify(old.schoolDays)===JSON.stringify(p.schoolDays)?old.authorizations??[]:[]
 need(Array.isArray(p.authorizations)&&p.authorizations.length<=40,'Provide at most 40 minor authorizations')
 return p.authorizations.map((a:any)=>{
  need(a&&typeof a==='object'&&!Array.isArray(a),'Invalid minor authorization')
  keys(a,['kind','reference','from','through','site','permitKind','dailyMinutes','weeklyMinutes','startMinute','endMinute','supervisorId','adultConfirmed','start','end','classEndMinute','schoolYearThrough'])
  need(kinds.includes(a.kind),'Unsupported minor authorization')
  const from=date(a.from,'authorization start'),through=date(a.through,'authorization end')
  need(through>=from&&Date.parse(through)-Date.parse(from)<=366*86400000,'Authorization needs a dated window of at most one year')
  const result:any={kind:a.kind,reference:text(a.reference,'authorization evidence reference',160),from,through,site:text(a.site,'authorization workplace',120),by:c.a.id,at:c.now}
  if(p.state==='WA'&&['parent-consent','school-consent'].includes(a.kind)){
   const renewal=from.slice(0,4)+'-09-30',expiry=from<=renewal?renewal:String(Number(from.slice(0,4))+1)+'-09-30'
   need(through<=expiry,'Washington authorization must renew by September 30')
  }
  if(a.kind==='wa-special-variance'){
   need(p.state==='WA','Special variance is supported only for Washington')
   result.schoolYearThrough=date(a.schoolYearThrough,'school year end')
   need(through<=result.schoolYearThrough,'Special variance cannot outlive the school year')
  }
  if(a.kind==='permit'){
   need(Object.hasOwn(permitKinds,p.state),'This preset has no supported routine work permit')
   need(a.permitKind===permitKinds[p.state],'Choose the permit kind required by this state')
   result.permitKind=a.permitKind
   for(const [key,max] of [['dailyMinutes',1440],['weeklyMinutes',10080],['startMinute',1439],['endMinute',1440]] as const)result[key]=integer(a[key],key,key==='startMinute'?0:1,max)
   need(result.endMinute>result.startMinute,'Permit clock window must end after it begins')
   need(result.reference===p.permit,'Permit evidence must match the recorded permit reference')
   need(p.permitThrough&&through<=date(p.permitThrough,'permit expiry'),'Permit review cannot outlive the permit')
  }
  if(a.kind==='school-release')result.classEndMinute=integer(a.classEndMinute,'last active class minute',0,1439)
  if(a.kind==='supervision'){
   need(a.adultConfirmed===true,'Confirm the responsible supervisor is an adult')
   const supervisor=c.s.staff.find(x=>x.id===a.supervisorId&&x.active&&!x.erased_at&&x.id!==p.staffId)
   need(supervisor,'Choose an active responsible adult other than this employee')
   result.supervisorId=supervisor.id;result.adultConfirmed=true;result.start=instant(a.start);result.end=instant(a.end)
   need(result.end>result.start,'Supervision must cover a positive interval')
  }
  return result
 })
}
export function evidenceFor(r:Row,kind:string,on:string,site:string){return (r.authorizations??[]).filter((a:any)=>a.kind===kind&&a.from<=on&&a.through>=on&&a.site===site)}
export function minorPermitIssues(r:Row,on:string,years:number,site:string){
 const required=Object.hasOwn(permitKinds,r.state)&&(r.state!=='IL'||years<16)
 if(!required)return {issues:[] as string[],permit:undefined}
 const permit=evidenceFor(r,'permit',on,site).find((a:any)=>a.permitKind===permitKinds[r.state]&&a.reference===r.permit)
 return {issues:permit?[]:[`${permitKinds[r.state]} requires current employer validation for this workplace`],permit}
}
function adultOn(s:State,id:string,on:string){
 const birth=s.minors.find(x=>x.staffId===id)?.birthDate
 return !birth||Number(on.slice(0,4))-Number(birth.slice(0,4))-(on.slice(5)<birth.slice(5)?1:0)>=18
}
export function supervised(s:State,r:Row,on:string,site:string,start:number,end:number){
 const intervals=evidenceFor(r,'supervision',on,site).filter((a:any)=>a.adultConfirmed&&adultOn(s,a.supervisorId,on)&&s.staff.some(x=>x.id===a.supervisorId&&x.active&&!x.erased_at)).map((a:any)=>[Date.parse(a.start),Date.parse(a.end)]).sort((a:any,b:any)=>a[0]-b[0])
 let covered=start
 for(const [a,b] of intervals){if(a>covered)break;if(b>covered)covered=b;if(covered>=end)return true}
 return false
}

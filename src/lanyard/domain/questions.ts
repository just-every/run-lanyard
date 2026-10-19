// CLOCK-006: clock-in and clock-out questions. The owner sets short questions per cafe or position
// (breaks taken, injury today, cash tips declared, or a custom yes-no or number) with optional
// Spanish text; each wording change is a new version. Answers attach to the punch with the wording
// they answered; a "no" to breaks opens a BREAK-001 exception, a flagged custom answer a TIME-003
// exception, and an injury answer a private safety follow-up for the cafe's managers.
import {type Actor,type Context,type Row,type State,keys,text,need,put,get,exact,manager} from './model'
import {siteOf} from './team'

export const QKINDS=['breaks','injury','tips','yesno','number']
const MOMENTS=['in','out']
const yes=(v:unknown)=>v===true||v==='true'||v==='on'
/** Questions in the order the owner added them. */
export const ordered=(list:Row[])=>[...list].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id))

/** A punch's cafe (its matched shift's, else the home cafe) and the person's position decide which questions apply. */
export function questionsFor(s:State,staffId:string,shiftId:string|null|undefined,when:string) {
 const shift=shiftId?s.shifts.find(x=>x.id===shiftId):undefined,person=s.staff.find(p=>p.id===staffId)
 const site=shift?siteOf(s,shift):person?.site??'',position=person?.position??''
 return {site,list:ordered(s.questions).filter(q=>q.active&&q.when===when&&(!q.site||q.site===site)&&(!q.position||q.position===position))}
}
/** Checks the answers given at a punch and records them: punch answers (injury values stay in their follow-up), exception flags, and injury records to attach to the clock. */
export function answer(c:Context,staffId:string,shiftId:string|null|undefined,when:string,given:unknown) {
 const {site,list}=questionsFor(c.s,staffId,shiftId,when),input=given??{}
 need(typeof input==='object'&&!Array.isArray(input),'Invalid answers');const values=input as Record<string,unknown>
 need(Object.keys(values).every(k=>list.some(q=>q.id===k)),'Unknown question for this punch')
 const answers:Record<string,any>[]=[],flags:string[]=[],injuries:Row[]=[]
 for(const q of list) {
  const v=values[q.id]
  if(v===undefined||v===null||v===''){need(!q.required,`Answer: ${q.text}`);continue}
  let value:string|number
  if(q.kind==='tips'){const n=typeof v==='string'?Number(v):v;need(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000&&Math.abs(n*100-Math.round(n*100))<1e-6,`Enter dollars and cents: ${q.text}`);value=Math.round(n*100)}
  else if(q.kind==='number'){const n=typeof v==='string'?Number(v):v;need(typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000000,`Enter a number: ${q.text}`);value=n}
  else {need(v==='yes'||v==='no',`Answer yes or no: ${q.text}`);value=v}
  const asked={questionId:q.id,version:q.version,kind:q.kind,text:q.text,...(q.textEs?{textEs:q.textEs}:{}),at:c.now}
  if(q.kind==='injury'){const r=put(c,'injuries',{staffId,site,...asked,answer:value,status:value==='yes'?'open':'none',clockId:null});injuries.push(r);answers.push({...asked,injuryId:r.id})}
  else answers.push({...asked,value})
  if(q.kind==='breaks'&&value==='no')flags.push('missed break reported')
  if(q.kind==='yesno'&&q.flagOn&&value===q.flagOn)flags.push(`${q.text}: ${value}`)
 }
 return {answers,flags,injuries}
}
/** Links the injury answers to the punch once it exists. */
export function attach(c:Context,injuries:Row[],clockId:string) {
 for(const r of injuries){const now=c.s.injuries.find(x=>x.id===r.id)!;put(c,'injuries',{...now,clockId},now)}
}
/** Safety follow-ups each reader may see: the owner all, a manager their home cafe's, an employee their own, agents none. */
export function injuriesFor(s:State,a:Actor) {
 if(a.role==='owner')return s.injuries
 if(a.role==='manager'){const home=s.staff.find(p=>p.id===a.staffId)?.site??'';return s.injuries.filter(r=>r.site===home||r.staffId===a.staffId)}
 if(a.role==='staff')return s.injuries.filter(r=>r.staffId===a.staffId)
 return []
}
export function questions(c:Context,name:string,p:Record<string,any>) {
 if(name==='question.save') {
  need(c.a.role==='owner','Owner required',403);keys(p,['id','revision','site','position','when','kind','text','textEs','required','flagOn','active'])
  const old=p.id?get(c.s,'questions',p.id):undefined;if(old)exact(old,p)
  const when=text(p.when,'moment',3),kind=text(p.kind,'kind',10);need(MOMENTS.includes(when),'Ask at clock-in or clock-out');need(QKINDS.includes(kind),'Choose breaks, injury, tips, yes-no or number')
  const wording=text(p.text,'question',200),es=text(p.textEs,'Spanish question',200,true),flagOn=text(p.flagOn,'flag answer',3,true)
  need(!flagOn||kind==='yesno'&&['yes','no'].includes(flagOn),'Only a custom yes-no question flags an answer')
  const changed=!old||old.text!==wording||(old.textEs??'')!==es,version=old?(changed?old.version+1:old.version):1
  return put(c,'questions',{site:text(p.site,'site',80,true),position:text(p.position,'position',80,true),when,kind,text:wording,...(es?{textEs:es}:{}),required:yes(p.required),flagOn,active:p.active===undefined?true:yes(p.active),version,wordings:[...(old?.wordings??[]),...(changed?[{version,text:wording,textEs:es,savedAt:c.now}]:[])],createdAt:old?.createdAt??c.now,savedBy:c.a.id,savedAt:c.now},old)
 }
 if(name==='injury.resolve') {
  // A safety follow-up is resolved with a reason by the owner or a manager of its cafe, never by the employee it concerns.
  manager(c.a);keys(p,['id','revision','reason']);const r=get(c.s,'injuries',p.id);exact(r,p);need(r.status==='open','This follow-up is not open',409)
  if(c.a.role==='manager')need((c.s.staff.find(v=>v.id===c.a.staffId)?.site??'')===r.site,'Only a manager of this cafe',403)
  need(r.staffId!==c.a.staffId,'You cannot resolve your own follow-up',403)
  return put(c,'injuries',{...r,status:'resolved',resolution:{by:c.a.id,at:c.now,reason:text(p.reason,'reason',500)}},r)
 }
 return undefined
}

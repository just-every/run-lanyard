import {html,t,languageOf} from '../localization'
// CLOCK-006 screens: the owner's clock questions (on People), the questions on the phone clock,
// the answers under each timesheet, managers' safety follow-ups and declared cash tips, and the
// employee's own follow-ups.
import {h,rows,form,field,hidden,card,disclosure,empty,person,staffOf,exact} from './shared'
import {sitesOf} from './week'
import {dateKey,day,money} from './format'

const KIND:Record<string,string>={breaks:'Breaks taken',injury:'Injury today',tips:'Cash tips declared',yesno:'Custom yes-no',number:'Custom number'}
function fields(s:any,q:any={}) {
 const opt=(name:string,list:[string,string][],value:string)=>`<select name="${h(name)}">${list.map(([v,l])=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(l)}</option>`).join('')}</select>`
 return `${q.id?exact(q):''}<div class="fields"><label>Cafe${opt('site',[['','Every cafe'],...sitesOf(s).map((v:string)=>[v,v] as [string,string])],q.site??'')}</label>${field('position','Position (blank for everyone)',q.position??'','text','maxlength="80"')}<label>Asked at${opt('when',[['out','Clock-out'],['in','Clock-in']],q.when??'out')}</label><label>Kind${opt('kind',Object.entries(KIND),q.kind??'yesno')}</label>${field('text','Question',q.text??'','text','required maxlength="200"')}${field('textEs','Question in Spanish (optional)',q.textEs??'','text','maxlength="200"')}<label>Flag for review when the answer is${opt('flagOn',[['','Never'],['yes','Yes'],['no','No']],q.flagOn??'')}</label></div><label class="check"><input type="checkbox" name="required" value="true" ${q.required?'checked':''}> Required</label><label class="check"><input type="checkbox" name="active" value="true" ${q.active===false?'':'checked'}> Asked</label>`
}
const ordered=(list:any[])=>[...list].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||String(a.id).localeCompare(String(b.id)))
export function questionsCard(s:any) {
 const list=ordered(rows(s,'questions'))
 const table=list.length?`<table class="list stack"><thead><tr><th>Question</th><th>Where</th><th>Version</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(q=>`<tr><td data-label="Question">${h(q.text)}${q.textEs?`<small>${h(q.textEs)}</small>`:''}<small>${h(KIND[q.kind])} · ${q.when==='in'?'clock-in':'clock-out'}${q.required?' · required':''}${q.active?'':' · not asked'}</small></td><td data-label="Where">${h(q.site||'Every cafe')}${q.position?` · ${h(q.position)}`:''}</td><td data-label="Version">${h(q.version)}</td><td>${disclosure('Edit',form('question.save','people',fields(s,q),'Save question','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No clock questions.')
 return card('Clock questions',`<p class="note">Short questions on the phone clock. A “no” to breaks opens a break exception, a flagged answer opens an exception for approval, and an injury answer opens a private safety follow-up for the cafe’s managers. Cash tip declarations are listed for managers. Changing a question keeps earlier answers under their old wording.</p>${table}${disclosure('Add a question',form('question.save','people',fields(s),'Save question','','secondary'))}`,'','clock-questions')
}
/** The questions for this punch moment, as fields of the clock form (English, with the Spanish text beside it). */
export function clockQuestions(s:any,open:any,when:'in'|'out') {
 const me=staffOf(s,s.actor.staffId),shift=open?.shiftId?rows(s,'shifts').find(x=>x.id===open.shiftId):undefined,site=shift?.site||me?.site||''
 return ordered(rows(s,'questions')).filter(q=>q.active&&q.when===when&&(!q.site||q.site===site)&&(!q.position||q.position===(me?.position??''))).map(q=>{
  const label=languageOf(s)==='es'?(q.textEs||`${q.text} — ${t(s,'Original wording; Spanish was not supplied.')}`):q.text,name=`answer:${q.id}`,req=q.required?' required':''
  if(q.kind==='tips')return field(name,`${label} ($)`,'','number',`min="0" max="100000" step="0.01"${req}`)
  if(q.kind==='number')return field(name,label,'','number',`step="any"${req}`)
  return html(s)`<label>${h(label)}<select name="${h(name)}"${req}><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>`
 }).join('')
}
/** One line under a timesheet: the answers given at its punch (injury answers stay in their follow-up). */
export function answersNote(s:any,r:any) {
 const list=(r.answers??[]).filter((a:any)=>a.kind!=='injury');if(!list.length)return ''
 return html(s)`<small>Answers: ${h(list.map((a:any)=>`${languageOf(s)==='es'?(a.textEs||a.text):a.text} ${a.kind==='tips'?money(a.value):a.value}`).join(' · '))}</small>`
}
export function safetyCard(s:any,tz:string,back:string,canManage:boolean) {
 const list=rows(s,'injuries').filter(r=>r.status!=='none'&&(canManage?r.staffId!==s.actor.staffId:r.staffId===s.actor.staffId));if(!list.length)return ''
 const items=list.map(r=>html(s)`<li><strong>${canManage?h(person(s,r.staffId)):t(s,'Your report')}</strong> · ${h(day(dateKey(r.at,tz)))} · “${h(r.text)}” ${h(r.answer)} · ${r.status==='open'?'open':`resolved: ${h(r.resolution?.reason)}`}${canManage&&r.status==='open'?form('injury.resolve',back,exact(r)+field('reason',t(s,'How it was followed up'),'','text','required maxlength="500"'),t(s,'Resolve'),'','secondary small'):''}</li>`).join('')
 return card(canManage?t(s,'Safety follow-ups'):t(s,'My safety reports'),html(s)`<ul class="swap-list">${items}</ul>`,'','safety')
}
/** Declared cash tips per person and day, from clock answers, for managers (TIPS-001 takes them into its pool draft). */
export function tipsCard(s:any,days:string[],tz:string) {
 const sums=new Map<string,number>()
 for(const t of rows(s,'timesheets'))if(t.status!=='superseded'&&days.includes(dateKey(t.start,tz)))for(const a of t.answers??[])if(a.kind==='tips'){const k=`${t.staffId}|${dateKey(t.start,tz)}`;sums.set(k,(sums.get(k)??0)+a.value)}
 if(!sums.size)return ''
 return card('Declared cash tips',`<table class="list stack"><thead><tr><th>Person</th><th>Day</th><th class="num">Declared</th></tr></thead><tbody>${[...sums].map(([k,v])=>{const [id,d]=k.split('|');return `<tr><td>${h(person(s,id))}</td><td>${h(day(d))}</td><td class="num">${h(money(v))}</td></tr>`}).join('')}</tbody></table><p class="note">Employee declarations at clock-out; tip pooling uses them once it is set up.</p>`,'','tips')
}

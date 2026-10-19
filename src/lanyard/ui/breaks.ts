// BREAK-001 screens: the owner's break policy per cafe (on People), the break buttons and
// clock-out attestation on the phone clock, and what each timesheet recorded about its breaks.
import {h,rows,form,field,hidden,card,disclosure,empty,staffOf,moment} from './shared'
import {sitesOf} from './week'
import {clock} from './format'

function fields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('revision',r.revision):`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
 return `<div class="fields">${where}${field('mealAfterMinutes','Meal starts by (minutes worked)',r.mealAfterMinutes??300,'number','required min="60" max="1440"')}${field('mealMinutes','Meal length (minutes)',r.mealMinutes??30,'number','required min="10" max="120"')}${field('waiveUpTo','Employee may waive the meal on shifts up to (minutes; 0 = never)',r.waiveUpTo??360,'number','required min="0" max="1440"')}${field('restEveryMinutes','One paid rest break per (minutes worked; 0 = none)',r.restEveryMinutes??240,'number','required min="0" max="720"')}${field('restMinutes','Rest length (minutes)',r.restMinutes??10,'number','required min="5" max="60"')}</div><label class="check"><input type="checkbox" name="premium" value="true" ${r.premium?'checked':''}> Pay one hour of premium at the regular rate for a missed, short or late meal, and one for missed rest breaks</label>`
}
const describe=(r:any)=>`Meal of ${r.mealMinutes} min started by ${(r.mealAfterMinutes/60).toFixed(1)} hours worked${r.waiveUpTo?`, waivable up to ${(r.waiveUpTo/60).toFixed(1)} hours`:''}${r.restEveryMinutes?` · ${r.restMinutes}-min paid rest per ${(r.restEveryMinutes/60).toFixed(1)} hours`:''}${r.premium?' · premiums paid':''}`
export function breakRulesCard(s:any) {
 const list=rows(s,'breakrules')
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Policy</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Policy">${h(describe(r))}</td><td>${disclosure('Edit',form('breakrule.save','people',fields(s,r),'Save break policy','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No break policy: breaks are recorded but not checked.')
 return card('Break policy',`<p class="note">Staff time paid rest and unpaid meal breaks on the clock. At clock-out a missed, short or late meal and missed or short rest breaks become exceptions for approval. Only timed meal minutes are unpaid; a missing break never reduces paid time. Set the numbers your state and city require.</p>${table}${disclosure('Add a break policy',form('breakrule.save','people',fields(s),'Save break policy','','secondary'))}`,'','break-rules')
}
const onBreak=(open:any)=>(open.breaks??[]).find((b:any)=>!b.end)
/** The clock card's break controls: while on a break only its end, otherwise start buttons beside clock-out. */
export function breakButtons(open:any) {
 const current=onBreak(open)
 if(current)return {command:'clock.breakEnd',fields:'',label:`End ${current.kind} break`}
 return {command:'clock.out',fields:`<div class="break-actions"><button type="submit" class="secondary" data-command="clock.breakStart" data-kind="meal" formnovalidate>Start meal break</button><button type="submit" class="secondary" data-command="clock.breakStart" data-kind="rest" formnovalidate>Start rest break</button></div>`,label:'Clock out'}
}
/** Breaks taken so far on the open punch. */
export function clockBreaks(open:any,tz:string) {
 const list=(open.breaks??[]).map((b:any)=>`<li>${h(b.kind==='meal'?'Meal (unpaid)':'Rest (paid)')} · ${moment(b.start,tz)}${b.end?` – ${moment(b.end,tz)}`:' · on break now'}</li>`).join('')
  return list?`<ul class="breaks">${list}</ul>`:''
}
/** The waiver and break attestation asked inside the clock-out form when the cafe has a policy. */
export function breakQuestions(s:any,open:any) {
 const shift=open.shiftId?rows(s,'shifts').find(x=>x.id===open.shiftId):undefined,site=shift?.site||staffOf(s,s.actor.staffId)?.site||''
 const rule=rows(s,'breakrules').find(r=>r.site===site)
 return rule?`<p class="note">Break policy: ${h(describe(rule))}.</p>${rule.waiveUpTo?`<label class="check"><input type="checkbox" name="waiveMeal" value="true"> ${h('I chose to waive my meal break on this shift.')}</label>`:''}${field('breakNote','Anything about your breaks today (optional, kept with your time)','','text','maxlength="500"')}`:''
}
/** One line under a timesheet's source: timed breaks, waiver, attestation and premium inputs. */
export function breakNote(r:any,tz:string) {
 const parts=[...(r.breaks??[]).map((b:any)=>`${b.kind} ${clock(b.start,tz)}–${clock(b.end,tz)}`),...(r.breakWaiver?['meal waived by the employee']:[]),...(r.breakAttestation?[`employee: “${r.breakAttestation.note}”`]:[]),...(r.premiums??[]).map((p:any)=>`${p.code} ${p.minutes/60} hr`)]
 return parts.length?`<small>Breaks: ${h(parts.join(' · '))}</small>`:''
}

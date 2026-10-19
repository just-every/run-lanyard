// AVAIL-001 screens: the weekly pattern form (staff for themselves, managers for anyone),
// each pattern with its status, the manager's approve/decline and approval switch, and the
// published shifts a saved or approved pattern collides with.
import {h,rows,form,field,hidden,exact,textarea,staffSelect,status,disclosure,empty,person,outcome,manager,venue} from './shared'
import {day,when} from './format'

const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const blockLine=(b:any)=>`${DAYS[b.day]} ${b.kind} ${b.start}-${b.end}`
const exceptionLine=(x:any)=>`${x.date} ${x.kind}${x.start?` ${x.start}-${x.end}`:''}`

export function patternForm(s:any,back:string,forSomeone=false) {
 const body=`${forSomeone?staffSelect(s):''}<div class="fields">${field('from','Starts on','','date','required')}${field('until','Ends on (optional)','','date')}${field('preferredHours','Preferred hours a week','','number','min="0" max="168"')}${field('maxHours','Most hours a week','','number','min="0" max="168"')}</div>${textarea('blocks','Weekly blocks, one per line','','required rows="5" placeholder="Mon available 07:00-15:00&#10;Tue preferred 09:00-17:00&#10;Sun unavailable 00:00-24:00"')}${textarea('exceptions','One-off dates (optional), one per line','','rows="2" placeholder="2026-11-26 unavailable&#10;2026-11-27 available 09:00-13:00"')}`
 return disclosure(forSomeone?'Set someone’s weekly pattern':'Set a weekly pattern',form('pattern.save',back,body,'Save pattern','','secondary'))
}
/** Published shifts the last saved or approved pattern collides with. */
export function collisionNote(s:any,extras:any) {
 const r=outcome(extras);if(!Array.isArray(r?.collisions)||!r.collisions.length)return ''
 return `<div class="banner warn" role="status"><div><p>This pattern collides with published shifts:</p><ul class="conflicts">${r.collisions.map((x:any)=>`<li>${h(when(x.start,venue(s)))}</li>`).join('')}</ul></div></div>`
}
export function patternList(s:any,back:string) {
 const list=rows(s,'patterns').slice().sort((a,b)=>b.from.localeCompare(a.from)),canDecide=manager(s)
 const decide=(r:any)=>canDecide&&r.status==='pending'&&r.staffId!==s.actor.staffId&&r.submittedBy!==s.actor.id?`<div class="row-actions">${form('pattern.decide',back,exact(r)+hidden('decision','approved'),'Approve','','primary small')}${form('pattern.decide',back,exact(r)+hidden('decision','declined'),'Decline','','secondary small')}</div>`:''
 const table=list.length?`<table class="list"><thead><tr><th>Person</th><th>Weekly pattern</th><th>Dates</th><th>Status</th><th><span class="sr-only">Decide</span></th></tr></thead><tbody>${list.map(r=>`<tr><td>${h(person(s,r.staffId))}</td><td>${r.blocks.map((b:any)=>h(blockLine(b))).join('<br>')}${r.exceptions.length?`<small>Except ${h(r.exceptions.map(exceptionLine).join('; '))}</small>`:''}${r.preferredHours!==null||r.maxHours!==null?`<small>${r.preferredHours!==null?`Prefers ${h(r.preferredHours)} h`:''}${r.preferredHours!==null&&r.maxHours!==null?' · ':''}${r.maxHours!==null?`at most ${h(r.maxHours)} h`:''} a week</small>`:''}</td><td>${h(day(r.from))}${r.until?` – ${h(day(r.until))}`:' onward'}</td><td>${status(r.status==='declined'?'rejected':r.status,r.status)}</td><td>${decide(r)}</td></tr>`).join('')}</tbody></table>`:empty('No weekly patterns yet.','calendar')
 const policy=canDecide?form('availability.policy',back,`${rows(s,'availrules')[0]?exact(rows(s,'availrules')[0]):''}<label class="check"><input type="checkbox" name="requireApproval" value="true" ${rows(s,'availrules')[0]?.requireApproval?'checked':''}> Staff changes to their weekly pattern wait for a manager’s approval</label>`,'Save','','secondary small'):''
 return `<h3>Weekly patterns</h3>${table}${policy}`
}

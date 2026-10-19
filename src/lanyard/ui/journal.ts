// JOURNAL-001 screens: the employee journal on People for the owner and cafe managers (add,
// edit, attachment, prior versions), and the notes shared with an employee on their Time page.
import {h,rows,hidden,card,empty,person,disclosure,textarea,field,status} from './shared'
import {day} from './format'

const CATEGORIES:[string,string][]=[['attendance','Attendance conversation'],['performance','Performance'],['commendation','Commendation'],['other','Other']]
const label=(v:string)=>CATEGORIES.find(([k])=>k===v)?.[1]??v
const fileLink=(n:any,f:any)=>f?`<a class="text-link" href="/api/lanyard/notes/${h(n.id)}/files/${h(f.id)}">${h(f.name)}</a>`:''
// Multipart so a note may carry one attachment; it posts back to People.
const noteForm=(content:string,button:string)=>`<form method="post" enctype="multipart/form-data" action="/app/action?name=note.save&amp;returnTo=%2Fapp%2Fpeople">${content}<button type="submit" class="secondary">${h(button)}</button></form>`
function fields(n:any={}) {
 return `<div class="fields">${field('date','Date',n.date??'','date','required')}<label>Category<select name="category">${CATEGORIES.map(([k,l])=>`<option value="${k}" ${k===n.category?'selected':''}>${h(l)}</option>`).join('')}</select></label><label>Who can read it<select name="visibility"><option value="private" ${n.visibility!=='employee'?'selected':''}>Managers only</option><option value="employee" ${n.visibility==='employee'?'selected':''}>Also the employee</option></select></label></div>${textarea('text','Note',n.text??'','required maxlength="4000"')}<label>Attachment (optional, 1 MB)<input type="file" name="attachment"></label>`
}

export function journalCard(s:any) {
 const mine=s.actor.staffId,notes=rows(s,'notes').filter(n=>n.staffId!==mine)
 const people=rows(s,'staff').filter(p=>p.active&&p.id!==mine&&(s.actor.role==='owner'||(p.site??'')===(rows(s,'staff').find(v=>v.id===mine)?.site??'')))
 const line=(n:any)=>`<li><strong>${h(person(s,n.staffId))}</strong> · ${h(day(n.date))} · ${h(label(n.category))} · ${status(n.visibility==='employee'?'Shared with employee':'Managers only')} · by ${h(n.byName)}<p>${h(n.text)}</p>${fileLink(n,n.attachment)}${n.versions?.length?disclosure(`${n.versions.length} earlier version${n.versions.length===1?'':'s'}`,`<ol class="versions">${n.versions.map((v:any)=>`<li>Revision ${h(v.revision)} · ${h(day(v.date))} · ${h(label(v.category))} · ${h(v.visibility==='employee'?'shared':'managers only')} · by ${h(v.byName)}<p>${h(v.text)}</p>${fileLink(n,v.attachment)}</li>`).join('')}</ol>`):''}${disclosure('Edit',noteForm(hidden('id',n.id)+hidden('revision',n.revision)+fields(n),'Save note'),false,'inline-menu')}</li>`
 const list=notes.length?`<ul class="journal">${notes.sort((a,b)=>b.date.localeCompare(a.date)).map(line).join('')}</ul>`:empty('No notes yet.')
 const add=people.length?disclosure('Add a note',noteForm(`<label>Employee<select name="staffId" required>${people.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select></label>${fields()}`,'Add note')):''
 return card('Employee notes',`<p class="note">Dated notes on an employee’s record. Managers only see their own cafe’s people; edits keep every earlier version. Notes never appear in team views, agent access or reports.</p>${list}${add}`,'','journal')
}
/** Notes a manager or the owner chose to share with this employee, read-only. */
export function sharedNotesCard(s:any) {
 const list=rows(s,'notes').filter(n=>n.staffId===s.actor.staffId&&n.visibility==='employee')
 if(!list.length)return ''
 return card('Notes shared with you',`<ul class="journal">${list.map(n=>`<li>${h(day(n.date))} · ${h(label(n.category))}<p>${h(n.text)}</p>${fileLink(n,n.attachment)}</li>`).join('')}</ul>`,'','shared-notes')
}

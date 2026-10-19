// CONTACT-001 screens: a person's own emergency contacts form, the link to a contact card where the
// viewer may open it (the owner, and a manager for people at their home cafe), and the audited card itself.
import {h,rows,form,hidden,card,manager,owner,titleRow} from './shared'

const shown=(phone:string)=>`(${phone.slice(2,5)}) ${phone.slice(5,8)}-${phone.slice(8)}`
export function contactsForm(s:any,back:string) {
 const mine=rows(s,'contacts')[0],list=mine?.contacts??[]
 const row=(i:number)=>{const x=list[i]??{};return `<div class="fields"><label>Name<input name="contactName" value="${h(x.name??'')}" maxlength="80"${i?'':' required'}></label><label>Relationship<input name="contactRelationship" value="${h(x.relationship??'')}" maxlength="40"></label><label>Phone (US)<input name="contactPhone" type="tel" value="${h(x.phone?shown(x.phone):'')}" maxlength="30"></label></div>`}
 const body=`<p class="note">Your manager can open these from your shift if something happens at work; each view is recorded.</p>${form('contact.save',back,(mine?hidden('revision',mine.revision):'')+[0,1,2].map(row).join(''),'Save emergency contacts','','secondary')}`
 return card('Emergency contacts',body,`<p class="card-note">${h(list.length)} of 3</p>`,'emergency-contacts')
}
/** The card link, only where the viewer's role and cafe let them open it. */
export function contactLink(s:any,staffId:string) {
 const person=rows(s,'staff').find(p=>p.id===staffId),home=rows(s,'staff').find(p=>p.id===s.actor.staffId)?.site
 const may=person&&manager(s)&&(owner(s)||(home&&person.site===home))
 return may?` <a class="text-link" href="/app/contacts/${h(staffId)}">Emergency contacts</a>`:''
}
export function contactPage(s:any,c:any,now:number) {
 const list=c.contacts.length?`<ul class="swap-list">${c.contacts.map((x:any)=>`<li><strong>${h(x.name)}</strong> · ${h(x.relationship)} · <a class="text-link" href="tel:${h(x.phone)}">Call ${h(shown(x.phone))}</a></li>`).join('')}</ul>`:'<p class="note">No emergency contacts yet.</p>'
 return `${titleRow(c.name,s,now)}${card('Emergency contacts',`${list}<p class="note">Read-only. This view is recorded in activity.</p>`,c.site?`<p class="card-note">${h(c.site)}</p>`:'','contact-card')}`
}

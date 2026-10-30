// COVER-004 screens: the offer order fields (open shifts and each cafe's call-out replacements),
// an open shift's offer log, the access-to-hours line, and the per-cafe rule card on People.
import {h,rows,form,field,hidden,card,disclosure,empty,owner,person,moment} from './shared'
import {sitesOf} from './week'

const RULE:Record<string,string>={parttime:'part-time staff first',preferred:'preferred availability first',fewest:'fewest hours this week first',seniority:'earliest start date first',custom:'custom ranking'}
export const ORDINANCES='San Jose, Seattle, San Francisco and New York City access-to-hours ordinances'
/** Offer order inputs: all at once, or timed tiers by a priority rule (custom: people in the chosen order). */
export function orderFields(s:any,r:any={}) {
 const team=rows(s,'staff').filter(p=>p.active)
 return `<label>Offer order<select name="order"><option value="all">Everyone eligible at once</option><option value="tiers"${r.order==='tiers'?' selected':''}>Timed tiers by priority</option></select></label><label>Priority (tiers)<select name="rule">${Object.entries(RULE).map(([k,v])=>`<option value="${k}"${r.rule===k?' selected':''}>${h(v[0].toUpperCase()+v.slice(1))}</option>`).join('')}</select></label>${field('size','People per tier',r.size??3,'number','min="1" max="50"')}${field('minutes','Minutes per tier',r.minutes??30,'number','min="1" max="1440"')}<label>Custom ranking (in order)<select name="ranking" multiple>${team.map(p=>`<option value="${h(p.id)}"${(r.ranking??[]).includes(p.id)?' selected':''}>${h(p.name)}</option>`).join('')}</select></label>`
}
export const orderLabel=(r:any)=>r?.order==='tiers'?`tiers of ${r.size} every ${r.tierMinutes??r.minutes} min, ${RULE[r.rule]}`:'everyone eligible at once'
/** The offer log: each tier, when it opened, and each person's answer. */
export function offerLog(s:any,o:any,tz:string) {
 if(!o.tiers)return ''
 const asks=rows(s,'pickups').filter(x=>x.openShiftId===o.id),now=new Date().toISOString()
 const answer=(id:string)=>{const x=asks.filter(v=>v.staffId===id).at(-1);if(!x)return 'no answer'
  return x.status==='declined'?`declined ${h(moment(x.declinedAt,tz))}`:`${h(x.status==='withdrawn'?'declined, then requested':x.status)} ${x.requestedAt?h(moment(x.requestedAt,tz)):''}`}
 const items=o.tiers.map((t:any,i:number)=>`<li>${o.tiers.length>1?`Tier ${i+1} · `:''}${t.opensAt<=now?'offered':'opens'} ${moment(t.opensAt,tz)}: ${t.staffIds.map((id:string)=>`${h(person(s,id))} (${answer(id)})`).join(', ')||'no one eligible'}</li>`).join('')
 return disclosure('Offer log',`<ul class="offer-log">${items}${o.order==='tiers'?`<li>Then everyone eligible ${moment(o.everyoneAt,tz)}</li>`:''}</ul>`,false,'inline-menu')
}
/** Access to hours on an open shift: who is still owed the offer and who was added meanwhile. */
export function accessLine(s:any,o:any) {
 const x=o.accessToHours;if(!x)return ''
 if(!x.owed.length)return '<p class="note">Access to hours: offered to every existing part-time employee at this cafe.</p>'
 const owed=x.owed.map((v:any)=>`${h(person(s,v.staffId))}${v.typeSet?'':' (employment type not set)'}`).join(', ')
 return `<p class="${x.flagged?'warning':'note'}">${x.flagged?`Flag: ${x.hires.map((id:string)=>h(person(s,id))).join(', ')} added for these hours before they were offered to existing part-time staff. `:'Access to hours: '}Not yet offered to ${owed}.</p>`
}
/** People added while an open shift at their cafe was still owed to existing part-time staff. */
export function hireFlags(s:any,staffId:string) {
 return rows(s,'openshifts').filter(o=>o.accessToHours?.flagged&&o.accessToHours.hires.includes(staffId))
}
function ruleFields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('revision',r.revision):`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
 const access=owner(s)?`${hidden('accessToHours','off')}<label class="check"><input type="checkbox" name="accessToHours"${r.accessToHours?' checked':''}> Offer hours to existing part-time staff before hiring (${h(ORDINANCES)})</label>`:''
 return `<div class="fields">${where}${orderFields(s,r)}${access}</div>`
}
/** The per-cafe rule: how call-out replacements are offered, and (owner) the access-to-hours rule. */
export function offerRulesCard(s:any) {
 const list=rows(s,'offerrules')
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Replacements</th><th>Access to hours</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Replacements">${h(orderLabel(r))} <a class="text-link" href="/app/demand?site=${encodeURIComponent(r.site)}#offer-learning">Review response timing</a></td><td data-label="Access to hours">${r.accessToHours?'On':'Off'}</td><td>${disclosure('Edit',form('offerrule.save','people',ruleFields(s,r),'Save rule','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No offer rules: call-out replacements go to every qualified teammate at once.')
 return card('Offer order',`<p class="note">Call-out replacements follow the cafe's order; each open shift chooses its own when posted. With access to hours on, the open shift and People flag a person added at the cafe while its hours are not yet offered to every existing part-time employee there (people without an employment type count until the owner sets one). Lanyard records the offers; it does not decide whether an ordinance applies.</p>${table}${disclosure('Add a rule',form('offerrule.save','people',ruleFields(s),'Save rule','','secondary'))}`,'','offer-rules')
}

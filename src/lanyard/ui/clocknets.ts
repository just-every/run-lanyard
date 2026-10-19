// CLOCK-007 on People (owner only): each cafe's web time clock rule (approved IP ranges, refuse
// or flag other networks) and the browsers enrolled as that cafe's clock, with enrol and revoke.
import {h,rows,form,field,hidden,textarea,card,disclosure,empty,moment,venue} from './shared'
import {sitesOf} from './week'

const MODES:[string,string][]=[['off','Off: punch from anywhere'],['refuse','Refuse other networks'],['flag','Accept and flag other networks']]
const cafes=(s:any)=>sitesOf(s).length?sitesOf(s):['']
const cafeSelect=(s:any)=>`<label>Cafe<select name="site">${cafes(s).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
function fields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('revision',r.revision):cafeSelect(s)
 return `<div class="fields">${where}<label>Other networks<select name="mode">${MODES.map(([v,l])=>`<option value="${h(v)}" ${v===(r.mode??'refuse')?'selected':''}>${h(l)}</option>`).join('')}</select></label>${textarea('ranges','Approved public IP ranges (one per line, e.g. 203.0.113.0/24)',(r.ranges??[]).join('\n'),'rows="3" maxlength="4000"')}</div>`
}
export function clockNetsCard(s:any) {
 const tz=venue(s),list=rows(s,'clocknets'),browsers=rows(s,'clockBrowsers').filter(b=>!b.revokedAt)
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Other networks</th><th>Approved ranges</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Other networks">${h(MODES.find(([k])=>k===r.mode)?.[1]??r.mode)}</td><td data-label="Approved ranges">${h(r.ranges.join(', ')||'None')}</td><td>${disclosure('Edit',form('clocknet.save','people',fields(s,r),'Save rule','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No clock network rules: staff can clock in from any network.')
 const enrolled=browsers.length?`<ul class="swap-list">${browsers.map(b=>`<li><strong>${h(b.label)}</strong> · ${h(b.site||'Your cafe')} · enrolled ${moment(b.createdAt,tz)}${form('clockbrowser.revoke','people',hidden('id',b.id),'Revoke','','secondary small')}</li>`).join('')}</ul>`:''
 const enrol=disclosure('Enrol this browser as a time clock',form('clockbrowser.enroll','people',`<div class="fields">${cafeSelect(s)}${field('label','Label (e.g. Back office PC)','','text','required maxlength="80"')}</div>`,'Enrol this browser','','secondary'))
 return card('Web time clock',`<p class="note">Limit clock-in and clock-out at a cafe to its approved networks or enrolled browsers. Each punch records only the network address it came from and which approval matched.</p>${table}${disclosure('Add a rule',form('clocknet.save','people',fields(s),'Save rule','','secondary'))}${enrolled}${enrol}`,'','clock-networks')
}

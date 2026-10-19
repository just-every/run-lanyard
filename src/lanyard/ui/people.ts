// People: the team as one table (position, rate, home cafe, payroll ID), the owner's
// edits inline, and the venue time zone, fixed once the first week is published.
import {h,owner,manager,rows,form,field,hidden,exact,disclosure,card,status,empty,venue,avatar,titleRow} from './shared'
import {money,ZONES,zoneLabel} from './format'
import {teamViewCard} from './team'

function editor(s:any,p:any={}) {
 const lists=`<datalist id="positions">${[...new Set(rows(s,'staff').map(v=>v.position).filter(Boolean))].map(v=>`<option value="${h(v)}">`).join('')}</datalist><datalist id="sites">${[...new Set(rows(s,'staff').map(v=>v.site).filter(Boolean))].map(v=>`<option value="${h(v)}">`).join('')}</datalist>`
 return `${p.id?exact(p):''}<div class="fields">${field('name','Full name',p.name,'text','required maxlength="120" autocomplete="off"')}${field('email','Email',p.email,'email','required autocomplete="off"')}${field('position','Position',p.position??'','text','maxlength="80" list="positions" placeholder="Baristas and counter"')}${field('hourlyRate','Hourly rate (USD)',typeof p.hourlyRateCents==='number'?(p.hourlyRateCents/100).toFixed(2):'','text','inputmode="decimal" placeholder="19.00"')}${field('site','Home cafe',p.site??'','text','maxlength="80" list="sites" placeholder="Ocean Beach"')}${field('payrollId','Payroll ID (needed before export)',p.payrollId??'','text','maxlength="100"')}<label>Role<select name="role"><option value="staff">Staff</option><option value="manager" ${p.role==='manager'?'selected':''}>Manager</option></select></label></div><label class="check"><input type="checkbox" name="active" value="true" ${(p.active===undefined||p.active)?'checked':''}> Active</label>${lists}`
}
function zoneCard(s:any) {
 const locked=rows(s,'rosters').some(r=>r.status==='published'||r.publishedAt),zones=ZONES.map(([z])=>z)
 if(!zones.includes(venue(s)))zones.push(venue(s))
 const label=zoneLabel(venue(s))
 const body=locked?`<p><strong>${h(label)}</strong></p><p class="note">The time zone is fixed once the first week is published, so published weeks keep their meaning.</p>`:form('settings.save','people',`<label>Venue time zone<select name="timezone" required>${zones.map(z=>`<option value="${h(z)}" ${z===venue(s)?'selected':''}>${h(zoneLabel(z))}</option>`).join('')}</select></label><p class="note">Shifts and clock times use this zone on every device. Set it before you publish the first week; it is fixed after that.</p>`,'Save time zone','','secondary')
 return card('Venue time zone',body)
}
// Edit opens in place under the row (a #edit- target, so it works without JavaScript).
function personRow(s:any,p:any,canEdit:boolean) {
 const editable=canEdit&&!p.erasedAt,anchor=`edit-${p.id}`
 const edit=editable?`<div class="edit-panel"><div class="card-head"><h2>Edit ${h(p.name)}</h2><a class="text-link" href="#team">Close</a></div>${form('staff.save','people',editor(s,p),'Save person','','primary')}<div class="split">${disclosure('Invite to Lanyard',`<p class="note">Sends a sign-in link to ${h(p.email)}.</p>${form('staff.invite','people',hidden('id',p.id),'Send invitation','','secondary')}`)}${disclosure('Erase unused staff',`<p class="note">Only people added by hand who were never invited or scheduled can be erased. For anyone with history, clear Active instead.</p>${form('staff.erase','people',exact(p),'Erase unused staff','','secondary')}`)}</div></div>`:''
 return `<tbody class="person"><tr><td class="who">${avatar(p.name)}<span><strong>${h(p.name)}</strong><small>${h(p.email)}</small></span></td><td class="pos" data-label="Position">${h(p.position??'—')}</td><td class="num rate" data-label="Rate">${typeof p.hourlyRateCents==='number'?h(money(p.hourlyRateCents)):'—'}</td><td class="site" data-label="Home cafe">${h(p.site??'—')}</td><td class="pid" data-label="Payroll ID">${p.payrollId?`<code>${h(p.payrollId)}</code>`:'<span class="quiet">Not set</span>'}</td><td class="role" data-label="Role">${status(p.role)}</td><td class="st" data-label="Status">${status(p.active?'Active':'Inactive')}</td><td class="edit">${editable?`<a class="text-link" href="#${h(anchor)}">Edit</a>`:''}</td></tr>${edit?`<tr class="edit-row" id="${h(anchor)}"><td colspan="8">${edit}</td></tr>`:''}</tbody>`
}
export function people(s:any,now:number,site:string,q:URLSearchParams) {
 const canEdit=owner(s),find=(q.get('q')??'').trim().toLowerCase()
 const team=rows(s,'staff').filter(p=>(!site||p.site===site)&&(!find||[p.name,p.email,p.position,p.site,p.payrollId].some(v=>String(v??'').toLowerCase().includes(find))))
 const active=team.filter(p=>p.active).length
 const search=`<form class="filter" method="get" action="/app/people" role="search"><input type="hidden" name="site" value="${h(site||'all')}"><label><span class="sr-only">Find a person</span><input type="search" name="q" value="${h(q.get('q')??'')}" placeholder="Find by name, email or position"></label>${find?'<a class="text-link" href="/app/people">Clear</a>':''}</form>`
 const table=team.length?`<table class="list stack people"><thead><tr><th>Person</th><th>Position</th><th class="num">Rate</th><th>Home cafe</th><th>Payroll ID</th><th>Role</th><th>Status</th><th><span class="sr-only">Edit</span></th></tr></thead>${team.map(p=>personRow(s,p,canEdit)).join('')}</table>`:empty(find?`No one matches “${q.get('q')}”.`:'No staff yet. Add your first person to build a schedule.')
 const add=canEdit?card('Add a person',form('staff.save','people',editor(s),'Add person','class="person-form"','primary'),`<a class="text-link" href="/app/import">Import a staff CSV</a>`,'add'):''
 return `${titleRow(`${site||'All cafes'} · ${active} active`,s,now)}${card('Team',search+table,`<p class="card-note">${h(team.length)} ${team.length===1?'person':'people'}${manager(s)&&!canEdit?' · only the owner edits':''}</p>`,'team')}${add}${teamViewCard(s,site)}${canEdit?zoneCard(s):''}`
}

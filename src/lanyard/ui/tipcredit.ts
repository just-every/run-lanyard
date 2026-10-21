// TIPS-002 on Payroll: the owner's cafe tip-credit setups, and each recent workweek's check with its
// make-up pay inputs and non-tipped duty time for the owner and the managers of each person's cafe.
import {h,rows,form,field,hidden,exact,card,disclosure,empty,owner} from './shared'
import {day,hours,money} from './format'

// Mirrors the domain's no-tip-credit list for the form's labels; the server refuses those states.
const STATES:[string,string][]=[['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']]
const BARRED=['CA','WA','OR','NV','MN','AK','MT']
const stateName=(code:string)=>STATES.find(([c])=>c===code)?.[1]??code
const jobName=(s:any,id:string)=>rows(s,'jobs').find(j=>j.id===id)?.name??'Removed job'
const back='/app/payroll#tip-credit'

function setupFields(s:any,current?:any) {
 const jobs=rows(s,'jobs'),cafes=[...new Set([...rows(s,'staff').map(p=>p.site),...rows(s,'shifts').map(x=>x.site)].filter(Boolean))].sort()
 const site=current?hidden('site',current.site):`${field('site','Cafe','','text','required maxlength="80" list="tip-credit-cafes"')}<datalist id="tip-credit-cafes">${cafes.map(c=>`<option value="${h(c)}"></option>`).join('')}</datalist>`
 const last=current?.versions.at(-1)
 return `<div class="fields">${site}<label>State<select name="state" required><option value="">Choose a state</option>${STATES.map(([c,n])=>`<option value="${c}"${last?.state===c?' selected':''}>${h(n)}${BARRED.includes(c)?' (no tip credit)':''}</option>`).join('')}</select></label>${field('minimumWage','Minimum wage at this cafe (USD per hour)',last?(last.minimumWageCents/100).toFixed(2):'','text','required inputmode="decimal" placeholder="7.25"')}${field('from','Effective from','','date','required')}</div><fieldset><legend>Jobs whose work produces tips</legend>${jobs.length?jobs.map(j=>`<label class="check"><input type="checkbox" name="tippedJobs" value="${h(j.id)}"${last?.tippedJobs.includes(j.id)?' checked':''}> ${h(j.name)}</label>`).join(''):'<p class="note">Add jobs in People first.</p>'}</fieldset>`
}
function setups(s:any) {
 const list=rows(s,'tipcredits')
 const items=list.map(r=>`<li><strong>${h(r.site)}</strong>${r.versions.map((v:any)=>`<div class="note">${h(stateName(v.state))} · minimum wage ${h(money(v.minimumWageCents))}/hr from ${h(day(v.from))} · tipped jobs: ${h(v.tippedJobs.map((id:string)=>jobName(s,id)).join(', '))}</div>`).join('')}${owner(s)?disclosure('Change from a date',form('tipcredit.save',back,exact(r)+setupFields(s,r),'Save tip credit','','secondary')):''}</li>`).join('')
 return `${items?`<ul class="swap-list">${items}</ul>`:empty('No cafe has a tip-credit setup, so no workweek is checked.')}${owner(s)?disclosure('Set up a tip credit',form('tipcredit.save',back,setupFields(s),'Save tip credit','','secondary')):''}`
}
function checks(s:any) {
 const list=rows(s,'tipChecks'),weeks=[...new Set(list.map(r=>r.week))]
 if(!weeks.length)return rows(s,'tipcredits').length?empty('No approved time in tipped jobs at these cafes in the last five workweeks.'):''
 return weeks.map(week=>{const inWeek=list.filter(r=>r.week===week)
  return `<h3>Week of ${h(day(week))}</h3><table class="list stack tip-checks"><thead><tr><th>Person</th><th class="num">Tipped hours</th><th class="num">Minimum wage due</th><th class="num">Cash wage</th><th class="num">Declared tips</th><th class="num">Make-up pay input</th><th>Non-tipped duty time</th></tr></thead><tbody>${inWeek.map(r=>`<tr><td class="who"><span><strong>${h(r.name)}</strong><small>${h(r.sites.map((x:any)=>`${x.site}, ${x.stateName} at ${money(x.minimumWageCents)}/hr`).join('; '))}</small></span></td><td class="num" data-label="Tipped hours">${h(hours(r.tippedMinutes))}</td><td class="num" data-label="Minimum wage due">${h(money(r.requiredCents))}</td><td class="num" data-label="Cash wage">${r.rateMissing?'Rate missing':h(money(r.cashWageCents))}</td><td class="num" data-label="Declared tips">${h(money(r.tipsCents))}</td><td class="num" data-label="Make-up pay input">${r.makeUpCents===null?'Not checked: set the job rate':r.makeUpCents>0?`<strong>${h(money(r.makeUpCents))}</strong>`:'None'}</td><td data-label="Non-tipped duty time">${r.nonTipped.length?h(r.nonTipped.map((x:any)=>`${x.jobName} at ${x.site}: ${hours(x.minutes)} hrs`).join('; ')):'None'}</td></tr>`).join('')}</tbody></table><p><a class="button secondary" href="/api/lanyard/tipcredit.csv?week=${encodeURIComponent(week)}">Download make-up pay inputs</a></p>`}).join('')
}
export function tipCreditCard(s:any) {
 return card('Tip credit',`<p class="note">Where a cafe takes a tip credit, each employee’s configured workweek (Monday to Sunday until assigned a pay group) a tipped employee's cash wage plus the cash tips they declared at clock-out must reach the cafe's minimum wage for their approved minutes in tipped jobs. A shortfall is a make-up pay input to add in your payroll provider: Lanyard does not pay it or add it to a payroll batch. Minutes in the cafe's other jobs are listed as non-tipped duty time for your own dual-jobs treatment. Minimum wages are the ones you enter; Lanyard does not keep state or local rates.</p>${setups(s)}${checks(s)}`,'','tip-credit')
}

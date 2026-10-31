import {demandGenerationPanel} from './fairness-compare'
import {localDay,localWeekday,html,t as tr} from '../localization'
import {laborCostCard} from './labor-cost'
import {aiScheduleCard} from './ai-schedule'
import {fairnessCard} from './fairness'
// Schedule: the owner-picked week shift calendar, then the week's draft and planning.
import {scheduleHolidays} from './holidays'
import {h,manager,form,exact,outcome,titleRow,rows,staffOf} from './shared'
import {type Week} from './week'
import {grid,link} from './grid'
import {offerCards} from './callout'
import {swapCards} from './swaps'
import {openShiftCards} from './openshifts'
import {overtimeCard} from './overtime'
import {historyCard} from './history'
import {askbar} from './askbar'
import {planner} from './planner'
import {conflictList} from './shell'
import {day} from './format'
import {reviewCard} from './schedule-review'
import {dashboardCard} from './dashboard'
import {shiftworkCard} from './shiftwork'
import {acaWarnings} from './aca'

function draftBanner(s:any,w:Week,back:string,extras:any) {
 const result=outcome(extras),conflicts=result?.conflicts?.length?conflictList(s,result.conflicts,w.tz,result.shifts??[]):''
 if(!w.draft)return ''
 const publish=manager(s)?form('roster.publish',back,exact(w.draft),tr(s,'Publish this revision'),'','primary'):''
 const text=w.view==='draft'?html(s)`Draft revision ${h(w.draft.revision)} of the week of ${h(localDay(s,w.week))}${w.published?html(s)` · <a href="${h(link(w,{view:null}))}">Show the published week</a>`:''}`:html(s)`A new draft of this week is ready · <a href="${h(link(w,{view:'draft'}))}">Review draft revision ${h(w.draft.revision)}</a>`
 return html(s)`<div class="banner${conflicts?' warn':''}"><div><p>${text}</p>${conflicts?html(s)`<p class="banner-sub">Review these before publishing:</p>${conflicts}`:''}</div>${w.view==='draft'?publish:''}</div>`
}
export function schedule(s:any,w:Week,extras:any,now:number,back:string,q:URLSearchParams) {
 const home=w.site||staffOf(s,s.actor.staffId)?.site,title=manager(s)?`${w.site||tr(s,'All cafes')} · ${w.headcount} staff`:html(s)`${home?home+' · ':''}My shifts`
 const noPeople=manager(s)&&!rows(s,'staff').length?html(s)`<div class="banner"><p>Add your team in People first, then build the week here.</p><a class="button primary" href="/app/people#add">Add people</a></div>`:''
 return html(s)`${titleRow(title,s,now)}${s.actor.staffId?html(s)`<p><a class="text-link" href="/app/calendar#my-calendar">Manage my calendar subscription</a></p>`:''}${manager(s)?dashboardCard(s):''}${offerCards(s,w.tz,back)}${swapCards(s,w.tz,back)}${openShiftCards(s,w.tz,back)}${manager(s)?overtimeCard(s,w.week,w.tz,back):''}${acaWarnings(s)}${historyCard(s,w.week,w.tz,manager(s))}${noPeople}${scheduleHolidays(s,w)}${reviewCard(s,s.scheduleReviews?.find((r:any)=>r?.week===w.week),w.tz)}${draftBanner(s,w,back,extras)}<section class="schedule" aria-label="Schedule">${grid(s,w,now,back,q)}</section>${shiftworkCard(s,w,back)}${askbar(s)}<div class="below">${laborCostCard(extras.result?.cost,back)}${planner(s,w,back,extras)}${aiScheduleCard(s,w,back)}${fairnessCard(extras.result?.fairness,extras.result?.fairnessCompare,s)}${extras.result?.fairness?demandGenerationPanel(s,w.week,extras.result.fairness.site,q,extras.result?.generation,extras.result?.demandComparison):''}</div>`
}

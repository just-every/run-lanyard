// Schedule: the owner-picked week shift calendar, then the week's draft and planning.
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
import {dashboardCard} from './dashboard'

function draftBanner(s:any,w:Week,back:string,extras:any) {
 const result=outcome(extras),conflicts=result?.conflicts?.length?conflictList(s,result.conflicts,w.tz,result.shifts??[]):''
 if(!w.draft)return ''
 const publish=manager(s)?form('roster.publish',back,exact(w.draft),'Publish this revision','','primary'):''
 const text=w.view==='draft'?`Draft revision ${h(w.draft.revision)} of the week of ${h(day(w.week))}${w.published?` · <a href="${h(link(w,{view:null}))}">Show the published week</a>`:''}`:`A new draft of this week is ready · <a href="${h(link(w,{view:'draft'}))}">Review draft revision ${h(w.draft.revision)}</a>`
 return `<div class="banner${conflicts?' warn':''}"><div><p>${text}</p>${conflicts?`<p class="banner-sub">Review these before publishing:</p>${conflicts}`:''}</div>${w.view==='draft'?publish:''}</div>`
}
export function schedule(s:any,w:Week,extras:any,now:number,back:string,q:URLSearchParams) {
 const home=w.site||staffOf(s,s.actor.staffId)?.site,title=manager(s)?`${w.site||'All cafes'} · ${w.headcount} staff`:`${home?home+' · ':''}My shifts`
 const noPeople=manager(s)&&!rows(s,'staff').length?`<div class="banner"><p>Add your team in People first, then build the week here.</p><a class="button primary" href="/app/people#add">Add people</a></div>`:''
 return `${titleRow(title,s,now)}${manager(s)?dashboardCard(s):''}${offerCards(s,w.tz,back)}${swapCards(s,w.tz,back)}${openShiftCards(s,w.tz,back)}${manager(s)?overtimeCard(s,w.week,w.tz,back):''}${historyCard(s,w.week,w.tz,manager(s))}${noPeople}${draftBanner(s,w,back,extras)}<section class="schedule" aria-label="Schedule">${grid(s,w,now,back,q)}</section>${askbar(s)}<div class="below">${planner(s,w,back,extras)}</div>`
}

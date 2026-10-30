import {personalSettings} from './calendar'
import {languageOf,languageScript,html,t as tr,staffError} from '../localization'
import {personalLanguageSettings} from './language'
import {auditPage} from './audit-report'
import {reportsPage} from './reports'
import {chatPage} from './chat'
import {accessPage} from './access'
import {noticeInbox,scheduleInbox} from './notices'
import {themeFrame} from '../../base/theme-frame'
import {h,manager,owner,venue,self} from './shared'
import {topbar,type Tab} from './shell'
import {weekModel} from './week'
import {schedule} from './schedule'
import {time} from './time'
import {payroll} from './payroll'
import {people} from './people'
import {movein,agent} from './admin'
import {wallPage} from './print'
import {contactPage} from './contacts'
import {intervalsPage} from './intervals'
import {demandPage} from './demand'
import {policiesPage} from './policies'
// Both faces are on every screen; preloading them starts the downloads with the stylesheets instead of after them.
const fontPreloads=['/fonts/inter/inter-latin-wght-normal.woff2','/fonts/source-serif-4/source-serif-4-latin-opsz-italic.woff2'].map(href=>`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`).join('')
const styles=['/app/shell.css','/app/schedule.css','/app/screens.css','/app/editor.css'].map(href=>`<link rel="stylesheet" href="${href}">`).join('')
const titles:Record<string,string>={calendar:'My calendar',reports:'Operational reports',audit:'Audit records',settings:'Settings',access:'Access levels',demand:'Demand forecast',intervals:'Labor by interval',contacts:'Emergency contacts',wall:'Wall schedule',schedule:'Schedule',time:'Time',payroll:'Payroll',people:'People',import:'Import staff',agent:'Agent access'}
export async function renderApp(state:any,path:string,extras:{message?:string,error?:string,result?:any}={},now=Date.now()):Promise<Response> {
 const url=new URL(path,'http://app.invalid'),q=url.searchParams,tab=url.pathname.split('/')[2]||'schedule',back=url.pathname+url.search,languageSettings=url.pathname==='/app/settings/language'
 const tabs:Tab[]=state.auditOnly?[{key:'audit',label:'Audit records'}]:[{key:'schedule',label:'Schedule'},{key:'access',label:'Access'},{key:'chat',label:'Chat'},{key:'time',label:`${tr(state,'Time')}${state.notices?.length?' · '+state.notices.length:''}`},...(manager(state)?[{key:'payroll',label:'Payroll'},{key:'people',label:'People'}]:[])]
 const allowed=(tab==='reports'&&Boolean(extras.result?.operational))||(tab==='audit'&&Boolean(extras.result?.audit))||tabs.some(t=>t.key===tab)||(self(state)&&languageSettings)||(owner(state)&&['import','agent','settings'].includes(tab))||(tab==='calendar'&&Boolean(state.actor.staffId))||(manager(state)&&tab==='wall')||(tab==='contacts'&&Boolean(extras.result?.contactCard))||(tab==='intervals'&&Boolean(extras.result?.report))||(tab==='demand'&&Boolean(extras.result?.demand))
 const frame=await themeFrame({href:'/rer-theme.css',productName:'Lanyard',accentColor:'#9B1B3A'})
 const w=weekModel(state,now,q,tab==='schedule')
 const content=tab==='chat'?chatPage(state,extras.result?.chat??state.chat??{threads:[],messages:[],reads:[],people:[],q:''}):tab==='access'?accessPage(state,extras.result?.access??state.access):!allowed?'<div class="title-row"><h1>Page unavailable</h1></div><p>Your role cannot open this page.</p><p><a class="text-link" href="/app/schedule">Open the schedule</a></p>':tab==='reports'?reportsPage(state,extras.result.operational,now):tab==='audit'?auditPage(state,extras.result.audit,now):tab==='calendar'?personalSettings(state,extras,now):tab==='settings'?(languageSettings?personalLanguageSettings(state):personalLanguageSettings(state)+policiesPage(state,q,extras,now)):tab==='time'?time(state,w,now,back,q,extras):tab==='payroll'?payroll(state,now):tab==='people'?people(state,now,w.site,q):tab==='contacts'?contactPage(state,extras.result.contactCard,now):tab==='intervals'?intervalsPage(state,extras.result.report,now):tab==='demand'?demandPage(state,extras.result.demand,now,back,extras.result.learning):tab==='import'?movein(state,extras,now):tab==='agent'?agent(state,extras,now):tab==='wall'?wallPage(state,w,now):schedule(state,w,extras,now,back,q)
 const notice=`${extras.error?`<div class="notice error" role="alert">${h(staffError(state,extras.error))}</div>`:''}${extras.message?`<div class="notice" role="status">${h(staffError(state,extras.message))}</div>`:''}`
 const html=`<!doctype html><html lang="${languageOf(state)==='es'?'es-US':'en-US'}"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(tr(state,titles[tab]??'Lanyard'))} · Lanyard</title>${tab==='wall'&&allowed?'<meta http-equiv="refresh" content="60">':''}${frame.head}${fontPreloads}<link rel="stylesheet" href="/fonts/fonts.css">${styles}${tab==='reports'?'<link rel="stylesheet" href="/app/reports.css">':''}${languageScript()}<script src="/punch-photo.js" defer></script><script src="/punch-location.js" defer></script><script src="/clock-outbox.js" defer></script><script src="/clock-recovery.js" defer></script><script src="/shiftwork.js" defer></script><script src="/schedule-editor.js" defer></script><script src="/ai-schedule.js" defer></script><script src="/lanyard.js" defer></script><script src="/mobile-workflows.js" defer></script></head><body class="lanyard-app" data-timezone="${h(venue(state))}" data-actor="${h(state.actor.id)}" data-role="${h(state.actor.role)}" data-inactive-staff="${h(JSON.stringify(manager(state)?state.staff.filter((p:any)=>!p.active).map((p:any)=>p.id):[]))}" data-staff-id="${h(state.actor.staffId)}" data-revoked-kiosks="${h(JSON.stringify(state.revokedKiosks??[]))}" data-revoked-kiosk-sessions="${h(JSON.stringify(state.revokedKioskSessions??[]))}"><a class="skip" href="#main">${h(tr(state,'Skip to content'))}</a>${tab==='wall'&&allowed?'':topbar(state,tabs,tab,w,q)}<main id="main" tabindex="-1" data-page="${h(tab)}">${notice}${['schedule','time'].includes(tab)&&allowed?scheduleInbox(state,back)+noticeInbox(state,back,state.actor.role==='manager'?state.staff.find((p:any)=>p.id===state.actor.staffId)?.site??'':w.site):''}${content}</main></body></html>`
 return new Response(html,{status:allowed?200:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':`default-src 'self'; ${frame.policy}; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,'referrer-policy':'same-origin','x-content-type-options':'nosniff'}})
}

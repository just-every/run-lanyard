import catalog from './staff-catalog.json'
import '../../public/staff-language.js'
declare global {
 var LanyardI18n:{translate:(catalog:Record<string,string>,language:string,source:string,values?:Record<string,unknown>)=>string;template:(catalog:Record<string,string>,language:string,strings:readonly string[],values:unknown[])=>string}
}
export const languageOf=(s:any):'en'|'es'=>(s.clocklanguages??[]).find((r:any)=>r.staffId===s.actor?.staffId)?.language==='es'?'es':'en'
export const t=(s:any,source:string,values:Record<string,unknown>={})=>globalThis.LanyardI18n.translate(catalog,languageOf(s),source,values)
export const html=(s:any)=>(strings:TemplateStringsArray,...values:unknown[])=>globalThis.LanyardI18n.template(catalog,languageOf(s),strings,values)
// An inert encoded payload keeps unused catalog messages separate from rendered page content.
export const languageScript=()=>{
 const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(catalog)),byte=>String.fromCharCode(byte)).join(''))
 return `<script id="staff-catalog" type="application/json">${JSON.stringify(encoded)}</script><script src="/staff-language.js" defer></script>`
}
export function staffError(s:any,message:string){
 if(languageOf(s)==='en')return message
 if(Object.hasOwn(catalog,message))return t(s,message)
 for(const [prefix,translated] of [['Answer: ','Answer the required question: {question}'],['Enter dollars and cents: ','Enter dollars and cents: {question}'],['Enter a number: ','Enter a number: {question}'],['Answer yes or no: ','Answer yes or no: {question}']])if(message.startsWith(prefix)){
  const original=message.slice(prefix.length),q=(s.questions??[]).find((q:any)=>q.text===original)
  return t(s,translated,{question:q?.textEs||original})
 }
 return t(s,'This action could not be completed. Review the current records and try again.')
}

export const localDay=(s:any,date:string,weekday=true)=>new Intl.DateTimeFormat(languageOf(s)==='es'?'es-US':'en-US',{timeZone:'UTC',...(weekday?{weekday:'short'}:{}),month:'short',day:'numeric'}).format(new Date(date+'T12:00:00Z')).replace(',','')
export const localWeekday=(s:any,date:string)=>new Intl.DateTimeFormat(languageOf(s)==='es'?'es-US':'en-US',{timeZone:'UTC',weekday:'short'}).format(new Date(date+'T12:00:00Z'))

/** Translate generated clock flags without changing authored exception wording. */
export function punchFlag(s:any,value:string){
 if(value==='location unavailable')return t(s,'location unavailable')
 if(value==='location permission denied')return t(s,'location permission denied')
 if(value==='location consent declined')return t(s,'location consent declined')
 if(value==='poor location accuracy')return t(s,'poor location accuracy')
 if(value==='out-of-zone punch')return t(s,'out-of-zone punch')
 if(value==='inside geofence')return t(s,'inside geofence')
 if(value==='geofence boundary uncertain')return t(s,'geofence boundary uncertain')
 if(value==='missed break reported')return t(s,'missed break reported')
 if(value==='punch photo unavailable: camera denied')return t(s,'punch photo unavailable: camera denied')
 if(value==='punch photo unavailable: camera failed')return t(s,'punch photo unavailable: camera failed')
 if(value==='punch photo unavailable: photo consent declined')return t(s,'punch photo unavailable: photo consent declined')
 if(value==='unscheduled punch')return t(s,'unscheduled punch')
 if(value==='early clock-in')return t(s,'early clock-in')
 if(value==='missed meal')return t(s,'missed meal')
 if(value==='unconfirmed meal deduction')return t(s,'unconfirmed meal deduction')
 if(value==='short meal break')return t(s,'short meal break')
 if(value==='short rest break')return t(s,'short rest break')
 if(value==='late meal break')return t(s,'late meal break')
 return value
}

/** Localize first-party capture verbs; captured records keep their original command names. */
export function captureName(s:any,value:string){
 switch(value){
  case 'clock.in':return t(s,'Clock in')
  case 'clock.out':return t(s,'Clock out')
  case 'clock.breakStart':return t(s,'Start break')
  case 'clock.breakEnd':return t(s,'End break')
  case 'clock.transfer':return t(s,'Change job')
  default:return value
 }
}

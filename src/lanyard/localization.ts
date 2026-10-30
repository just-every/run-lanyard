import catalog from './staff-catalog.json'
import '../../public/staff-language.js'
declare global {
 var LanyardI18n:{translate:(catalog:Record<string,string>,language:string,source:string,values?:Record<string,unknown>)=>string;template:(catalog:Record<string,string>,language:string,strings:readonly string[],values:unknown[])=>string}
}
export const languageOf=(s:any):'en'|'es'=>(s.clocklanguages??[]).find((r:any)=>r.staffId===s.actor?.staffId)?.language==='es'?'es':'en'
export const t=(s:any,source:string,values:Record<string,unknown>={})=>globalThis.LanyardI18n.translate(catalog,languageOf(s),source,values)
export const html=(s:any)=>(strings:TemplateStringsArray,...values:unknown[])=>globalThis.LanyardI18n.template(catalog,languageOf(s),strings,values)
export const languageScript=()=>`<script id="staff-catalog" type="application/json">${JSON.stringify(catalog).replace(/</g,'\\u003c')}</script><script src="/staff-language.js" defer></script>`
export function staffError(s:any,message:string){
 if(languageOf(s)==='en')return message
 if(Object.hasOwn(catalog,message))return t(s,message)
 for(const [prefix,translated] of [['Answer: ','Answer the required question: {question}'],['Enter dollars and cents: ','Enter dollars and cents: {question}'],['Enter a number: ','Enter a number: {question}'],['Answer yes or no: ','Answer yes or no: {question}']])if(message.startsWith(prefix)){
  const original=message.slice(prefix.length),q=(s.questions??[]).find((q:any)=>q.text===original)
  return t(s,translated,{question:q?.textEs||original})
 }
 return t(s,'This action could not be completed. Review the current records and try again.')
}

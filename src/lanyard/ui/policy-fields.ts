import {hidden,h} from './shared'
export function policyFields(input:Record<string,unknown>){return Object.entries(input).filter(([key])=>key!=='reviewDigest').map(([key,value])=>key==='alternate'?hidden('reviewedAlternate',JSON.stringify(value)):hidden(key,value)).join('')}

export function policyTextarea(name:string,label:string,value:any="",extra=""){return `<label>${h(label)}<textarea aria-label="${h(label)}" name="${h(name)}" ${extra}>${h(value)}</textarea></label>`}

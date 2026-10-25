import {hidden} from './shared'
export function policyFields(input:Record<string,unknown>){return Object.entries(input).filter(([key])=>key!=='reviewDigest').map(([key,value])=>key==='alternate'?hidden('reviewedAlternate',JSON.stringify(value)):hidden(key,value)).join('')}

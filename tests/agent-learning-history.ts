// Source for the isolated conformance Worker. Bundle with
// node scripts/build-agent-history.mjs after changing native demand calculation.
// Only native sales and forecast history is returned; the door's normal
// learning, digest, proposal, policy and audit paths produce every result.
import {demandCompute,digestOf,datePlus} from '../src/lanyard/domain/demand'
import {type State,type Row} from '../src/lanyard/domain/model'

export default {async fetch(request:Request) {
 const {phase,now,outputs}=await request.json() as {phase:string;now:number;outputs:{context:{actor:{id:string}}}}
 // The held phase reads the same immutable historical observations. Its open
 // predecessor proposal is decided separately through the real person door.
 if(phase!=='autonomous')return Response.json([])
 const today=new Date(now).toISOString().slice(0,10),site='Ocean Beach',person=outputs.context.actor.id
 const sales:Row[]=Array.from({length:35},(_,i)=>{
  const date=datePlus(today,-i-1)
  return {id:'door-history-sales-'+date,revision:1,site,date,hour:10,metric:'sales',value:i<7?13000:10000,source:'form',savedBy:person,savedAt:date+'T23:00:00.000Z',versions:[]}
 })
 const rows=sales.map(row=>({statement:'sale',values:[row.id,JSON.stringify(row)]}))
 for(let prior=7;prior>=1;prior--) {
  const date=datePlus(today,-prior),savedAt=datePlus(date,-1)+'T23:00:00.000Z'
  // Calculate using only sources observed before this forecast was saved.
  const state={timezone:'UTC',demandrules:[],sales:sales.filter(row=>row.savedAt<savedAt)} as unknown as State
  const calculated=demandCompute(state,site,date,savedAt)
  if(calculated.status!=='complete')throw new Error('Native forecast history is incomplete')
  const row={...calculated,id:'door-history-forecast-'+date,revision:1,version:1,digest:await digestOf(calculated),kind:'computed',supersedes:null,overrides:{},savedBy:person,savedAt}
  rows.push({statement:'forecast',values:[row.id,JSON.stringify(row)]})
 }
 return Response.json(rows)
}}

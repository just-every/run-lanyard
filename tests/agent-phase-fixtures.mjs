// Each policy round prepares a distinct interval. The native time service
// continues to refuse overlapping work; the verifier never rewrites history.
let day = 6
export default async function ({phase,request,origin,cookie}) {
 // A prior policy round's proposal remains real native work. A named human
 // declines it before the next round; agents still cannot decide proposals.
 if(phase==='held') {
  const headers={origin,cookie,'content-type':'application/json'}
  const response=await request(origin+'/api/lanyard/state',{headers})
  if(response.status!==200)throw new Error('Native proposal state unavailable')
  const state=await response.json()
  for(const proposal of state.learnproposals.filter(row=>row.status==='proposed')) {
   const decision=await request(origin+'/api/lanyard/command',{method:'POST',headers,body:JSON.stringify({name:'learn.decide',input:{id:proposal.id,revision:proposal.revision,decision:'declined',reason:'Owner reviewed the preceding conformance proposal before a fresh policy round'}})})
   if(decision.status!==200)throw new Error('Native proposal decision refused')
  }
 }
 const start = new Date(Date.UTC(2026, 0, day++, 10))
 return {values: {time: {start: start.toISOString(), end: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString()}}}
}

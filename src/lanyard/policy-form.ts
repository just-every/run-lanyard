import {fail} from './domain/model'

/** Structured schedule fields stay ordinary native command inputs. The hidden
 * review payload preserves the exact proposal across the explicit approval. */
export function policyForm(input:Record<string,unknown>,params:URLSearchParams){
 if(params.has('reviewedAlternate')){
  try{input.alternate=JSON.parse(String(input.reviewedAlternate))}catch{fail('Reload the reviewed alternate workweek')}
  delete input.reviewedAlternate
 }
 if(!params.has('altKind'))return
 const kind=String(input.altKind),common={kind,workUnit:input.altWorkUnit,staffIds:params.getAll('altStaffIds'),days:params.getAll('altDays').map(d=>({day:Number(d),minutes:Number(input['altMinutes'+d])})),employerAttested:params.has('altAttested'),effectiveFrom:input.altEffectiveFrom,reviewer:input.altReviewer,reviewedOn:input.altReviewedOn}
 input.alternate=kind==='CA_WO5_GENERAL'?{...common,electionOn:input.altElectionOn,announcedOn:input.altAnnouncedOn,electionEvidence:input.altElectionEvidence,implementationEvidence:input.altImplementationEvidence}:kind==='AK_FLEX_APPROVED'?{...common,approvalOn:input.altApprovalOn,approvalEvidence:input.altApprovalEvidence,participationOn:input.altParticipationOn,participationEvidence:input.altParticipationEvidence,ordinaryScheduleOffered:params.has('altOrdinaryScheduleOffered')}:{...common,agreementOn:input.altAgreementOn,agreementEvidence:input.altAgreementEvidence}
 for(const key of Object.keys(input))if(key.startsWith('alt')&&key!=='alternate')delete input[key]
}

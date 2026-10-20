// Old log entries used the record revision for receipts, including receipt-only
// writes. Map those numbers onto retained edit boundaries, keeping the originals.
export const entryFiles=(r:any):any[]=>r?.attachments??(r?.attachment?[r.attachment]:[])
export function normalizeLog(r:any) {
 if(r.contentRevision!==undefined)return r
 const {attachment,...entry}=r
 return {...entry,contentRevision:r.versions.length+1,attachments:entryFiles(r),
  versions:r.versions.map((v:any,i:number)=>{const {attachment,...version}=v;return {...version,contentRevision:i+1,attachments:entryFiles(v)}}),
  reads:r.reads.map((read:any)=>({...read,recordRevision:read.revision,revision:1+r.versions.filter((v:any)=>v.revision<read.revision).length}))}
}

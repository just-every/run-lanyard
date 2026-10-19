// SCHEDULE-005's printed copy: the rows a posting recorded, laid out as a PDF stamped
// with the revision, its publication time and the posting time, in the venue's zone.
import {pdf,type Line} from './pdf'
import {dateKey,day,span,stamp} from './ui/format'

export function postingPdf(posting:Record<string,any>,personName:string|null):Uint8Array<ArrayBuffer> {
 const tz=posting.timezone,f=posting.filter
 const scope=[f.site||'All cafes',f.position,personName].filter(Boolean).join(' · ')
 const lines:Line[]=[
  {cells:[[0,`Lanyard schedule · ${scope}`]],size:16,bold:true},
  {cells:[[0,`Week of ${day(posting.week)}, ${posting.week.slice(0,4)} · published revision ${posting.rosterRevision}, ${stamp(posting.publishedAt,tz)}`]],gap:4},
  {cells:[[0,`Printed ${stamp(posting.postedAt,tz)} · posting ${posting.id}`]]},
  {cells:[[0,'Day'],[110,'Time'],[260,'Person'],[450,'Position'],[580,'Shift']],bold:true,gap:10},
  ...posting.rows.map((r:any):Line=>({cells:[[0,day(dateKey(r.start,tz))],[110,span(r.start,r.end,tz)],[260,r.name],[450,r.position||'—'],[580,r.label]]})),
  {cells:[[0,'A later change to this week marks this copy superseded in Lanyard.']],size:8,gap:10},
 ]
 return pdf(lines)
}

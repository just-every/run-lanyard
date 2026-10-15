import type { Bindings } from './auth.server'
import { csv } from './lanyard/domain/payroll'
import { sha, type Kind, type Row } from './lanyard/domain/model'

/** A small Brisbane venue, using native records and dates relative to this visit. */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
 const db = env.DB
 const owner = await db.prepare("SELECT id FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{id:string}>()
 if (!owner) return
 const monday = new Date(now.getTime() + 10 * 3600000)
 monday.setUTCHours(0, 0, 0, 0)
 monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
 const day = (offset: number, hour = 8) => new Date(monday.getTime() + offset * 86400000 + (hour - 10) * 3600000).toISOString()
 const at = now.toISOString(), week = (offset: number) => new Date(monday.getTime() + offset * 86400000).toISOString().slice(0, 10)
 const team = ['Alex Morgan', 'Priya Shah', 'Ben Carter', 'Sofia Nguyen', 'Luca Rossi', 'Amelia Brooks', 'Noah Williams', 'Grace Chen']
 const staffId = (i: number) => `demo-staff-${i + 1}`
 const sql: D1PreparedStatement[] = [db.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT DO NOTHING').bind(owner.id, now.getTime())]
 const records: {kind:Kind; row:Row}[] = []
 const add = (kind:Kind, id:string, data:Record<string,unknown>, revision=1):Row => {
  const row = { ...data, id, revision }; records.push({kind, row}); return row
 }
 team.forEach((name, i) => {
  sql.push(db.prepare('INSERT INTO l_staff(id,name,email,payroll_id,role,active,version) VALUES(?,?,?,?,?,1,1) ON CONFLICT DO NOTHING')
   .bind(staffId(i), name, i === 0 ? ownerEmail : `${name.toLowerCase().replace(' ', '.')}@example.invalid`, `VEN${String(i + 1).padStart(3, '0')}`, i < 2 ? 'manager' : 'staff'))
  add('availability', `demo-availability-${i}`, {staffId:staffId(i), start:day(-7,0), end:day(21,0)})
 })
 for (const [offset, status] of [[0,'published'],[7,'draft']] as const) {
  const id = `demo-roster-${offset}`
  add('rosters', id, {week:week(offset), timezone:'Australia/Brisbane', status, preparedBy:owner.id, preparedAt:day(-3), ...(status==='published'?{publishedBy:owner.id,publishedAt:day(-2)}:{})}, status==='published'?2:1)
  for (let i=0; i<6; i++) {
   add('shifts', `demo-shift-${offset}-${i}`, {rosterId:id,staffId:staffId(i),start:day(offset+i%3, i%2?10:7),end:day(offset+i%3,i%2?18:15),breakMinutes:30,minutes:450,label:['Opening service','Lunch service','Kitchen prep'][i%3],status,...(status==='published'&&i<3?{confirmedAt:day(-1),confirmedBy:i===0?owner.id:staffId(i)}:{})}, status==='published'?2:1)
  }
 }
 for (const [i,status,reason] of [[5,'pending','Family wedding'],[6,'approved','Annual leave'],[7,'rejected','Alternative dates arranged']] as const) {
  add('leave',`demo-leave-${i}`,{staffId:staffId(i),start:day(10+i,0),end:day(12+i,0),reason,status,requestedBy:staffId(i),requestedAt:day(-2),...(status!=='pending'?{decidedBy:owner.id,decidedAt:day(-1)}:{})},status==='pending'?1:2)
 }
 const times = []
 for (let i=0;i<10;i++) {
  const id=`demo-time-${i}`, approved=i<7, staffIndex=1+i%7, start=day(-7+Math.floor(i/7),7), end=day(-7+Math.floor(i/7),15)
  times.push(add('timesheets',id,{staffId:staffId(staffIndex),start,end,breakMinutes:30,minutes:450,status:approved?'approved':'submitted',reason:i%2?'Phone clock':'Closing shift — recorded by duty manager',corrects:null,rootId:id,submittedBy:staffId(staffIndex),submittedAt:end,...(approved?{exportMinutes:450,approvedBy:owner.id,approvedAt:day(-4)}:{}),...(i%2?{clockId:`demo-clock-${i}`}:{})},approved?2:1))
  if(i%2)add('clocks',`demo-clock-${i}`,{staffId:staffId(staffIndex),start,end,status:'closed',capturedBy:staffId(staffIndex),receivedAt:start,closedReceivedAt:end,timesheetId:id},2)
 }
 for (const [id, selected, status] of [['demo-payroll-last-week',times.slice(0,4),'acknowledged'],['demo-payroll-review',times.slice(4,6),'draft']] as const) {
  const lines=selected.map(t=>({timeId:t.id,revision:t.revision,staffId:t.staffId,payrollId:`VEN${String(Number(t.staffId.split('-').at(-1))).padStart(3,'0')}`,start:t.start,end:t.end,minutes:450,corrects:null,rootId:t.rootId}))
  const preview=csv(lines)
  add('batches',id,{status,lines,csvPreview:preview,preparedBy:owner.id,preparedAt:day(-3),...(status==='acknowledged'?{csv:preview,sha256:await sha(preview),exportedBy:owner.id,exportedAt:day(-2),reference:'VENUE-WEEKLY-1042',acknowledgedBy:owner.id,acknowledgedAt:day(-1)}:{})},status==='acknowledged'?3:1)
  if(status==='acknowledged')for(const t of selected)sql.push(db.prepare('INSERT INTO l_payroll_claims(time_id,time_revision,batch_id,root_id,minutes) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(t.id,t.revision,id,t.rootId,450))
 }
 for(const {kind,row} of records)sql.push(db.prepare('INSERT INTO l_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(kind,row.id,row.revision,JSON.stringify(row)))
 await db.batch(sql)
}

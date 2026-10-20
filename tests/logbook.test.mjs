import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {run} from './harness.mjs'

test('LOG-001: a cafe manager writes a closing entry and an incident with five 10 MB attachments, enforcing bounds and reader access, mentioning the opening manager and linking the shift and person; the opening manager reads and acknowledges it; a search by category and month finds the incident and it exports; another cafe’s manager and staff see nothing; a correction keeps the original', () => run(async h => {
  const first = new Date();first.setUTCDate(1);first.setUTCMonth(first.getUTCMonth()-1)
  const monday = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1+(8-first.getUTCDay())%7))
  const logDate=monday.toISOString().slice(0,10),logMonth=logDate.slice(0,7),nextDate=new Date(monday.getTime()+86400000).toISOString().slice(0,10)
  const shift=staffId=>({staffId,start:logDate+'T14:00:00Z',end:logDate+'T22:00:00Z',breakMinutes:30,label:'Morning service'})
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager'), mia = await h.person('Mia', 'manager')
  for (const [p, site] of [[alex, 'Ocean Beach'], [priya, 'Ocean Beach'], [omar, 'Ocean Beach'], [mia, 'Mission']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site })
  await h.cmd('availability.save', { staffId: alex.id, start: logDate+'T00:00:00Z', end: new Date(monday.getTime()+7*86400000).toISOString() })
  const week = await h.cmd('roster.prepare', { week: logDate, shifts: [{ ...shift(alex.id), site: 'Ocean Beach' }] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  const alexShift = (await h.state(priya.cookie)).shifts.find(x => x.staffId === alex.id && x.status === 'published')
  await h.cmd('log.save', { site: 'Ocean Beach', date: logDate, category: 'sales', text: 'Closing: $2,140 in sales, patio busy' }, priya.cookie)
  const body = new FormData()
  for (const [k, v] of Object.entries({ site: 'Ocean Beach', date: logDate, category: 'incident', text: 'Alex slipped by the dish pit; ice applied', mentions: omar.id, shiftId: alexShift.id, staffId: alex.id })) body.append(k, v)
  for (let i = 0; i < 5; i++) body.append('attachments', new Blob([new Uint8Array(10_000_000).fill(i + 1)], { type: 'image/jpeg' }), i ? `incident-${i}.jpg` : 'floor.jpg')
  const encoded = new Response(body), posted = await h.mf.dispatchFetch(h.origin + '/app/action?name=log.save&returnTo=%2Fapp%2Ftime', { method: 'POST', headers: { origin: h.origin, cookie: priya.cookie, 'content-type': encoded.headers.get('content-type') }, body: await encoded.arrayBuffer() })
  assert.match(await posted.text(), /Saved\./)
  await h.cmd('log.save', { site: 'Ocean Beach', date: logDate, category: 'staffing', text: 'Other cafe' }, mia.cookie, 403)
  await h.cmd('log.save', { site: 'Ocean Beach', date: logDate, category: 'staffing', text: 'Bad mention', mentions: [mia.id] }, priya.cookie, 409)
  const incident = (await h.state(omar.cookie)).logbook.find(r => r.category === 'incident')
  assert.deepEqual([incident.mentions, incident.links, incident.attachments.map(f => [f.name, f.size])], [[omar.id], { shiftId: alexShift.id, staffId: alex.id }, Array.from({length:5}, (_,i) => [i ? `incident-${i}.jpg` : 'floor.jpg', 10_000_000])])
  for (let i = 0; i < 5; i++) {
    const file = incident.attachments[i], response = await h.mf.dispatchFetch(h.origin + `/api/lanyard/logbook/${incident.id}/files/${file.id}`, {headers:{cookie:omar.cookie}}), bytes = new Uint8Array(await response.arrayBuffer())
    assert.equal(response.status, 200); assert.equal(bytes.length, 10_000_000); assert.ok(bytes.every(b => b === i + 1))
    assert.equal(file.sha256, createHash('sha256').update(bytes).digest('hex'))
  }
  assert.match((await h.send('/app/time', undefined, omar.cookie)).text, /mentions you/)
  // Bounds apply to both the HTTP form and the command; rejected entries write nothing.
  const input = { site:'Ocean Beach', date:logDate, category:'incident', text:'Rejected' }, small = {name:'a.txt',type:'text/plain',data:Buffer.from('a').toString('base64')}
  await h.cmd('log.save', {...input, attachments:Array(6).fill(small)}, priya.cookie, 400)
  for (const [count, size] of [[6,1],[1,10_000_001]]) {
    const form = new FormData();for (const [k,v] of Object.entries(input)) form.append(k,v)
    for (let i=0;i<count;i++) form.append('attachments',new Blob([new Uint8Array(size)]),'too-big.txt')
    const encoded = new Response(form), response = await h.mf.dispatchFetch(h.origin+'/app/action?name=log.save',{method:'POST',headers:{origin:h.origin,cookie:priya.cookie,'content-type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()})
    assert.equal(response.status,200) // Form errors render the app with an error message.
    assert.match(await response.text(),/role="alert"/)
  }
  assert.equal((await h.state(priya.cookie)).logbook.length,2)
  await h.cmd('log.save', {...input, attachments:[]}, alex.cookie,403)
  assert.equal((await h.send(`/api/lanyard/logbook/${incident.id}/files/${incident.attachments[0].id}`,undefined,alex.cookie)).status,404)
  const agent = await h.cmd('agent.create',{label:'Preparation only'})
  assert.deepEqual((await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`})).value.logbook,[])
  // The opening manager acknowledges it; the author cannot.
  await h.cmd('log.read', { id: incident.id, revision: incident.revision }, priya.cookie, 409)
  const read = await h.cmd('log.read', { id: incident.id, revision: incident.revision }, omar.cookie)
  assert.deepEqual(read.reads.map(x => [x.staffId, x.revision]), [[omar.id, incident.revision]])
  assert.ok(Number.isFinite(Date.parse(read.reads[0].at)))
  // Another cafe's manager and staff see nothing.
  assert.deepEqual([(await h.state(mia.cookie)).logbook, (await h.state(alex.cookie)).logbook], [[], []])
  assert.equal((await h.send(`/api/lanyard/logbook/${incident.id}/export`, undefined, mia.cookie)).status, 404)
  assert.equal((await h.send(`/api/lanyard/logbook/${incident.id}/files/${incident.attachments[0].id}`, undefined, mia.cookie)).status, 404)
  assert.deepEqual((await h.send(`/api/lanyard/logbook?category=incident&month=${logMonth}`, undefined, mia.cookie)).value, [])
  await h.cmd('log.read', {id:read.id,revision:read.revision}, omar.cookie,409)
  await h.cmd('log.save', {id:read.id,revision:incident.revision,date:logDate,category:'incident',text:'Stale'},priya.cookie,409)
  // A correction is a new version; the search finds the incident by category and month and it exports with its history.
  await h.cmd('log.save', { id: read.id, revision: read.revision, date: logDate, category: 'incident', text: 'Alex slipped by the dish pit; ice applied, no clinic visit', mentions: [omar.id], shiftId: alexShift.id, staffId: alex.id }, priya.cookie)
  const found = (await h.send(`/api/lanyard/logbook?category=incident&month=${logMonth}`, undefined, priya.cookie)).value
  assert.deepEqual(found.map(r => [r.id, r.text, r.versions.map(v => v.text)]), [[incident.id, 'Alex slipped by the dish pit; ice applied, no clinic visit', ['Alex slipped by the dish pit; ice applied']]])
  assert.deepEqual((await h.send('/api/lanyard/logbook?category=incident&month=1900-01', undefined, priya.cookie)).value, [])
  assert.deepEqual(found[0].versions[0].attachments,incident.attachments)
  const exported = await h.send(`/api/lanyard/logbook/${incident.id}/export`, undefined, omar.cookie)
  for (const line of ['Cafe: Ocean Beach', 'Person: Alex', 'Attachment: floor.jpg', 'Read by Omar', 'Earlier version', 'not sent anywhere']) assert.ok(exported.text.includes(line), line)
  const replaced = await h.cmd('log.save',{id:found[0].id,revision:found[0].revision,date:logDate,category:'incident',text:found[0].text,attachments:[small]},priya.cookie)
  assert.equal(replaced.attachments.length,1);assert.equal(replaced.versions.length,2)
  const historicalFile=await h.mf.dispatchFetch(h.origin+`/api/lanyard/logbook/${incident.id}/files/${incident.attachments[0].id}`,{headers:{cookie:omar.cookie}})
  assert.equal(historicalFile.status,200)
  assert.equal(createHash('sha256').update(new Uint8Array(await historicalFile.arrayBuffer())).digest('hex'),incident.attachments[0].sha256)
  const acknowledged = await h.cmd('log.read',{id:replaced.id,revision:replaced.revision},omar.cookie)
  assert.equal(acknowledged.reads.at(-1).revision,replaced.contentRevision)
  await h.cmd('log.read',{id:acknowledged.id,revision:acknowledged.revision},omar.cookie,409)
  for(const category of ['maintenance','staffing','menu']) await h.cmd('log.save',{...input,category,text:category},priya.cookie)
  const exception = await h.cmd('time.request',{start:shift(alex.id).start,end:shift(alex.id).end,breakMinutes:30,reason:'Forgot punch',attest:true},alex.cookie)
  const linked = await h.cmd('log.save',{...input,timesheetId:exception.id},priya.cookie)
  assert.equal(linked.links.timesheetId,exception.id)
  assert.match((await h.send(`/api/lanyard/logbook/${linked.id}/export`,undefined,omar.cookie)).text,/missed punch/)
  const later = await h.cmd('log.save',{...input,date:nextDate,text:'Next day incident'},priya.cookie)
  const cafeSearch=(await h.send(`/api/lanyard/logbook?site=Ocean%20Beach&category=incident&month=${logMonth}`,undefined,h.owner)).value
  assert.equal(cafeSearch[0].id,later.id)
  assert.deepEqual((await h.send('/api/lanyard/logbook?site=Mission',undefined,h.owner)).value,[])
  const sales = found.length && (await h.state(priya.cookie)).logbook.find(r => r.category === 'sales')
  assert.equal((await h.send(`/api/lanyard/logbook/${sales.id}/export`, undefined, priya.cookie)).status, 409)
}))


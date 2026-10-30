// Populate only history that the production HTTP lifecycle can establish now.
// A historical sale is an entered observation; a forecast is never backdated.
import assert from 'node:assert/strict'

export default async function ({request, origin, cookie}) {
 const headers = {origin, cookie, 'content-type': 'application/json'}
 const command = async (name, input, status = 200) => {
  const response = await request(origin + '/api/lanyard/command', {
   method: 'POST', headers, body: JSON.stringify({name, input}),
  })
  assert.equal(response.status, status, name)
  return response.json()
 }
 const read = async path => {
  const response = await request(origin + path, {headers})
  assert.equal(response.status, 200)
  return response.json()
 }
 const today = new Date().toISOString().slice(0, 10)
 const prior = days => new Date(Date.parse(today + 'T12:00:00Z') - days * 86400000).toISOString().slice(0, 10)
 const site = 'Ocean Beach'
 const csv = ['date,hour,site,sales', ...Array.from({length: 21}, (_, i) =>
  `${prior(i + 1)},10,${site},${i < 7 ? 130 : 100}`)].join('\n')
 const preview = await command('sales.preview', {csv, site})
 await command('sales.import', {csv, site, fingerprint: preview.result.fingerprint})

 const forecast = date => read('/api/lanyard/demand?site=' + encodeURIComponent(site) + '&date=' + date)
 const current = await forecast(today)
 assert.equal(current.live.status, 'complete')
 await command('demand.save', {site, date: today, digest: current.live.digest})

 const yesterday = prior(1), completed = await forecast(yesterday)
 const before = await read('/api/lanyard/state')
 await command('demand.save', {site, date: yesterday, digest: completed.live.digest}, 400)
 const after = await read('/api/lanyard/state')
 assert.equal(after.version, before.version, 'a completed service day cannot acquire a backdated forecast')
 const evidence = await read('/api/lanyard/learning/proposals?site=' + encodeURIComponent(site) + '&weeks=2')
 assert.equal(evidence.status, 'insufficient')
 assert.equal(evidence.comparableDays, 0)
 assert.equal(evidence.proposal, null)
 console.log('PASS LANYARD-HISTORY: native sales preview/import and current forecast save; completed-day save refused without an effect; entered sales alone never become pre-service forecast history')
}
